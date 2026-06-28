import { Card, Eyebrow, financeStyles, Muted, Screen, Title } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { BudgetRequiredError } from '@/lib/finance/database';
import { todayISO } from '@/lib/finance/format';
import { useFinance } from '@/lib/finance/useFinance';
import type { TransactionType } from '@/lib/finance/types';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

export default function AddScreen() {
  const { addTransaction, expenseCategories, incomeCategories } = useFinance();
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [transactionTitle, setTransactionTitle] = useState('');
  const [date, setDate] = useState(todayISO());
  const categories = type === 'income' ? incomeCategories : expenseCategories;
  const [categoryId, setCategoryId] = useState('');

  const selectedCategoryId = useMemo(() => categoryId || categories[0]?.id || '', [categories, categoryId]);

  async function submit() {
    const value = Number(amount.replace(/,/g, ''));
    if (!transactionTitle.trim() || !value || value <= 0 || !selectedCategoryId) {
      Alert.alert('Missing details', 'Enter a transaction title, amount, and category.');
      return;
    }

    try {
      await addTransaction({
        amount: value,
        categoryId: selectedCategoryId,
        date,
        note: transactionTitle.trim(),
        type,
      });

      setAmount('');
      setTransactionTitle('');
      setDate(todayISO());
      setCategoryId('');
      Alert.alert('Saved', 'Transaction added to Fime.');
    } catch (error) {
      if (error instanceof BudgetRequiredError) {
        Alert.alert(
          'Budget required',
          'Create a budget for this category before recording the expense.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open budgets', onPress: () => router.push('/insights/budgets') },
          ]
        );
        return;
      }

      const message = error instanceof Error ? error.message : 'Could not save the transaction.';
      Alert.alert('Could not save', message);
    }
  }

  return (
    <Screen>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <View>
          <Eyebrow>Quick add</Eyebrow>
          <Title>New transaction</Title>
          <Muted>Keep the form short so logging money stays fast.</Muted>
        </View>

        <Card>
          <View style={styles.segment}>
            {(['expense', 'income'] as TransactionType[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setType(item);
                  setCategoryId('');
                }}
                style={[styles.segmentItem, type === item && styles.segmentActive]}>
                <Text style={[styles.segmentText, type === item && styles.segmentTextActive]}>
                  {item === 'expense' ? 'Expense' : 'Income'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>Amount</Text>
          <TextInput
            keyboardType="numeric"
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={palette.muted}
            style={styles.amountInput}
            value={amount}
          />

          <Text style={styles.inputLabel}>Transaction title</Text>
          <TextInput
            onChangeText={setTransactionTitle}
            placeholder={type === 'income' ? 'Salary received' : 'Bought a bottle of water'}
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={transactionTitle}
          />

          <Text style={styles.inputLabel}>Category</Text>
          <View style={financeStyles.chipRow}>
            {categories.map((category) => (
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

          <Text style={styles.inputLabel}>Date</Text>
          <TextInput
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={date}
          />

          <Pressable onPress={submit} style={styles.submit}>
            <Text style={styles.submitText}>Save transaction</Text>
          </Pressable>
        </Card>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  segment: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.sm,
    flexDirection: 'row',
    marginBottom: spacing.lg,
    padding: 4,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  segmentActive: {
    backgroundColor: palette.white,
  },
  segmentText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: palette.ink,
  },
  inputLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  amountInput: {
    color: palette.ink,
    fontSize: 38,
    fontWeight: '900',
    paddingVertical: spacing.sm,
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
  submit: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: radii.sm,
    marginTop: spacing.lg,
    paddingVertical: 15,
  },
  submitText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
  },
});
