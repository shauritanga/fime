import { TransactionCard } from '@/components/TransactionCard';
import { Card, Muted, Screen, Title } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { listCategories, listTransactionsByPeriod } from '@/lib/finance/database';
import { currentPeriod } from '@/lib/finance/format';
import type { Category, Transaction } from '@/lib/finance/types';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

type Filter = 'all' | 'income' | 'expense';
type TransactionSection = {
  data: Transaction[][];
  title: string;
};

const filters: Array<{ label: string; value: Filter }> = [
  { label: 'All', value: 'all' },
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
];
const filterMenuWidth = 88;

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [period, setPeriod] = useState(currentPeriod());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setTransactions([]);
    try {
      const nextCategories = await listCategories(db);
      const nextTransactions = await listTransactionsByPeriod(db, period);
      setCategories(nextCategories);
      setTransactions(nextTransactions);
    } catch (error) {
      console.warn('Unable to load monthly transactions', error);
    } finally {
      setLoading(false);
    }
  }, [db, period]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const filtered = useMemo(
    () => transactions.filter((transaction) => filter === 'all' || transaction.type === filter),
    [filter, transactions]
  );

  const sections = useMemo(() => groupTransactionsByDay(filtered), [filtered]);
  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item[0]?.id ?? 'transactions'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Title>Transactions</Title>
                <Muted>Review the money moving in and out of Fime.</Muted>
              </View>
              <Pressable
                disabled={period === currentPeriod()}
                onPress={() => setPeriod(currentPeriod())}
                style={({ pressed }) => [
                  styles.todayButton,
                  period === currentPeriod() && styles.disabledButton,
                  pressed && styles.pressed,
                ]}>
                <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} tintColor={palette.emerald} size={22} />
              </Pressable>
            </View>

            <View style={styles.controlsRow}>
              <View style={styles.monthPicker}>
                <View style={styles.navGroup}>
                  <Pressable
                    onPress={() => setPeriod((current) => clampPeriod(shiftPeriod(current, -12)))}
                    style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'chevron.backward.2', android: 'keyboard_double_arrow_left', web: 'keyboard_double_arrow_left' }} tintColor={palette.emerald} size={18} />
                  </Pressable>
                  <Pressable
                    onPress={() => setPeriod((current) => clampPeriod(shiftPeriod(current, -1)))}
                    style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor={palette.emerald} size={20} />
                  </Pressable>
                </View>
                <View style={styles.monthLabelBlock}>
                  <Text numberOfLines={1} style={styles.monthLabel}>{formatPeriod(period)}</Text>
                </View>
                <View style={styles.navGroup}>
                  <Pressable
                    disabled={period >= currentPeriod()}
                    onPress={() => setPeriod((current) => clampPeriod(shiftPeriod(current, 1)))}
                    style={({ pressed }) => [
                      styles.monthButton,
                      period >= currentPeriod() && styles.disabledButton,
                      pressed && styles.pressed,
                    ]}>
                    <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={period >= currentPeriod() ? palette.muted : palette.emerald} size={20} />
                  </Pressable>
                  <Pressable
                    disabled={period >= currentPeriod()}
                    onPress={() => setPeriod((current) => clampPeriod(shiftPeriod(current, 12)))}
                    style={({ pressed }) => [
                      styles.monthButton,
                      period >= currentPeriod() && styles.disabledButton,
                      pressed && styles.pressed,
                    ]}>
                    <SymbolView name={{ ios: 'chevron.forward.2', android: 'keyboard_double_arrow_right', web: 'keyboard_double_arrow_right' }} tintColor={period >= currentPeriod() ? palette.muted : palette.emerald} size={18} />
                  </Pressable>
                </View>
              </View>

              <FilterMenu value={filter} onChange={setFilter} />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item: sectionTransactions }) => (
          <View style={styles.sectionGroup}>
            {sectionTransactions.map((transaction, index) => (
              <TransactionCard
                category={categoryMap.get(transaction.categoryId)}
                grouped
                key={transaction.id}
                showDivider={index > 0}
                transaction={transaction}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          <Card>
            <Text style={styles.emptyTitle}>
              {loading ? 'Loading transactions' : `No transactions in ${formatPeriod(period)}`}
            </Text>
            <Muted>{loading ? 'Checking this month.' : 'Add a transaction and it will appear in this month.'}</Muted>
          </Card>
        }
      />
    </Screen>
  );
}

function FilterMenu({
  onChange,
  value,
}: {
  onChange: (value: Filter) => void;
  value: Filter;
}) {
  const anchorRef = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [menuFrame, setMenuFrame] = useState<{ height: number; width: number; x: number; y: number } | null>(null);
  const selected = filters.find((item) => item.value === value) ?? filters[0];

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }

    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setMenuFrame({ height, width, x, y });
      setOpen(true);
    });
  }

  function selectFilter(nextValue: Filter) {
    onChange(nextValue);
    setOpen(false);
  }

  const menuLeft = menuFrame
    ? Math.min(
        Math.max(spacing.md, menuFrame.x + menuFrame.width - filterMenuWidth),
        windowWidth - filterMenuWidth - spacing.md
      )
    : spacing.md;
  const menuTop = menuFrame ? menuFrame.y + menuFrame.height + spacing.xs : spacing.md;

  return (
    <View ref={anchorRef} style={styles.filterMenuContainer}>
      <Pressable onPress={toggleMenu} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
        <Text style={styles.filterButtonText}>{selected.label}</Text>
        <SymbolView
          name={{ ios: open ? 'chevron.up' : 'chevron.down', android: open ? 'keyboard_arrow_up' : 'keyboard_arrow_down', web: open ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}
          tintColor={palette.white}
          size={18}
        />
      </Pressable>

      <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={styles.menuBackdrop}>
          <View style={[styles.filterMenu, { left: menuLeft, top: menuTop }]}>
            {filters.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => selectFilter(item.value)}
                style={({ pressed }) => [styles.filterMenuItem, value === item.value && styles.filterMenuItemActive, pressed && styles.pressed]}>
                <Text style={[styles.filterMenuText, value === item.value && styles.filterMenuTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function groupTransactionsByDay(transactions: Transaction[]): TransactionSection[] {
  const sections: TransactionSection[] = [];
  const sectionMap = new Map<string, TransactionSection>();

  for (const transaction of transactions) {
    const title = formatSectionDate(transaction.date);
    const existing = sectionMap.get(transaction.date);

    if (existing) {
      existing.data[0].push(transaction);
      continue;
    }

    const nextSection = {
      data: [[transaction]],
      title,
    };
    sectionMap.set(transaction.date, nextSection);
    sections.push(nextSection);
  }

  return sections;
}

function formatSectionDate(value: string) {
  const today = currentDateISO();
  const yesterdayDate = new Date(`${today}T12:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  if (value === today) {
    return 'Today';
  }
  if (value === yesterday) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat('en-TZ', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat('en-TZ', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}-01T12:00:00`));
}

function shiftPeriod(value: string, offset: number) {
  const date = new Date(`${value}-01T12:00:00`);
  date.setMonth(date.getMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function clampPeriod(value: string) {
  const maxPeriod = currentPeriod();
  return value > maxPeriod ? maxPeriod : value;
}

function currentDateISO() {
  return new Date().toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerContent: {
    gap: spacing.md,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  todayButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  controlsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    zIndex: 10,
  },
  monthPicker: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: palette.emeraldSoft,
    borderRadius: radii.sm,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  disabledButton: {
    opacity: 0.35,
  },
  monthLabelBlock: {
    alignItems: 'center',
    flex: 1,
  },
  monthLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  filterMenuContainer: {
    alignItems: 'flex-end',
    position: 'relative',
    zIndex: 20,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderColor: palette.emerald,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    width: filterMenuWidth,
  },
  filterButtonText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '900',
  },
  menuBackdrop: {
    flex: 1,
  },
  filterMenu: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    elevation: 8,
    padding: 4,
    position: 'absolute',
    shadowColor: palette.slate,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    width: filterMenuWidth,
  },
  filterMenuItem: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  filterMenuItemActive: {
    backgroundColor: palette.emeraldSoft,
  },
  filterMenuText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  filterMenuTextActive: {
    color: palette.emerald,
  },
  sectionHeader: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionGroup: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  pressed: {
    opacity: 0.84,
  },
});
