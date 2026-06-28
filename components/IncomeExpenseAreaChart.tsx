import { Card, Muted } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { buildIncomeExpenseTrendData } from '@/lib/finance/chart';
import { formatMoney } from '@/lib/finance/format';
import type { ExpenseChartRange, Transaction } from '@/lib/finance/types';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

const ranges: Array<{ label: string; value: ExpenseChartRange }> = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

export function IncomeExpenseAreaChart({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange] = useState<ExpenseChartRange>('weekly');
  const points = useMemo(() => buildIncomeExpenseTrendData(transactions, range), [range, transactions]);
  const incomeTotal = points.reduce((sum, point) => sum + point.income, 0);
  const expenseTotal = points.reduce((sum, point) => sum + point.expense, 0);
  const max = Math.max(...points.flatMap((point) => [point.income, point.expense]), 0);
  const isEmpty = incomeTotal === 0 && expenseTotal === 0;
  const chart = useMemo(() => buildAreaPaths(points, max), [max, points]);

  return (
    <Card>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Income vs expenses</Text>
          <Muted>{formatMoney(incomeTotal - expenseTotal)} net movement</Muted>
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

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.emerald }]} />
          <Text style={styles.legendText}>Income {formatMoney(incomeTotal)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.coral }]} />
          <Text style={styles.legendText}>Expenses {formatMoney(expenseTotal)}</Text>
        </View>
      </View>

      {isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No trend data yet</Text>
          <Muted>Add income and expenses to compare movement here.</Muted>
        </View>
      ) : (
        <>
          <View style={styles.chart}>
            <Svg height="148" viewBox="0 0 320 148" width="100%">
              <Line stroke={palette.border} strokeWidth="1" x1="0" x2="320" y1="36" y2="36" />
              <Line stroke={palette.border} strokeWidth="1" x1="0" x2="320" y1="76" y2="76" />
              <Line stroke={palette.border} strokeWidth="1" x1="0" x2="320" y1="116" y2="116" />
              <Path d={chart.incomeArea} fill="rgba(19, 122, 91, 0.20)" />
              <Path d={chart.expenseArea} fill="rgba(217, 103, 78, 0.22)" />
              <Path d={chart.incomeLine} fill="none" stroke={palette.emerald} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              <Path d={chart.expenseLine} fill="none" stroke={palette.coral} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              {chart.incomePoints.map((point) => (
                <Circle cx={point.x} cy={point.y} fill={palette.emerald} key={`income-${point.x}`} r="3.5" />
              ))}
              {chart.expensePoints.map((point) => (
                <Circle cx={point.x} cy={point.y} fill={palette.coral} key={`expense-${point.x}`} r="3.5" />
              ))}
            </Svg>
          </View>
          <View style={styles.labels}>
            {points.map((point) => (
              <Text key={point.label} style={styles.pointLabel}>{point.label}</Text>
            ))}
          </View>
        </>
      )}
    </Card>
  );
}

function buildAreaPaths(points: ReturnType<typeof buildIncomeExpenseTrendData>, max: number) {
  const width = 320;
  const top = 14;
  const bottom = 132;
  const usableHeight = bottom - top;
  const denominator = Math.max(max, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const toY = (value: number) => bottom - (value / denominator) * usableHeight;
  const toPoint = (value: number, index: number) => ({
    x: points.length > 1 ? index * step : width / 2,
    y: toY(value),
  });
  const incomePoints = points.map((point, index) => toPoint(point.income, index));
  const expensePoints = points.map((point, index) => toPoint(point.expense, index));

  return {
    expenseArea: areaPath(expensePoints, bottom),
    expenseLine: linePath(expensePoints),
    expensePoints,
    incomeArea: areaPath(incomePoints, bottom),
    incomeLine: linePath(incomePoints),
    incomePoints,
  };
}

function linePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function areaPath(points: Array<{ x: number; y: number }>, bottom: number) {
  if (points.length === 0) {
    return '';
  }

  const line = linePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendItem: {
    alignItems: 'center',
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  legendDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
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
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 148,
    marginTop: spacing.md,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  pointLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
  },
});
