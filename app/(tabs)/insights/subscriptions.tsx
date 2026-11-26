import { ActionButton, CategoryChips, insightFormStyles } from '@/components/insights-controls';
import { BottomSheet } from '@/components/BottomSheet';
import { Card, EmptyState, financeStyles, Muted, Screen } from '@/components/finance-ui';
import { palette, spacing } from '@/constants/theme';
import { BudgetRequiredError, LOAN_REPAYMENT_CATEGORY_ID } from '@/lib/finance/database';
import { formatFullDate, formatMoney, todayISO } from '@/lib/finance/format';
import { useFinance } from '@/lib/finance/useFinance';
import type { Subscription } from '@/lib/finance/types';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateField, Field, SheetInput } from '@/components/form-fields';

export default function SubscriptionsScreen() {
  const {
    addSubscription,
    categories,
    expenseCategories,
    paySubscription,
    saveSubscription: updateSubscription,
    subscriptions,
  } = useFinance();
  const [payingId, setPayingId] = useState('');
  const billCategories = expenseCategories.filter((category) => category.id !== LOAN_REPAYMENT_CATEGORY_ID);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(todayISO());
  const [categoryId, setCategoryId] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const selectedCategoryId = categoryId || billCategories[0]?.id || '';
  const total = subscriptions.reduce((sum, item) => sum + item.amount, 0);

  function openCreateSheet() {
    setEditingSubscription(null);
    setName('');
    setAmount('');
    setDue(todayISO());
    setCategoryId('');
    setSheetOpen(true);
  }

  function openEditSheet(subscription: Subscription) {
    setEditingSubscription(subscription);
    setName(subscription.name);
    setAmount(String(subscription.amount));
    setDue(subscription.nextDueDate);
    setCategoryId(subscription.categoryId);
    setSheetOpen(true);
  }

  async function saveSubscription() {
    const value = Number(amount.replace(/,/g, ''));

    if (!name.trim() || value <= 0 || !selectedCategoryId) {
      Alert.alert('Missing subscription', 'Enter a name, amount, and category.');
      return;
    }

    try {
      if (editingSubscription) {
        await updateSubscription({
          ...editingSubscription,
          amount: value,
          categoryId: selectedCategoryId,
          name: name.trim(),
          nextDueDate: due,
        });
      } else {
        await addSubscription({
          amount: value,
          categoryId: selectedCategoryId,
          name: name.trim(),
          nextDueDate: due,
        });
      }
      setName('');
      setAmount('');
      setDue(todayISO());
      setCategoryId('');
      setEditingSubscription(null);
      setSheetOpen(false);
    } catch (error) {
      if (error instanceof BudgetRequiredError) {
        Alert.alert(
          'Budget required',
          'Create a budget for this category before adding the subscription.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open budgets', onPress: () => router.push('/insights/budgets') },
          ]
        );
        return;
      }

      const message = error instanceof Error ? error.message : 'Could not save the subscription.';
      Alert.alert('Could not save', message);
    }
  }

  function confirmPaid(subscription: Subscription) {
    Alert.alert(
      'Mark as paid?',
      `${formatMoney(subscription.amount)} for ${subscription.name} will be saved as an expense dated today.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark paid', onPress: () => pay(subscription.id) },
      ]
    );
  }

  async function pay(subscriptionId: string) {
    // Ignore a second tap while the first payment is still being saved.
    if (payingId) {
      return;
    }
    setPayingId(subscriptionId);
    try {
      await paySubscription(subscriptionId);
    } catch (error) {
      if (error instanceof BudgetRequiredError) {
        Alert.alert('Budget required', 'Create a budget for this category, then mark it paid.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open budgets', onPress: () => router.push('/insights/budgets') },
        ]);
      } else {
        Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
      }
    } finally {
      setPayingId('');
    }
  }

  function dueLabel(date: string) {
    const today = todayISO();
    if (date === today) {
      return 'Due today';
    }
    return `${date < today ? 'Overdue since' : 'Due'} ${formatFullDate(date)}`;
  }

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card tone="soft">
          <Text style={styles.summaryLabel}>Total per month</Text>
          <Text style={styles.summaryValue}>{formatMoney(total)}</Text>
        </Card>

        {subscriptions.length === 0 ? (
          <EmptyState title="No subscriptions yet" message="Tap + to add a monthly bill, such as internet or TV." />
        ) : null}

        {subscriptions.map((subscription) => (
          <Card key={subscription.id}>
            <Pressable
              accessibilityHint="Edits this subscription"
              accessibilityRole="button"
              onPress={() => openEditSheet(subscription)}
              style={({ pressed }) => pressed && styles.pressed}>
              <View style={financeStyles.row}>
                <Text style={styles.itemTitle}>{subscription.name}</Text>
                <Text style={styles.itemValue}>{formatMoney(subscription.amount)}</Text>
              </View>
              <Muted>
                {categoryMap.get(subscription.categoryId)?.name ?? 'Category'} · {dueLabel(subscription.nextDueDate)}
              </Muted>
            </Pressable>
            <View style={styles.payButton}>
              <ActionButton label="Mark paid" onPress={() => confirmPaid(subscription)} tone="muted" />
            </View>
          </Card>
        ))}
      </ScrollView>

      <Pressable onPress={openCreateSheet} style={styles.fab}>
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={palette.white} size={30} />
      </Pressable>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>{editingSubscription ? 'Edit subscription' : 'Add subscription'}</Text>
            <Muted>{editingSubscription ? 'Update the selected subscription.' : 'Track a recurring service or renewal.'}</Muted>
          </View>
          <Pressable onPress={() => setSheetOpen(false)} style={styles.closeButton}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.ink} size={22} />
          </Pressable>
        </View>
        <SheetInput label="Name" placeholder="Home internet" value={name} onChangeText={setName} />
        <View style={insightFormStyles.twoColumn}>
          <SheetInput containerStyle={styles.column} keyboardType="numeric" label="Monthly amount" placeholder="0" value={amount} onChangeText={setAmount} />
          <DateField label="Next due date" style={styles.column} value={due} onChange={setDue} />
        </View>
        <Field label="Category">
          <CategoryChips categories={billCategories} selectedId={selectedCategoryId} onSelect={setCategoryId} />
        </Field>
        <ActionButton label={editingSubscription ? 'Save changes' : 'Add subscription'} onPress={saveSubscription} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  column: {
    flex: 1,
  },
  payButton: {
    marginTop: spacing.sm,
  },
  summaryLabel: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryValue: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  itemTitle: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  itemValue: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: 999,
    bottom: spacing.lg,
    elevation: 8,
    height: 62,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    shadowColor: palette.slate,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    width: 62,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
});
