import { ChartRangeMenu } from '@/components/ChartRangeMenu';
import { Card, Muted } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { buildExpenseChartData } from '@/lib/finance/chart';
import { formatMoney } from '@/lib/finance/format';
import type { ExpenseChartRange, Transaction } from '@/lib/finance/types';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function ExpenseBarChart({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange] = useState<ExpenseChartRange>('weekly');
  const bars = useMemo(() => buildExpenseChartData(transactions, range), [range, transactions]);
  const total = bars.reduce((sum, bar) => sum + bar.total, 0);
  const max = Math.max(...bars.map((bar) => bar.total), 0);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.title}>Expense trend</Text>
          <Muted>{formatMoney(total)} spent</Muted>
        </View>
        <ChartRangeMenu value={range} onChange={setRange} />
      </View>

      {total === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No expenses yet</Text>
          <Muted>Add an expense to see this chart come alive.</Muted>
        </View>
      ) : (
        <View style={styles.chart}>
          {bars.map((bar) => {
            const height = max > 0 ? Math.max(10, (bar.total / max) * 112) : 10;

            return (
              <View key={bar.label} style={styles.barItem}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height }]} />
                </View>
                <Text style={styles.barLabel}>{bar.label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 2,
  },
  title: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
  },
  empty: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  chart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 7,
    height: 158,
    marginTop: spacing.md,
  },
  barItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  barTrack: {
    alignItems: 'center',
    backgroundColor: palette.background,
    borderRadius: radii.sm,
    height: 124,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    backgroundColor: palette.coral,
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    width: '100%',
  },
  barLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
  },
});
