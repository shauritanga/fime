import { ChartRangeMenu } from '@/components/ChartRangeMenu';
import { Card, Muted } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { buildIncomeExpenseTrendData } from '@/lib/finance/chart';
import { formatMoney } from '@/lib/finance/format';
import type { ExpenseChartRange, Transaction } from '@/lib/finance/types';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

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
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.title}>Income vs expenses</Text>
          <Muted>{formatMoney(incomeTotal - expenseTotal)} net movement</Muted>
        </View>
        <ChartRangeMenu value={range} onChange={setRange} />
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.emerald }]} />
          <Text style={styles.legendText}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.coral }]} />
          <Text style={styles.legendText}>Expenses</Text>
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
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];
    const next = points[index + 1] ?? point;
    const beforePrevious = points[index - 2] ?? previous;
    const controlOne = {
      x: previous.x + (point.x - beforePrevious.x) / 6,
      y: previous.y + (point.y - beforePrevious.y) / 6,
    };
    const controlTwo = {
      x: point.x - (next.x - previous.x) / 6,
      y: point.y - (next.y - previous.y) / 6,
    };

    return `${path} C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${point.x} ${point.y}`;
  }, '');
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
