import { Card, Muted } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { buildExpenseChartData } from '@/lib/finance/chart';
import { formatMoney } from '@/lib/finance/format';
import type { ExpenseChartRange, Transaction } from '@/lib/finance/types';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const ranges: Array<{ label: string; value: ExpenseChartRange }> = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

export function ExpenseBarChart({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange] = useState<ExpenseChartRange>('weekly');
  const bars = useMemo(() => buildExpenseChartData(transactions, range), [range, transactions]);
  const total = bars.reduce((sum, bar) => sum + bar.total, 0);
  const max = Math.max(...bars.map((bar) => bar.total), 0);

  return (
    <Card>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Expense trend</Text>
          <Muted>{formatMoney(total)} spent</Muted>
        </View>
        <View style={styles.segment}>
          {ranges.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setRange(item.value)}
              style={[styles.segmentItem, range === item.value && styles.segmentActive]}>
              <Text style={[styles.segmentText, range === item.value && styles.segmentTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
    gap: spacing.md,
  },
  title: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '800',
  },
  segment: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.sm,
    flexDirection: 'row',
    padding: 4,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  segmentActive: {
    backgroundColor: palette.emerald,
  },
  segmentText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: palette.white,
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
