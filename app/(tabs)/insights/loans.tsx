import { ActionButton, insightFormStyles } from '@/components/insights-controls';
import { BottomSheet } from '@/components/BottomSheet';
import { Card, financeStyles, Muted, ProgressBar, Screen, Title } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { BudgetRequiredError } from '@/lib/finance/database';
import { formatMoney, formatShortDate, todayISO } from '@/lib/finance/format';
import { useFinance } from '@/lib/finance/useFinance';
import type { LoanProgress, LoanType } from '@/lib/finance/types';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function LoansScreen() {
  const { addLoan, loanActivities, loans, repayLoan, returnLoan } = useFinance();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [loanType, setLoanType] = useState<LoanType>('money');
  const [counterparty, setCounterparty] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<LoanProgress | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentDate, setRepaymentDate] = useState(todayISO());
  const [repaymentNote, setRepaymentNote] = useState('');

  const activityMap = useMemo(() => {
    const map = new Map<string, typeof loanActivities>();
    for (const activity of loanActivities) {
      const list = map.get(activity.loanId) ?? [];
      list.push(activity);
      map.set(activity.loanId, list);
    }
    return map;
  }, [loanActivities]);

  const moneyOutstanding = loans
    .filter((loan) => loan.type === 'money')
    .reduce((sum, loan) => sum + loan.remainingAmount, 0);
  const itemActiveCount = loans.filter((loan) => loan.type === 'item' && loan.status === 'active').length;
  const activityPreview = loanActivities.slice(0, 5);

  function openCreateSheet() {
    setLoanType('money');
    setCounterparty('');
    setTitle('');
    setAmount('');
    setDueDate(todayISO());
    setNotes('');
    setSheetOpen(true);
  }

  function openRepaymentSheet(loan: LoanProgress) {
    setSelectedLoan(loan);
    setRepaymentAmount(String(Math.max(loan.remainingAmount, 0) || loan.amount));
    setRepaymentDate(todayISO());
    setRepaymentNote(`Repayment for ${loan.title}`);
    setActionSheetOpen(true);
  }

  function openReturnSheet(loan: LoanProgress) {
    setSelectedLoan(loan);
    setRepaymentDate(todayISO());
    setRepaymentNote(`Returned ${loan.title}`);
    setActionSheetOpen(true);
  }

  function handleBudgetRequirement(error: unknown) {
    if (!(error instanceof BudgetRequiredError)) {
      return false;
    }

    Alert.alert(
      'Budget required',
      `Create a budget for the Loan repayment category before recording a repayment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open budgets',
          onPress: () => router.push('/insights/budgets'),
        },
      ]
    );
    return true;
  }

  async function saveLoan() {
    const value = Number(amount.replace(/,/g, ''));
    if (!counterparty.trim() || !title.trim() || value <= 0 || !dueDate.trim()) {
      Alert.alert('Missing loan details', 'Enter a counterparty, title, amount, and due date.');
      return;
    }

    try {
      await addLoan({
        amount: value,
        counterparty: counterparty.trim(),
        dueDate,
        notes: notes.trim(),
        title: title.trim(),
        type: loanType,
      });

      setSheetOpen(false);
      Alert.alert('Saved', 'Loan added.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the loan.';
      Alert.alert('Could not save', message);
    }
  }

  async function saveLoanAction() {
    if (!selectedLoan) {
      return;
    }

    try {
      if (selectedLoan.type === 'money') {
        const value = Number(repaymentAmount.replace(/,/g, ''));
        if (!value || value <= 0) {
          Alert.alert('Missing repayment', 'Enter a repayment amount.');
          return;
        }

        await repayLoan(selectedLoan.id, value, repaymentDate, repaymentNote.trim());
        Alert.alert('Saved', 'Repayment recorded as an expense.');
      } else {
        await returnLoan(selectedLoan.id, repaymentDate, repaymentNote.trim());
        Alert.alert('Saved', 'Item marked as returned.');
      }
      setActionSheetOpen(false);
      setSelectedLoan(null);
    } catch (error) {
      if (handleBudgetRequirement(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Could not save the loan action.';
      Alert.alert('Could not save', message);
    }
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Title>Loans</Title>
          <Muted>Track borrowed money, borrowed items, and repayment history.</Muted>
        </View>

        <View style={styles.metrics}>
          <Card tone="soft">
            <Text style={styles.metricLabel}>Money outstanding</Text>
            <Text style={styles.metricValue}>{formatMoney(moneyOutstanding)}</Text>
          </Card>
          <Card>
            <Text style={styles.metricLabel}>Active item loans</Text>
            <Text style={styles.metricValue}>{itemActiveCount}</Text>
          </Card>
        </View>

        <Card>
          <Muted>
            Repayments use the <Text style={styles.inlineEmphasis}>Loan repayment</Text> expense category and require a budget first.
          </Muted>
        </Card>

        {loans.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No loans yet</Text>
            <Muted>Add a borrowed cash or item loan to start tracking it here.</Muted>
          </Card>
        ) : (
          loans.map((loan) => {
            const latestActivity = activityMap.get(loan.id)?.[0];
            const isMoney = loan.type === 'money';
            const isActive = loan.status === 'active';
            const statusLabel =
              loan.status === 'repaid'
                ? 'Repaid'
                : loan.status === 'returned'
                  ? 'Returned'
                  : isMoney
                    ? `${formatMoney(loan.remainingAmount)} remaining`
                    : 'Awaiting return';

            return (
              <Card key={loan.id}>
                <View style={financeStyles.row}>
                  <View style={styles.loanCopy}>
                    <Text style={styles.loanTitle}>{loan.title}</Text>
                    <Muted>
                      {loan.counterparty} · due {formatShortDate(loan.dueDate)}
                    </Muted>
                  </View>
                  <View style={[styles.typeBadge, loan.type === 'money' ? styles.moneyBadge : styles.itemBadge]}>
                    <Text style={styles.typeBadgeText}>{loan.type === 'money' ? 'Money' : 'Item'}</Text>
                  </View>
                </View>

                <View style={styles.amountRow}>
                  <Text style={styles.amount}>{formatMoney(loan.amount)}</Text>
                  <Text style={loan.status === 'active' ? styles.activeStatus : styles.doneStatus}>{statusLabel}</Text>
                </View>

                {isMoney && (
                  <View style={styles.progressSpacing}>
                    <ProgressBar value={loan.progress} color={palette.emerald} />
                  </View>
                )}

                {!!latestActivity && <Muted>{latestActivity.note} · {formatShortDate(latestActivity.date)}</Muted>}

                {isActive && (
                  <Pressable
                    onPress={() => (loan.type === 'money' ? openRepaymentSheet(loan) : openReturnSheet(loan))}
                    style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
                    <Text style={styles.actionText}>{loan.type === 'money' ? 'Record repayment' : 'Mark returned'}</Text>
                  </Pressable>
                )}
              </Card>
            );
          })
        )}

        {activityPreview.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Recent loan activity</Text>
            {activityPreview.map((activity) => (
              <View key={activity.id} style={styles.activityRow}>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityTitle}>
                    {activity.type === 'repayment' ? 'Repayment' : 'Return'}
                  </Text>
                  <Muted>{activity.note}</Muted>
                </View>
                <Text style={styles.activityAmount}>
                  {activity.type === 'repayment' ? formatMoney(activity.amount) : formatShortDate(activity.date)}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      <Pressable onPress={openCreateSheet} style={styles.fab}>
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={palette.white} size={30} />
      </Pressable>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <View style={styles.sheetCopy}>
            <Text style={styles.sheetTitle}>Add loan</Text>
            <Muted>Track borrowed money or items with the same flow.</Muted>
          </View>
          <Pressable onPress={() => setSheetOpen(false)} style={styles.closeButton}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.ink} size={22} />
          </Pressable>
        </View>

        <View style={insightFormStyles.segment}>
          {(['money', 'item'] as LoanType[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => setLoanType(item)}
              style={[insightFormStyles.segmentItem, loanType === item && insightFormStyles.segmentActive]}>
              <Text style={[insightFormStyles.segmentText, loanType === item && insightFormStyles.segmentTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          placeholder="Counterparty"
          placeholderTextColor={palette.muted}
          style={insightFormStyles.input}
          value={counterparty}
          onChangeText={setCounterparty}
        />
        <TextInput
          placeholder={loanType === 'money' ? 'Loan title' : 'Item name'}
          placeholderTextColor={palette.muted}
          style={insightFormStyles.input}
          value={title}
          onChangeText={setTitle}
        />
        <View style={insightFormStyles.twoColumn}>
          <TextInput
            keyboardType="numeric"
            placeholder={loanType === 'money' ? 'Amount borrowed' : 'Estimated value'}
            placeholderTextColor={palette.muted}
            style={insightFormStyles.inputFlex}
            value={amount}
            onChangeText={setAmount}
          />
          <TextInput
            placeholder="Due date"
            placeholderTextColor={palette.muted}
            style={insightFormStyles.inputFlex}
            value={dueDate}
            onChangeText={setDueDate}
          />
        </View>
        <TextInput
          multiline
          placeholder="Notes"
          placeholderTextColor={palette.muted}
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
        />
        <ActionButton label="Save loan" onPress={saveLoan} />
      </BottomSheet>

      <BottomSheet visible={actionSheetOpen} onClose={() => setActionSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <View style={styles.sheetCopy}>
            <Text style={styles.sheetTitle}>
              {selectedLoan?.type === 'money' ? 'Record repayment' : 'Mark as returned'}
            </Text>
            <Muted>
              {selectedLoan?.type === 'money'
                ? 'Repayment posts as an expense under Loan repayment.'
                : 'Return the item and keep the history in the loan timeline.'}
            </Muted>
          </View>
          <Pressable onPress={() => setActionSheetOpen(false)} style={styles.closeButton}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.ink} size={22} />
          </Pressable>
        </View>

        {selectedLoan?.type === 'money' && (
          <TextInput
            keyboardType="numeric"
            placeholder={`Remaining ${formatMoney(selectedLoan.remainingAmount)}`}
            placeholderTextColor={palette.muted}
            style={insightFormStyles.input}
            value={repaymentAmount}
            onChangeText={setRepaymentAmount}
          />
        )}
        <View style={insightFormStyles.twoColumn}>
          <TextInput
            placeholder="Date"
            placeholderTextColor={palette.muted}
            style={insightFormStyles.inputFlex}
            value={repaymentDate}
            onChangeText={setRepaymentDate}
          />
          <TextInput
            placeholder="Note"
            placeholderTextColor={palette.muted}
            style={insightFormStyles.inputFlex}
            value={repaymentNote}
            onChangeText={setRepaymentNote}
          />
        </View>

        <ActionButton
          label={selectedLoan?.type === 'money' ? 'Save repayment' : 'Mark returned'}
          onPress={saveLoanAction}
        />
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
  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  metricValue: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  inlineEmphasis: {
    color: palette.ink,
    fontWeight: '900',
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  loanCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  loanTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  moneyBadge: {
    backgroundColor: palette.emeraldSoft,
  },
  itemBadge: {
    backgroundColor: palette.goldSoft,
  },
  typeBadgeText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  amountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  amount: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  activeStatus: {
    color: palette.emerald,
    fontSize: 12,
    fontWeight: '900',
  },
  doneStatus: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  progressSpacing: {
    marginVertical: spacing.sm,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: radii.sm,
    marginTop: spacing.md,
    paddingVertical: 12,
  },
  actionText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.82,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  activityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  activityCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  activityTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
  },
  activityAmount: {
    color: palette.ink,
    fontSize: 13,
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
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetCopy: {
    flex: 1,
    paddingRight: spacing.md,
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
  notesInput: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    minHeight: 84,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
});
