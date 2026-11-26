import { ActionButton, CategoryChips, insightFormStyles } from '@/components/insights-controls';
import { BottomSheet } from '@/components/BottomSheet';
import { Card, EmptyState, financeStyles, Muted, Screen } from '@/components/finance-ui';
import { palette, spacing } from '@/constants/theme';
import { BudgetRequiredError, LOAN_REPAYMENT_CATEGORY_ID } from '@/lib/finance/database';
import { formatFullDate, formatMoney, todayISO } from '@/lib/finance/format';
import { useFinance } from '@/lib/finance/useFinance';
import type { RecurringFrequency, TransactionType } from '@/lib/finance/types';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateField, Field, SheetInput } from '@/components/form-fields';

export default function RecurringScreen() {
  const {
    addRecurringTransaction,
    categories,
    expenseCategories,
    postDueRecurring,
    recurringTransactions,
  } = useFinance();
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [nextDate, setNextDate] = useState(todayISO());
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [categoryId, setCategoryId] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const recurringCategories =
    type === 'income'
      ? categories.filter((category) => category.type === 'income')
      : expenseCategories.filter((category) => category.id !== LOAN_REPAYMENT_CATEGORY_ID);
  const dueCount = recurringTransactions.filter((item) => item.nextDate <= todayISO()).length;
  const [posting, setPosting] = useState(false);
  const selectedCategoryId = categoryId || recurringCategories[0]?.id || '';

  function openCreateSheet() {
    setType('expense');
    setAmount('');
    setNote('');
    setNextDate(todayISO());
    setFrequency('monthly');
    setCategoryId('');
    setSheetOpen(true);
  }

  async function saveRecurring() {
    const value = Number(amount.replace(/,/g, ''));

    if (value <= 0 || !selectedCategoryId) {
      Alert.alert('Missing recurring item', 'Enter an amount and category.');
      return;
    }

    try {
      await addRecurringTransaction({
        amount: value,
        categoryId: selectedCategoryId,
        frequency,
        nextDate,
        note: note.trim() || `${frequency} ${type}`,
        type,
      });
      setAmount('');
      setNote('');
      setNextDate(todayISO());
      setCategoryId('');
      setFrequency('monthly');
      setSheetOpen(false);
    } catch (error) {
      if (error instanceof BudgetRequiredError) {
        Alert.alert(
          'Budget required',
          'Create a budget for this category before scheduling the expense.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open budgets', onPress: () => router.push('/insights/budgets') },
          ]
        );
        return;
      }

      const message = error instanceof Error ? error.message : 'Could not save the recurring item.';
      Alert.alert('Could not save', message);
    }
  }

  async function postRecurring() {
    if (posting) {
      return;
    }
    setPosting(true);
    try {
      const { posted, skipped } = await postDueRecurring();
      const lines = [`${posted} ${posted === 1 ? 'transaction' : 'transactions'} added.`];
      for (const item of skipped) {
        lines.push(
          item.reason === 'budget'
            ? `${item.note}: not added, it needs a budget for its category.`
            : `${item.note}: not added, its date is not valid.`
        );
      }
      Alert.alert('Due items', lines.join('\n'));
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {dueCount > 0 ? (
          <Card tone="soft">
            <Text style={styles.emptyTitle}>
              {dueCount} {dueCount === 1 ? 'item is' : 'items are'} due
            </Text>
            <Muted>Any dates you missed are added too.</Muted>
            <View style={styles.dueButton}>
              <ActionButton label="Add to transactions" onPress={postRecurring} />
            </View>
          </Card>
        ) : null}

        {recurringTransactions.length === 0 && (
          <EmptyState title="No recurring items yet" message="Tap + to add regular income or expenses, such as salary or rent." />
        )}

        {recurringTransactions.map((item) => (
          <Card key={item.id}>
            <View style={financeStyles.row}>
              <Text style={styles.itemTitle}>{item.note}</Text>
              <Text style={item.type === 'income' ? styles.income : styles.expense}>
                {formatMoney(item.amount)}
              </Text>
            </View>
            <Muted>
              {item.frequency === 'weekly' ? 'Weekly' : 'Monthly'} · next {formatFullDate(item.nextDate)}
            </Muted>
          </Card>
        ))}
      </ScrollView>

      <Pressable onPress={openCreateSheet} style={styles.fab}>
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={palette.white} size={30} />
      </Pressable>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Add recurring</Text>
            <Muted>Schedule predictable income or expenses.</Muted>
          </View>
          <Pressable onPress={() => setSheetOpen(false)} style={styles.closeButton}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.ink} size={22} />
          </Pressable>
        </View>
        <View style={insightFormStyles.segment}>
          {(['expense', 'income'] as TransactionType[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setType(item);
                setCategoryId('');
              }}
              style={[insightFormStyles.segmentItem, type === item && insightFormStyles.segmentActive]}>
              <Text style={[insightFormStyles.segmentText, type === item && insightFormStyles.segmentTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={insightFormStyles.twoColumn}>
          <SheetInput containerStyle={styles.column} keyboardType="numeric" label="Amount (TZS)" placeholder="0" value={amount} onChangeText={setAmount} />
          <DateField label="Next date" style={styles.column} value={nextDate} onChange={setNextDate} />
        </View>
        <SheetInput label="Title" placeholder={type === 'income' ? 'Salary' : 'Rent'} value={note} onChangeText={setNote} />
        <View style={insightFormStyles.segment}>
          {(['monthly', 'weekly'] as RecurringFrequency[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => setFrequency(item)}
              style={[insightFormStyles.segmentItem, frequency === item && insightFormStyles.segmentActive]}>
              <Text style={[insightFormStyles.segmentText, frequency === item && insightFormStyles.segmentTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field label="Category">
          <CategoryChips categories={recurringCategories} selectedId={selectedCategoryId} onSelect={setCategoryId} />
        </Field>
        <ActionButton label="Add recurring" onPress={saveRecurring} />
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
  dueButton: {
    marginTop: spacing.md,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  itemTitle: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
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
  income: {
    color: palette.emerald,
    fontSize: 14,
    fontWeight: '900',
  },
  expense: {
    color: palette.coral,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
