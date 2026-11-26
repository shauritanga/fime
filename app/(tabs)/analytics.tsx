import {
  Donut,
  expenseColor,
  incomeColor,
  IncomeExpenseBars,
  MiniBars,
  StripedBar,
} from '@/components/analytics/charts';
import { Muted, ProgressBar, Screen } from '@/components/finance-ui';
import { MonthPickerSheet } from '@/components/MonthPickerSheet';
import { PopupMenu } from '@/components/PopupMenu';
import { palette, radii, spacing } from '@/constants/theme';
import {
  budgetReport,
  categoryBreakdown,
  change,
  compactNumber,
  daySeries,
  donutSlices,
  inMonth,
  monthSeries,
  sumTotals,
  type CategorySpend,
  type Range,
} from '@/lib/finance/analytics';
import { listBudgets, listSavedBudgets } from '@/lib/finance/database';
import { currentPeriod, formatMoney, formatPeriod, shiftPeriod, todayISO } from '@/lib/finance/format';
import type { Budget } from '@/lib/finance/types';
import { useFinance } from '@/lib/finance/useFinance';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { PropsWithChildren, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type Tab = 'overview' | 'categories' | 'budget';

type IconName = SymbolViewProps['name'];

const tabs: Array<{ label: string; value: Tab }> = [
  { label: 'Overview', value: 'overview' },
  { label: 'Categories', value: 'categories' },
  { label: 'Budget', value: 'budget' },
];
const ranges: Array<{ label: string; value: Range }> = [
  { label: 'Days of the month', value: 'days' },
  { label: 'Last 7 months', value: 'months' },
  { label: 'Last 12 months', value: 'year' },
];
type Sort = 'amount' | 'count';
const sorts: Array<{ label: string; value: Sort }> = [
  { label: 'Highest amount', value: 'amount' },
  { label: 'Most entries', value: 'count' },
];

export default function AnalyticsScreen() {
  const db = useSQLiteContext();
  const { categories, loading, transactions } = useFinance();
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState(currentPeriod());
  const [pickingMonth, setPickingMonth] = useState(false);
  const [budgets, setBudgets] = useState<{ period: string; items: Budget[] } | null>(null);

  const thisPeriod = currentPeriod();
  const today = todayISO();
  const periods = [...new Set(transactions.map((item) => item.date.slice(0, 7)))].sort();
  const earliest = periods[0] && periods[0] < thisPeriod ? periods[0] : thisPeriod;
  const latest = periods[periods.length - 1] ?? thisPeriod;

  // Reloaded whenever the data refreshes, which happens each time the tab is opened.
  useEffect(() => {
    let active = true;
    // Only the running month inherits limits; looking back shows what was actually set.
    const read = period === currentPeriod() ? listBudgets(db, period) : listSavedBudgets(db, period);
    read
      .then((items) => active && setBudgets({ period, items }))
      .catch((error) => console.warn('Unable to load budgets', error));
    return () => {
      active = false;
    };
  }, [db, period, transactions]);

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <RoundButton
            icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            label="Back to Home"
            onPress={() => router.navigate('/')}
          />
          <Text style={styles.screenTitle}>Analytics</Text>
          <RoundButton
            icon={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
            label={`Choose month, now ${formatPeriod(period)}`}
            onPress={() => setPickingMonth(true)}
          />
        </View>

        <Segments items={tabs} onChange={setTab} value={tab} />

        {loading ? (
          <Muted>Loading your figures…</Muted>
        ) : tab === 'overview' ? (
          <Overview
            categories={categoryBreakdown(transactions, categories, period, today)}
            key={period}
            period={period}
            today={today}
            transactions={transactions}
          />
        ) : tab === 'categories' ? (
          <Categories items={categoryBreakdown(transactions, categories, period, today)} period={period} today={today} />
        ) : budgets?.period === period ? (
          <BudgetTab
            isCurrent={period === thisPeriod}
            report={budgetReport(budgets.items, transactions, categories, period, today)}
          />
        ) : null}
      </ScrollView>

      {pickingMonth ? (
        <MonthPickerSheet
          maxPeriod={latest > thisPeriod ? latest : thisPeriod}
          minPeriod={earliest}
          onClose={() => setPickingMonth(false)}
          onSelect={(next) => {
            setPeriod(next);
            setPickingMonth(false);
          }}
          periodsWithData={periods}
          selected={period}
        />
      ) : null}
    </Screen>
  );
}

function Overview({
  categories,
  period,
  today,
  transactions,
}: {
  categories: CategorySpend[];
  period: string;
  today: string;
  transactions: Parameters<typeof sumTotals>[0];
}) {
  const [range, setRange] = useState<Range>('months');
  const [sort, setSort] = useState<Sort>('amount');
  const points =
    range === 'days'
      ? daySeries(transactions, period, today)
      : monthSeries(transactions, period, range === 'year' ? 12 : 7);

  const totals = sumTotals(inMonth(transactions, period));
  const trend = monthSeries(transactions, period, 7);
  const rate = totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : null;
  const overspent = totals.net < 0;
  const top = [...categories].sort((a, b) => b[sort] - a[sort]).slice(0, 4);

  return (
    <>
      <SectionHeader menuLabel="Chart range" onChange={setRange} options={ranges} title="Income vs Expenses" value={range} />
      <Panel>
        {/* Remounted per range, so a selected bar doesn't carry over. */}
        <IncomeExpenseBars caption={formatPeriod(period)} key={range} points={points} />
      </Panel>

      <View style={styles.tiles}>
        <StatTile
          color={incomeColor}
          icon={{ ios: 'arrow.up.right', android: 'trending_up', web: 'trending_up' }}
          label="Income"
          trend={trend.map((item) => item.income)}
          value={totals.income}
        />
        <StatTile
          color={expenseColor}
          icon={{ ios: 'arrow.down.right', android: 'trending_down', web: 'trending_down' }}
          label="Expenses"
          trend={trend.map((item) => item.expense)}
          value={totals.expense}
        />
      </View>

      <Panel style={styles.savedRow}>
        <IconBubble icon={{ ios: 'banknote', android: 'savings', web: 'savings' }} />
        <Text style={styles.tileLabel}>{overspent ? 'Overspent' : 'Saved'}</Text>
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[styles.savedValue, { color: overspent ? palette.coral : incomeColor }]}>
          {overspent ? `TSh ${compactNumber(-totals.net)}` : rate === null ? '—' : `${rate}%`}
        </Text>
        <MiniBars color={incomeColor} values={trend.map((item) => Math.max(item.net, 0))} />
      </Panel>

      <SectionHeader menuLabel="Sort categories" onChange={setSort} options={sorts} title="Top categories" value={sort} />
      {top.length === 0 ? (
        <Panel>
          <Muted>No expenses recorded in {formatPeriod(period)}.</Muted>
        </Panel>
      ) : (
        top.map((item) => <CategoryRow item={item} key={item.id} />)
      )}
    </>
  );
}

