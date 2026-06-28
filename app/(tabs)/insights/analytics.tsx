import { Card, financeStyles, Muted, ProgressBar, Screen, Title } from '@/components/finance-ui';
import { palette, spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/finance/format';
import { useFinance } from '@/lib/finance/useFinance';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AnalyticsScreen() {
  const { budgets, expenseCategories, summary, transactions } = useFinance();
  const topBudget = budgets[0];
  const netRate = summary.income > 0 ? summary.balance / summary.income : 0;
  const analytics = useMemo(() => {
    return expenseCategories
      .map((category) => {
        const total = transactions
          .filter((transaction) => transaction.type === 'expense' && transaction.categoryId === category.id)
          .reduce((sum, transaction) => sum + transaction.amount, 0);
        return { category, total };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [expenseCategories, transactions]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Title>Analytics</Title>
          <Muted>Savings pace, watchlist, and spending concentration.</Muted>
        </View>

        <Card tone="soft">
          <Text style={styles.insightTitle}>Savings pace</Text>
          <Text style={styles.bigNumber}>{Math.round(netRate * 100)}%</Text>
          <ProgressBar value={netRate} color={palette.emerald} />
          <Muted>{formatMoney(summary.balance)} kept from {formatMoney(summary.income)} income.</Muted>
        </Card>

        <Card>
          <View style={financeStyles.row}>
            <View style={styles.flex}>
              <Text style={styles.insightTitle}>Watchlist</Text>
              <Muted>
                {topBudget
                  ? `${topBudget.category.name} is your closest budget to the limit.`
                  : 'Create a budget to unlock watchlist signals.'}
              </Muted>
            </View>
            <Text style={styles.watchValue}>{topBudget ? `${Math.round(topBudget.progress * 100)}%` : '0%'}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Spending breakdown</Text>
          {analytics.length === 0 ? (
            <Muted>Add expenses to see category analytics.</Muted>
          ) : (
            analytics.map((item) => (
              <View key={item.category.id} style={styles.analyticsRow}>
                <View style={financeStyles.row}>
                  <Text style={styles.itemTitle}>{item.category.name}</Text>
                  <Text style={styles.itemValue}>{formatMoney(item.total)}</Text>
                </View>
                <ProgressBar value={item.total / Math.max(summary.expenses, 1)} color={item.category.color} />
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
  insightTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  bigNumber: {
    color: palette.ink,
    fontSize: 44,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  flex: {
    flex: 1,
    paddingRight: spacing.md,
  },
  watchValue: {
    color: palette.coral,
    fontSize: 26,
    fontWeight: '900',
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  analyticsRow: {
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
});
