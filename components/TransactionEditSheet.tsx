import { BottomSheet } from '@/components/BottomSheet';
import { Muted } from '@/components/finance-ui';
import { ActionButton, CategoryChips } from '@/components/insights-controls';
import { palette, radii, spacing } from '@/constants/theme';
import { deleteTransaction, isLoanTransaction, updateTransaction } from '@/lib/finance/database';
import { formatSignedMoney, toISODate } from '@/lib/finance/format';
import type { Category, Transaction } from '@/lib/finance/types';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

// Mount with `key={transaction.id}` so the form starts from the tapped entry.
export function TransactionEditSheet({
  categories,
  onChanged,
  onClose,
  transaction,
}: {
  categories: Category[];
  onChanged: () => void;
  onClose: () => void;
  transaction: Transaction;
}) {
  const db = useSQLiteContext();
  const [amount, setAmount] = useState(String(transaction.amount));
  const [note, setNote] = useState(transaction.note);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [date, setDate] = useState(transaction.date);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // `null` until we know, so a loan entry is never editable even briefly.
  const [isLoan, setIsLoan] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    isLoanTransaction(db, transaction.id)
      .then((result) => active && setIsLoan(result))
      .catch((error) => console.warn('Unable to check loan link', error));
    return () => {
      active = false;
    };
  }, [db, transaction.id]);

  const dateValue = new Date(`${date}T12:00:00`);
  const dateLabel = new Intl.DateTimeFormat('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    dateValue
  );

  async function runChange(change: () => Promise<void>, failureTitle: string) {
    setBusy(true);
    try {
      await change();
      onChanged();
      onClose();
    } catch (error) {
      setBusy(false);
      if (error instanceof Error && error.name === 'BudgetRequiredError') {
        Alert.alert('Budget required', 'There is no budget for this category in that month.');
        return;
      }
      Alert.alert(failureTitle, error instanceof Error ? error.message : 'Please try again.');
    }
  }

  function save() {
    const value = Number(amount.replace(/,/g, ''));
    if (!note.trim() || !Number.isFinite(value) || value <= 0) {
      Alert.alert('Missing details', 'Enter a transaction title and an amount above zero.');
      return;
    }

    runChange(
      () => updateTransaction(db, { ...transaction, amount: value, categoryId, date, note: note.trim() }),
      'Could not save'
    );
  }

  function confirmDelete() {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => runChange(() => deleteTransaction(db, transaction.id), 'Could not delete'),
      },
    ]);
  }

  if (isLoan !== false) {
    return (
      <BottomSheet onClose={onClose} visible>
        <Text style={styles.title}>{transaction.note || 'Transaction'}</Text>
        {isLoan ? (
          <>
            <Text style={styles.readOnlyAmount}>
              {formatSignedMoney(transaction.type === 'income' ? transaction.amount : -transaction.amount)}
            </Text>
            <Muted>{dateLabel}</Muted>
            <Muted>This is a loan repayment. It can't be changed here, so the loan balance stays correct.</Muted>
          </>
        ) : (
          <Muted>Loading…</Muted>
        )}
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose} visible>
      <Text style={styles.title}>Edit {transaction.type}</Text>

      <Text style={styles.label}>Amount</Text>
      <BottomSheetTextInput keyboardType="numeric" onChangeText={setAmount} style={styles.input} value={amount} />

      <Text style={styles.label}>Transaction title</Text>
      <BottomSheetTextInput onChangeText={setNote} style={styles.input} value={note} />

      <Text style={styles.label}>Category</Text>
      <CategoryChips
        categories={categories.filter((category) => category.type === transaction.type)}
        onSelect={setCategoryId}
        selectedId={categoryId}
      />

      <Text style={styles.label}>Date</Text>
      <Pressable accessibilityRole="button" onPress={() => setShowDatePicker(true)} style={styles.input}>
        <Text style={styles.dateText}>{dateLabel}</Text>
      </Pressable>
      {showDatePicker ? (
        <DateTimePicker
          maximumDate={new Date()}
          mode="date"
          onDismiss={() => setShowDatePicker(false)}
          onValueChange={(_event, selected) => {
            setShowDatePicker(Platform.OS === 'ios');
            setDate(toISODate(selected));
          }}
          value={dateValue}
        />
      ) : null}

      <View pointerEvents={busy ? 'none' : 'auto'} style={styles.actions}>
        <ActionButton label="Save changes" onPress={save} />
        <ActionButton label="Delete transaction" onPress={confirmDelete} tone="muted" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: spacing.xs,
    textTransform: 'capitalize',
  },
  readOnlyAmount: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
    marginVertical: spacing.sm,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dateText: {
    color: palette.ink,
    fontSize: 16,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
