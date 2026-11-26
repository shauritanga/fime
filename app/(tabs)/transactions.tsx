import { AddButton } from '@/components/AddButton';
import { BottomSheet } from '@/components/BottomSheet';
import { MonthPickerSheet } from '@/components/MonthPickerSheet';
import { TransactionCard } from '@/components/TransactionCard';
import { TransactionEditSheet } from '@/components/TransactionEditSheet';
import { Card, Muted, Screen, Title } from '@/components/finance-ui';
import { CategoryChips } from '@/components/insights-controls';
import { palette, radii, spacing } from '@/constants/theme';
import {
  listCategories,
  listTransactionPeriods,
  listTransactionsByPeriod,
  searchTransactions,
} from '@/lib/finance/database';
import { currentPeriod, formatDayHeading, formatPeriod, formatSignedMoney, formatMoney, shiftPeriod } from '@/lib/finance/format';
import type { Category, Transaction } from '@/lib/finance/types';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

type Filter = 'all' | 'income' | 'expense';
type TransactionSection = {
  data: Transaction[];
  net: number;
  title: string;
};
type Results = {
  // Identifies the month or search these rows belong to.
  key: string;
  transactions: Transaction[];
  hasMore: boolean;
};

const filters: Array<{ label: string; value: Filter }> = [
  { label: 'All', value: 'all' },
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
];
const searchPageSize = 50;

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [query, setQuery] = useState('');
  const [searchLimit, setSearchLimit] = useState(searchPageSize);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [picker, setPicker] = useState<'month' | 'category' | null>(null);
  const requestRef = useRef(0);

  const searching = query.trim().length > 0;
  const resultsKey = searching ? `search:${query.trim()}:${filter}:${categoryId}` : `month:${period}`;

  const refresh = useCallback(async () => {
    // Only the newest request may update the screen (typing starts many).
    const request = ++requestRef.current;
    try {
      const nextCategories = await listCategories(db);
      const nextPeriods = await listTransactionPeriods(db);
      let rows: Transaction[];
      let hasMore = false;

      if (searching) {
        rows = await searchTransactions(db, {
          categoryId: categoryId || undefined,
          limit: searchLimit + 1,
          query,
          type: filter === 'all' ? undefined : filter,
        });
        hasMore = rows.length > searchLimit;
        rows = rows.slice(0, searchLimit);
      } else {
        rows = await listTransactionsByPeriod(db, period);
      }

      if (request !== requestRef.current) {
        return;
      }
      setCategories(nextCategories);
      setPeriods(nextPeriods);
      setResults({ key: resultsKey, transactions: rows, hasMore });
    } catch (error) {
      console.warn('Unable to load transactions', error);
      if (request === requestRef.current) {
        setResults({ key: resultsKey, transactions: [], hasMore: false });
      }
    }
  }, [categoryId, db, filter, period, query, resultsKey, searching, searchLimit]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  // Rows from a previous month or search are never shown under the new heading.
  const loading = results?.key !== resultsKey;

  // Month rows still need filtering here; search results are filtered by the database.
  const inCategory = useMemo(
    () =>
      (loading ? [] : results.transactions).filter(
        (transaction) => !categoryId || transaction.categoryId === categoryId
      ),
    [categoryId, loading, results]
  );
  const visible = useMemo(
    () => inCategory.filter((transaction) => filter === 'all' || transaction.type === filter),
    [filter, inCategory]
  );
  const sections = useMemo(() => groupTransactionsByDay(visible, searching), [searching, visible]);
  // The summary ignores the All/Income/Expense filter so all three numbers stay meaningful.
  const income = sumByType(inCategory, 'income');
  const expense = sumByType(inCategory, 'expense');

  const thisPeriod = currentPeriod();
  const earliest = periods[0] ?? thisPeriod;
  const latest = periods[periods.length - 1] ?? thisPeriod;
  const minPeriod = earliest < thisPeriod ? earliest : thisPeriod;
  const maxPeriod = latest > thisPeriod ? latest : thisPeriod;
  const selectedCategory = categoryMap.get(categoryId);

  function changeQuery(value: string) {
    setQuery(value);
    setSearchLimit(searchPageSize);
  }

  function selectCategory(id: string) {
    setCategoryId(id);
    setSearchLimit(searchPageSize);
    setPicker(null);
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Title>Transactions</Title>
              </View>
              {!searching && period !== thisPeriod ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPeriod(thisPeriod)}
                  style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
                  <Text style={styles.pillText}>This month</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.searchBox}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={palette.muted} size={20} />
              <TextInput
                accessibilityLabel="Search all transactions"
                onChangeText={changeQuery}
                placeholder="Search title, category or amount"
                placeholderTextColor={palette.muted}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
              {query ? (
                <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => changeQuery('')} style={styles.iconButton}>
                  <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} tintColor={palette.muted} size={20} />
                </Pressable>
              ) : null}
            </View>

            {searching ? (
              <Muted>Results from all months</Muted>
            ) : (
              <View style={styles.monthPicker}>
                <MonthArrow direction="previous" disabled={period <= minPeriod} onPress={() => setPeriod(shiftPeriod(period, -1))} />
                <Pressable
                  accessibilityHint="Opens the month picker"
                  accessibilityRole="button"
                  onPress={() => setPicker('month')}
                  style={({ pressed }) => [styles.monthLabelButton, pressed && styles.pressed]}>
                  <Text numberOfLines={1} style={styles.monthLabel}>{formatPeriod(period)}</Text>
                  <SymbolView name={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }} tintColor={palette.emerald} size={18} />
                </Pressable>
                <MonthArrow direction="next" disabled={period >= maxPeriod} onPress={() => setPeriod(shiftPeriod(period, 1))} />
              </View>
            )}

            <View style={styles.filterRow}>
              <View style={styles.segment}>
                {filters.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === item.value }}
                    key={item.value}
                    onPress={() => {
                      setFilter(item.value);
                      setSearchLimit(searchPageSize);
                      // A category belongs to one type, so drop one that can no longer match.
                      if (item.value !== 'all' && selectedCategory && selectedCategory.type !== item.value) {
                        setCategoryId('');
                      }
                    }}
                    style={[styles.segmentItem, filter === item.value && styles.segmentActive]}>
                    <Text style={[styles.segmentText, filter === item.value && styles.segmentTextActive]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityLabel={`Category filter: ${selectedCategory?.name ?? 'all categories'}`}
                accessibilityRole="button"
                onPress={() => setPicker('category')}
                style={({ pressed }) => [styles.pill, styles.categoryButton, selectedCategory && styles.pillActive, pressed && styles.pressed]}>
                <Text numberOfLines={1} style={[styles.pillText, selectedCategory && styles.pillTextActive]}>
                  {selectedCategory?.name ?? 'Category'}
                </Text>
              </Pressable>
            </View>

            {!searching && !loading && inCategory.length > 0 ? (
              <View style={styles.summary}>
                <SummaryItem label="Income" value={formatMoney(income)} color={palette.emerald} />
                <SummaryItem label="Expense" value={formatMoney(expense)} color={palette.coral} />
                <SummaryItem label="Net" value={formatSignedMoney(income - expense)} color={palette.ink} />
              </View>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            {/* A partly loaded search can't show a reliable day total. */}
            {!searching ? <Text style={styles.sectionNet}>{formatSignedMoney(section.net)}</Text> : null}
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            // Android can leave a row blank if its rounded corners change in place (for
            // example when a newer entry pushes it down), so redraw it when they do.
            key={`${index === 0}-${index === section.data.length - 1}`}
            style={[
              styles.row,
              index === 0 && styles.firstRow,
              index === section.data.length - 1 && styles.lastRow,
            ]}>
            <TransactionCard
              category={categoryMap.get(item.categoryId)}
              dateStyle={searching ? 'full' : 'none'}
              grouped
              onPress={() => setEditing(item)}
              showDivider={index > 0}
              transaction={item}
            />
          </View>
        )}
        ListFooterComponent={
          !loading && results.hasMore ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSearchLimit((limit) => limit + searchPageSize)}
              style={({ pressed }) => [styles.pill, styles.loadMore, pressed && styles.pressed]}>
              <Text style={styles.pillText}>Show more results</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Card>
              <Text style={styles.emptyTitle}>
                {loading
                  ? 'Loading transactions'
                  : searching
                    ? 'No matching transactions'
                    : `No transactions to show for ${formatPeriod(period)}`}
              </Text>
              <Muted>
                {loading
                  ? 'One moment.'
                  : searching || filter !== 'all' || categoryId
                    ? 'Try different words or filters.'
                    : 'Add a transaction and it will appear in its month.'}
              </Muted>
            </Card>
          </View>
        }
      />

      <AddButton />

      {picker === 'month' ? (
        <MonthPickerSheet
          maxPeriod={maxPeriod}
          minPeriod={minPeriod}
          onClose={() => setPicker(null)}
          onSelect={(next) => {
            setPeriod(next);
            setPicker(null);
          }}
          periodsWithData={periods}
          selected={period}
        />
      ) : null}

      {picker === 'category' ? (
        <BottomSheet onClose={() => setPicker(null)} visible>
          <Text style={styles.sheetTitle}>Filter by category</Text>
          <CategoryChips
            categories={[
              { id: '', name: 'All categories', color: palette.emerald },
              ...categories.filter((category) => filter === 'all' || category.type === filter),
            ]}
            onSelect={selectCategory}
            selectedId={categoryId}
          />
        </BottomSheet>
      ) : null}

      {editing ? (
        <TransactionEditSheet
          categories={categories}
          key={editing.id}
          onChanged={refresh}
          onClose={() => setEditing(null)}
          transaction={editing}
        />
      ) : null}
    </Screen>
  );
}