function Categories({ items, period, today }: { items: CategorySpend[]; period: string; today: string }) {
  if (items.length === 0) {
    return (
      <Panel>
        <Text style={styles.sectionTitle}>No spending yet</Text>
        <Muted>Expenses in {formatPeriod(period)} will be broken down here.</Muted>
      </Panel>
    );
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const slices = donutSlices(items);
  // The biggest rise against last month is the thing most worth knowing.
  const rise = [...items]
    .filter((item) => item.previous > 0 && item.amount > item.previous)
    .sort((a, b) => b.amount - b.previous - (a.amount - a.previous))[0];
  const against = today.startsWith(period) ? 'the same days last month' : formatPeriod(shiftPeriod(period, -1));
  const top = items[0];

  return (
    <>
      <Panel>
        <Text style={styles.sectionTitle}>Spending breakdown</Text>
        <Donut centerLabel="Total" centerValue={formatMoney(total)} slices={slices} />
        <View style={styles.legendList}>
          {slices.map((slice) => (
            <Legend color={slice.color} key={slice.id} label={slice.name} value={`${Math.round(slice.share * 100)}%`} />
          ))}
        </View>
      </Panel>

      <Panel style={styles.highlight}>
        <Text style={styles.insightTitle}>
          {rise
            ? `${rise.name} is ${change(rise.amount, rise.previous)}% higher`
            : `${top.name} is your biggest expense`}
        </Text>
        <Muted>
          {rise
            ? `${formatMoney(rise.amount)}, up ${formatMoney(rise.amount - rise.previous)} on ${against}.`
            : `${formatMoney(top.amount)}, ${Math.round(top.share * 100)}% of spending, across ${top.count} ${top.count === 1 ? 'entry' : 'entries'}.`}
        </Muted>
      </Panel>

      <Text style={styles.sectionTitle}>All categories</Text>
      {items.map((item) => (
        <CategoryRow item={item} key={item.id} showChange />
      ))}
    </>
  );
}

function BudgetTab({ isCurrent, report }: { isCurrent: boolean; report: ReturnType<typeof budgetReport> }) {
  const used = report.limit > 0 ? report.spent / report.limit : 0;
  const left = report.limit - report.spent;

  return (
    <>
      {report.lines.length === 0 ? (
        <Panel>
          <Text style={styles.sectionTitle}>No budgets</Text>
          <Muted>
            {isCurrent ? 'Set a monthly limit to track it here.' : 'No budgets were set for this month.'}
          </Muted>
        </Panel>
      ) : (
        <Panel style={styles.highlight}>
          <Text style={styles.tileLabel}>{left >= 0 ? 'Left to spend' : 'Over budget'}</Text>
          <Text style={[styles.amount, left < 0 && styles.negative]}>{formatMoney(Math.abs(left))}</Text>
          <View style={styles.barSpace}>
            <ProgressBar color={left < 0 ? palette.coral : palette.emerald} value={used} />
          </View>
          <Muted>
            {formatMoney(report.spent)} of {formatMoney(report.limit)} used ({Math.round(used * 100)}%)
          </Muted>
          {report.projected !== null ? (
            <Muted>
              At this pace you would spend about {formatMoney(report.projected)} by month end
              {report.projected > report.limit ? `, ${formatMoney(report.projected - report.limit)} over.` : ', within budget.'}
            </Muted>
          ) : null}
        </Panel>
      )}

      {report.lines.map((line) => (
        <Panel key={line.id}>
          <View style={styles.sectionRow}>
            <Text style={styles.itemTitle}>{line.name}</Text>
            <Text style={[styles.status, line.status !== 'ok' && styles.negative]}>
              {line.status === 'over' ? '⚠ Over' : line.status === 'close' ? '⚠ Almost used' : '✓ On track'}
            </Text>
          </View>
          <View style={styles.barSpace}>
            <ProgressBar
              color={line.status === 'ok' ? palette.emerald : palette.coral}
              value={line.limit > 0 ? line.spent / line.limit : 0}
            />
          </View>
          <Muted>
            {formatMoney(line.spent)} of {formatMoney(line.limit)} ·{' '}
            {line.spent > line.limit
              ? `${formatMoney(line.spent - line.limit)} over`
              : `${formatMoney(line.limit - line.spent)} left`}
          </Muted>
        </Panel>
      ))}

      {report.unbudgeted.length > 0 ? (
        <Panel>
          <Text style={styles.itemTitle}>Spending without a budget</Text>
          {report.unbudgeted.map((item) => (
            <Legend color={item.color} key={item.id} label={item.name} value={formatMoney(item.amount)} />
          ))}
        </Panel>
      ) : null}

      {isCurrent ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/insights/budgets')}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Manage budgets</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function Segments<T extends string>({
  items,
  onChange,
  value,
}: {
  items: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
  value: T;
}) {
  return (
    <View style={styles.segment}>
      {items.map((item) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: item.value === value }}
          key={item.value}
          onPress={() => onChange(item.value)}
          style={[styles.segmentItem, item.value === value && styles.segmentActive]}>
          <Text style={[styles.segmentText, item.value === value && styles.segmentTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function StatTile({
  color,
  icon,
  label,
  trend,
  value,
}: {
  color: string;
  icon: IconName;
  label: string;
  trend: number[];
  value: number;
}) {
  return (
    <Panel style={styles.tile}>
      <View accessible accessibilityLabel={`${label} ${formatMoney(value)}`}>
        <View style={styles.tileHeading}>
          <IconBubble icon={icon} />
          <Text style={styles.tileLabel}>{label}</Text>
        </View>
        <View style={styles.tileBottom}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.tileValue, { color }]}>
            TSh {compactNumber(value)}
          </Text>
          <MiniBars color={color} values={trend} />
        </View>
      </View>
    </Panel>
  );
}

function CategoryRow({ item, showChange }: { item: CategorySpend; showChange?: boolean }) {
  const difference = change(item.amount, item.previous);

  return (
    <Panel style={styles.categoryRow}>
      <View style={[styles.categoryIcon, { backgroundColor: `${item.color}22` }]}>
        <Text allowFontScaling={false} style={styles.categoryEmoji}>
          {item.emoji}
        </Text>
      </View>
      <View style={styles.categoryCopy}>
        <View style={styles.sectionRow}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.name}
          </Text>
          <Text style={styles.itemValue}>{formatMoney(item.amount)}</Text>
        </View>
        <StripedBar color={item.color} value={item.share} />
        {showChange ? (
          <Text style={styles.tileNote}>
            {Math.round(item.share * 100)}% of spending
            {difference === null
              ? ''
              : ` · ${difference === 0 ? 'no change' : `${difference > 0 ? '▲' : '▼'} ${Math.abs(difference)}%`}`}
          </Text>
        ) : null}
      </View>
    </Panel>
  );
}

/** The white, borderless card used throughout this screen. */
function Panel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

function IconBubble({ icon }: { icon: IconName }) {
  return (
    <View style={styles.iconBubble}>
      <SymbolView name={icon} tintColor={palette.ink} size={18} />
    </View>
  );
}

function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
      <SymbolView name={icon} tintColor={palette.ink} size={22} />
    </Pressable>
  );
}

/** A section title with a round button that opens its choices. */
function SectionHeader<T extends string>({
  menuLabel,
  onChange,
  options,
  title,
  value,
}: {
  menuLabel: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  title: string;
  value: T;
}) {
  return (
    <View style={[styles.sectionRow, styles.sectionHeader]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <PopupMenu
        accessibilityLabel={menuLabel}
        buttonStyle={styles.filterButton}
        onChange={onChange}
        options={options}
        value={value}>
        <SymbolView name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }} tintColor={palette.muted} size={18} />
      </PopupMenu>
    </View>
  );
}

