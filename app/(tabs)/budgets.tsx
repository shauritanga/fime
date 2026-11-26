import { Card, financeStyles, Muted, ProgressBar, Screen, Title } from '@/components/finance-ui';
import { palette, spacing } from '@/constants/theme';
import { currentPeriod, formatMoney, formatPeriod, periodFromISODate } from '@/lib/finance/format';
import { useFinance } from '@/lib/finance/useFinance';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// The "Insights" tab: figures for the current month only.
export default function InsightsTabScreen() {
  const { budgets, expenseCategories, summary, transactions } = useFinance();
  const period = currentPeriod();
  const monthName = formatPeriod(period);

  const monthExpenses = transactions.filter(
    (transaction) => transaction.type === 'expense' && periodFromISODate(transaction.date) === period
  );
  const spent = monthExpenses.reduce((sum, transaction) => sum + transaction.amount, 0);
  // `summary.expenses` also counts subscriptions that are due this month and not yet paid.
  const unpaidSubscriptions = Math.max(summary.expenses - spent, 0);
  const savedRate = summary.income > 0 ? summary.balance / summary.income : 0;

  const breakdown = expenseCategories
    .map((category) => ({
      category,
      total: monthExpenses
        .filter((transaction) => transaction.categoryId === category.id)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  // `progress` is capped at 100%, so compare the real ratios to find the tightest budget.
  const ratio = (budget: (typeof budgets)[number]) =>
    budget.limitAmount > 0 ? budget.spent / budget.limitAmount : 0;
  const tightest = [...budgets].sort((a, b) => ratio(b) - ratio(a))[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Title>Insights</Title>
          <Muted>{monthName}</Muted>
        </View>

        <Card tone="soft">
          {summary.income > 0 ? (
            <>
              <Text style={styles.cardTitle}>
                {summary.balance >= 0 ? 'Left from your income' : 'Spending above income'}
              </Text>
              <Text style={styles.bigNumber}>{formatMoney(Math.abs(summary.balance))}</Text>
              {summary.balance >= 0 ? (
                <>
                  <ProgressBar value={savedRate} color={palette.emerald} />
                  <Muted>{Math.round(savedRate * 100)}% of income not yet spent</Muted>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Spent so far</Text>
              <Text style={styles.bigNumber}>{formatMoney(summary.expenses)}</Text>
              <Muted>No income recorded this month, so there is no savings figure yet.</Muted>
            </>
          )}
          <View style={styles.totals}>
            <View style={financeStyles.row}>
              <Muted>Income</Muted>
              <Text style={styles.itemValue}>{formatMoney(summary.income)}</Text>
            </View>
            <View style={financeStyles.row}>
              <Muted>Spending</Muted>
              <Text style={styles.itemValue}>{formatMoney(summary.expenses)}</Text>
            </View>
            {unpaidSubscriptions > 0 ? (
              <Muted>Spending includes {formatMoney(unpaidSubscriptions)} of subscriptions still to pay.</Muted>
            ) : null}
          </View>
        </Card>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/insights/budgets')}
          style={({ pressed }) => pressed && styles.pressed}>
          <Card>
            <View style={financeStyles.row}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>Budget to watch</Text>
                <Muted>
                  {tightest
                    ? `${tightest.category.name}: ${formatMoney(tightest.spent)} of ${formatMoney(tightest.limitAmount)}`
                    : 'Set a budget to see which one is closest to its limit.'}
                </Muted>
                <Text style={styles.link}>View budgets ›</Text>
              </View>
              {tightest ? (
                <Text style={[styles.watchValue, ratio(tightest) >= 0.85 && styles.warning]}>
                  {Math.round(ratio(tightest) * 100)}%
                </Text>
              ) : null}
            </View>
          </Card>
        </Pressable>

        <Card>
          <Text style={styles.sectionTitle}>Where your money went</Text>
          {breakdown.length === 0 ? (
            <Muted>No expenses recorded in {monthName}.</Muted>
          ) : (
            breakdown.map((item) => (
              <View key={item.category.id} style={styles.breakdownRow}>
                <View style={financeStyles.row}>
                  <Text style={styles.itemTitle}>{item.category.name}</Text>
                  <Text style={styles.itemValue}>
                    {formatMoney(item.total)} · {Math.round((item.total / spent) * 100)}%
                  </Text>
                </View>
                <ProgressBar value={item.total / spent} color={item.category.color} />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  bigNumber: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  totals: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  flex: {
    flex: 1,
    paddingRight: spacing.md,
  },
  link: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  watchValue: {
    color: palette.emerald,
    fontSize: 26,
    fontWeight: '900',
  },
  warning: {
    color: palette.coral,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  breakdownRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  itemTitle: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 15,
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
});