function MonthArrow({
  direction,
  disabled,
  onPress,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  onPress: () => void;
}) {
  const side = direction === 'previous' ? 'left' : 'right';

  return (
    <Pressable
      accessibilityLabel={`${direction === 'previous' ? 'Previous' : 'Next'} month`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.monthButton, disabled && styles.disabled, pressed && styles.pressed]}>
      <SymbolView name={{ ios: `chevron.${side}`, android: `chevron_${side}`, web: `chevron_${side}` }} tintColor={palette.emerald} size={22} />
    </Pressable>
  );
}

function SummaryItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.summaryValue, { color }]}>
        {value}
      </Text>
    </View>
  );
}

function groupTransactionsByDay(transactions: Transaction[], withYear: boolean): TransactionSection[] {
  const sectionMap = new Map<string, TransactionSection>();

  for (const transaction of transactions) {
    let section = sectionMap.get(transaction.date);
    if (!section) {
      section = { data: [], net: 0, title: formatDayHeading(transaction.date, withYear) };
      sectionMap.set(transaction.date, section);
    }
    section.data.push(transaction);
    section.net += transaction.type === 'income' ? transaction.amount : -transaction.amount;
  }

  return Array.from(sectionMap.values());
}

function sumByType(transactions: Transaction[], type: Transaction['type']) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: 96,
  },
  headerContent: {
    gap: spacing.sm,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  pill: {
    alignItems: 'center',
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  pillActive: {
    backgroundColor: palette.emerald,
    borderColor: palette.emerald,
  },
  pillText: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '900',
  },
  pillTextActive: {
    color: palette.white,
  },
  searchBox: {
    alignItems: 'center',
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  searchInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 48,
  },
  iconButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  monthPicker: {
    alignItems: 'center',
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
  },
  monthButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  monthLabelButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 48,
  },
  monthLabel: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.sm,
    flex: 1,
    flexDirection: 'row',
    padding: 3,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  segmentActive: {
    backgroundColor: palette.white,
  },
  segmentText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: palette.ink,
  },
  categoryButton: {
    maxWidth: 130,
  },
  summary: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  sectionHeader: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionNet: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  row: {
    borderColor: palette.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  firstRow: {
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderTopWidth: 1,
  },
  lastRow: {
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    borderBottomWidth: 1,
  },
  loadMore: {
    marginTop: spacing.md,
  },
  empty: {
    marginTop: spacing.md,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.84,
  },
  disabled: {
    opacity: 0.35,
  },
});