/** A coloured dot beside a name and figure, so colour is never the only clue. */
function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const shadow = {
  elevation: 1,
  shadowColor: palette.slate,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#F5F8F6',
  },
  content: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  screenTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  roundButton: {
    ...shadow,
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pressed: {
    opacity: 0.7,
  },
  panel: {
    ...shadow,
    backgroundColor: palette.white,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  highlight: {
    backgroundColor: palette.emeraldSoft,
  },
  segment: {
    ...shadow,
    backgroundColor: palette.white,
    borderRadius: 999,
    flexDirection: 'row',
    marginBottom: spacing.xs,
    padding: 5,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  segmentActive: {
    backgroundColor: palette.surfaceMuted,
  },
  segmentText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: palette.ink,
    fontWeight: '900',
  },
  sectionHeader: {
    marginTop: spacing.xs,
    // Keeps its popup menu above the cards below.
    zIndex: 10,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  legendList: {
    marginTop: spacing.md,
  },
  dot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  legendLabel: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  legendValue: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
  },
  tileHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tileBottom: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  tileLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  tileValue: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '900',
  },
  tileNote: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  savedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  savedValue: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    marginLeft: spacing.xs,
  },
  amount: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 2,
  },
  negative: {
    color: palette.coral,
  },
  insightTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  categoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  categoryCopy: {
    flex: 1,
    gap: 6,
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
  status: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '900',
  },
  barSpace: {
    marginVertical: spacing.sm,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: radii.sm,
    paddingVertical: 15,
  },
  primaryText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '900',
  },
});
