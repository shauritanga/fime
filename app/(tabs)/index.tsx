import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExpenseBarChart } from '@/components/ExpenseBarChart';
import { IncomeExpenseAreaChart } from '@/components/IncomeExpenseAreaChart';
import { TransactionCard } from '@/components/TransactionCard';
import { Card, financeStyles, Muted, ProgressBar, Screen } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatMoney, formatShortDate } from '@/lib/finance/format';
import { useFinance } from '@/lib/finance/useFinance';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

export default function HomeScreen() {
  const { profile } = useAuth();
  const { budgets, categories, loading, summary, transactions } = useFinance();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const budgetRatio = summary.budgetLimit > 0 ? summary.budgetSpent / summary.budgetLimit : 0;
  const selectedDateISO = toISODate(selectedDate);
  const dateStrip = buildDateStrip(selectedDate);
  const selectedDaySpent = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.date === selectedDateISO && transaction.type === 'expense')
        .reduce((total, transaction) => total + transaction.amount, 0),
    [selectedDateISO, transactions]
  );
  const selectedTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.date === selectedDateISO),
    [selectedDateISO, transactions]
  );
  const alertCount = budgets.filter((budget) => budget.progress >= 0.85).length;
  const budgetRemaining = summary.budgetLimit - summary.budgetSpent;

  function openProfile() {
    router.push('./profile');
  }

  function openNotifications() {
    if (alertCount === 0) {
      Alert.alert('Notifications', 'No budget alerts right now.');
      return;
    }

    const alerts = budgets
      .filter((budget) => budget.progress >= 0.85)
      .map((budget) => `${budget.category.name}: ${Math.round(budget.progress * 100)}% used`)
      .join('\n');
    Alert.alert('Budget alerts', alerts);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.homeHeader}>
          <View style={styles.profileRow}>
            <Pressable onPress={openProfile} style={styles.profileButton}>
              <View style={styles.avatar}>
                {profile?.imageUri ? (
                  <Image source={{ uri: profile.imageUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{profile?.initials ?? 'FI'}</Text>
                )}
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.welcome}>Welcome Back</Text>
                <Text style={styles.userName} numberOfLines={1}>{profile?.name ?? 'Fime user'}</Text>
              </View>
            </Pressable>
            <Pressable onPress={openNotifications} style={styles.iconButton}>
              <SymbolView
                name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
                tintColor={palette.emerald}
                size={24}
              />
              {alertCount > 0 && <View style={styles.alertDot} />}
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Text style={styles.monthText}>
              {new Intl.DateTimeFormat('en-TZ', { month: 'long', year: 'numeric' }).format(selectedDate)}
            </Text>
            <Pressable onPress={() => setSelectedDate(new Date())} style={styles.calendarButton}>
              <SymbolView
                name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
                tintColor={palette.emerald}
                size={24}
              />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
            {dateStrip.map((date) => (
              <Pressable
                key={date.iso}
                onPress={() => setSelectedDate(new Date(`${date.iso}T12:00:00`))}
                style={[styles.dateTile, date.iso === selectedDateISO && styles.dateTileActive]}>
                <Text style={[styles.dateDay, date.iso === selectedDateISO && styles.dateTextActive]}>{date.day}</Text>
                <Text style={[styles.dateNumber, date.iso === selectedDateISO && styles.dateTextActive]}>{date.number}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Card tone="dark">
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balance}>{formatMoney(summary.balance)}</Text>
          <View style={styles.summaryGrid}>
            <View>
              <Text style={styles.darkLabel}>Income this month</Text>
              <Text style={styles.darkValue}>{formatMoney(summary.income)}</Text>
            </View>
            <View>
              <Text style={styles.darkLabel}>Savings bucket</Text>
              <Text style={styles.darkValue}>{formatMoney(summary.savingsBalance)}</Text>
            </View>
          </View>
          <View style={styles.daySpendRow}>
            <Text style={styles.darkLabel}>Selected day spent</Text>
            <Text style={styles.daySpendValue}>{formatMoney(selectedDaySpent)}</Text>
          </View>
        </Card>

        <View style={styles.metrics}>
          <Card>
            <View style={styles.budgetHeader}>
              <View>
                <Text style={styles.budgetTitle}>Budget usage</Text>
                <Muted>{formatMoney(summary.budgetSpent)} of {formatMoney(summary.budgetLimit)} planned</Muted>
              </View>
              <Text style={[styles.budgetPercent, budgetRatio > 0.85 && styles.budgetPercentWarning]}>
                {summary.budgetLimit > 0 ? `${Math.round(budgetRatio * 100)}%` : '0%'}
              </Text>
            </View>
            <ProgressBar value={budgetRatio} color={budgetRatio > 0.85 ? palette.coral : palette.emerald} />
            <Text style={[styles.budgetCaption, budgetRemaining < 0 && styles.budgetCaptionWarning]}>
              {summary.budgetLimit > 0
                ? budgetRemaining >= 0
                  ? `${formatMoney(budgetRemaining)} remaining this month`
                  : `${formatMoney(Math.abs(budgetRemaining))} over monthly budget`
                : 'Add a budget to start tracking this month.'}
            </Text>
          </Card>
          <Card tone="soft">
            <Muted>Highest budget</Muted>
            <Text style={styles.focusText}>{budgets[0]?.category.name ?? 'No budget yet'}</Text>
            <Muted>{budgets[0] ? `${Math.round(budgets[0].progress * 100)}% used` : 'Add a budget to start tracking.'}</Muted>
          </Card>
        </View>

        <ExpenseBarChart transactions={transactions} />
        <IncomeExpenseAreaChart transactions={transactions} />

        <View style={financeStyles.row}>
          <View>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Text style={styles.selectedDateLabel}>{formatShortDate(selectedDateISO)}</Text>
          </View>
          <Pressable onPress={() => router.push('/transactions')}>
            <Text style={styles.seeAll}>{loading ? 'Loading' : 'See All'}</Text>
          </Pressable>
        </View>

        {selectedTransactions.length === 0 && (
          <Card>
            <Text style={styles.emptyTitle}>No activity for this date</Text>
            <Muted>Select another day or add a transaction for this date.</Muted>
          </Card>
        )}

        {selectedTransactions.slice(0, 5).map((transaction) => {
          const category = categoryMap.get(transaction.categoryId);
          return <TransactionCard category={category} key={transaction.id} transaction={transaction} />;
        })}
      </ScrollView>
    </Screen>
  );
}

function buildDateStrip(today: Date) {
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 2 + index);

    return {
      day: new Intl.DateTimeFormat('en-TZ', { weekday: 'short' }).format(date).toUpperCase(),
      iso: toISODate(date),
      number: date.getDate(),
    };
  });
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  homeHeader: {
    gap: spacing.lg,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  profileButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.slate,
    borderRadius: 999,
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 50,
  },
  avatarText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '900',
  },
  avatarImage: {
    borderRadius: 999,
    height: '100%',
    width: '100%',
  },
  profileCopy: {
    flex: 1,
  },
  welcome: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  userName: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 3,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
  alertDot: {
    backgroundColor: palette.coral,
    borderColor: palette.surface,
    borderRadius: 999,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: 12,
    top: 12,
    width: 12,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthText: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  calendarButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  dateStrip: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  dateTile: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.lg,
    height: 92,
    justifyContent: 'center',
    width: 72,
  },
  dateTileActive: {
    backgroundColor: palette.emerald,
  },
  dateDay: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  dateNumber: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  dateTextActive: {
    color: palette.white,
  },
  balanceLabel: {
    color: '#CAD8D2',
    fontSize: 14,
    fontWeight: '700',
  },
  balance: {
    color: palette.white,
    fontSize: 38,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  summaryGrid: {
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  darkLabel: {
    color: '#B8C6C0',
    fontSize: 12,
    fontWeight: '700',
  },
  darkValue: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  daySpendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  daySpendValue: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
  },
  metrics: {
    gap: spacing.md,
  },
  budgetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  budgetTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 3,
  },
  budgetPercent: {
    color: palette.emerald,
    fontSize: 18,
    fontWeight: '900',
  },
  budgetPercentWarning: {
    color: palette.coral,
  },
  budgetCaption: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  budgetCaptionWarning: {
    color: palette.coral,
  },
  focusText: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
    marginVertical: spacing.sm,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  seeAll: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '900',
  },
  selectedDateLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  income: {
    color: palette.emerald,
    fontSize: 15,
    fontWeight: '900',
  },
  expense: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: '900',
  },
});
