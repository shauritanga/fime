import { BottomSheet } from '@/components/BottomSheet';
import { Card, financeStyles, Muted, ProgressBar, Screen, Title } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { currentPeriod, formatMoney } from '@/lib/finance/format';
import { useFinance } from '@/lib/finance/useFinance';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function MoreBudgetsScreen() {
  const { budgets, expenseCategories, saveBudget } = useFinance();
  const [categoryId, setCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const selectedCategoryId = categoryId || expenseCategories[0]?.id || '';

  async function submit() {
    const value = Number(limitAmount.replace(/,/g, ''));
    if (!value || value <= 0 || !selectedCategoryId) {
      Alert.alert('Missing budget', 'Choose a category and enter a monthly limit.');
      return;
    }

    await saveBudget({
      categoryId: selectedCategoryId,
      limitAmount: value,
      period: currentPeriod(),
    });
    setLimitAmount('');
    setCategoryId('');
    setSheetOpen(false);
    Alert.alert('Saved', 'Budget updated.');
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Title>Budgets</Title>
          <Muted>Set limits and see where the month is getting tight.</Muted>
        </View>

        {budgets.map((budget) => {
          const isOver = budget.spent > budget.limitAmount;
          return (
            <Card key={budget.id}>
              <View style={financeStyles.row}>
                <View>
                  <Text style={styles.itemTitle}>{budget.category.name}</Text>
                  <Muted>{formatMoney(budget.spent)} spent</Muted>
                </View>
                <Text style={isOver ? styles.over : styles.remaining}>
                  {isOver ? 'Over' : formatMoney(budget.remaining)}
                </Text>
              </View>
              <View style={styles.progressSpacing}>
                <ProgressBar value={budget.progress} color={isOver ? palette.coral : budget.category.color} />
              </View>
              <Muted>{Math.round(budget.progress * 100)}% of {formatMoney(budget.limitAmount)}</Muted>
            </Card>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => setSheetOpen(true)} style={styles.fab}>
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' }}
          tintColor={palette.white}
          size={30}
        />
      </Pressable>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={financeStyles.row}>
          <View>
            <Text style={styles.sheetTitle}>Add budget</Text>
            <Muted>Choose a category and monthly limit.</Muted>
          </View>
          <Pressable onPress={() => setSheetOpen(false)} style={styles.closeButton}>
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              tintColor={palette.ink}
              size={22}
            />
          </Pressable>
        </View>

        <Text style={styles.inputLabel}>Category</Text>
        <View style={financeStyles.chipRow}>
          {expenseCategories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={[
                styles.categoryChip,
                selectedCategoryId === category.id && { backgroundColor: category.color, borderColor: category.color },
              ]}>
              <Text style={[styles.categoryText, selectedCategoryId === category.id && styles.categoryTextActive]}>
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.inputLabel}>Monthly amount</Text>
        <TextInput
          keyboardType="numeric"
          onChangeText={setLimitAmount}
          placeholder="Monthly amount"
          placeholderTextColor={palette.muted}
          style={styles.input}
          value={limitAmount}
        />
        <Pressable onPress={submit} style={styles.submit}>
          <Text style={styles.submitText}>Save budget</Text>
        </Pressable>
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
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  inputLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  categoryChip: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  categoryTextActive: {
    color: palette.white,
  },
  input: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  submit: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: radii.sm,
    marginTop: spacing.md,
    paddingVertical: 14,
  },
  submitText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '900',
  },
  itemTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  progressSpacing: {
    marginVertical: spacing.md,
  },
  remaining: {
    color: palette.emerald,
    fontSize: 15,
    fontWeight: '900',
  },
  over: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: '900',
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
