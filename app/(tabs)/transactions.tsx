import { TransactionCard } from '@/components/TransactionCard';
import { Card, financeStyles, Muted, Screen, Title } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { listCategories, listTransactionsByPeriod } from '@/lib/finance/database';
import { currentPeriod } from '@/lib/finance/format';
import type { Category, Transaction } from '@/lib/finance/types';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

type Filter = 'all' | 'income' | 'expense';
type TransactionSection = {
  data: Transaction[];
  title: string;
};

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
        keyExtractor={(item) => item.id}
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

            <View style={styles.monthPicker}>
              <View style={styles.navGroup}>
                <Pressable
                  onPress={() => setPeriod((current) => clampPeriod(shiftPeriod(current, -12)))}
                  style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
                  <SymbolView name={{ ios: 'chevron.backward.2', android: 'keyboard_double_arrow_left', web: 'keyboard_double_arrow_left' }} tintColor={palette.ink} size={18} />
                </Pressable>
                <Pressable
                  onPress={() => setPeriod((current) => clampPeriod(shiftPeriod(current, -1)))}
                  style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
                  <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor={palette.ink} size={20} />
                </Pressable>
              </View>
              <View style={styles.monthLabelBlock}>
                <Text style={styles.monthLabel}>{formatPeriod(period)}</Text>
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
                  <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.ink} size={20} />
                </Pressable>
                <Pressable
                  disabled={period >= currentPeriod()}
                  onPress={() => setPeriod((current) => clampPeriod(shiftPeriod(current, 12)))}
                  style={({ pressed }) => [
                    styles.monthButton,
                    period >= currentPeriod() && styles.disabledButton,
                    pressed && styles.pressed,
                  ]}>
                  <SymbolView name={{ ios: 'chevron.forward.2', android: 'keyboard_double_arrow_right', web: 'keyboard_double_arrow_right' }} tintColor={palette.ink} size={18} />
                </Pressable>
              </View>
            </View>

            <View style={financeStyles.chipRow}>
              {(['all', 'income', 'expense'] as Filter[]).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setFilter(item)}
                  style={[styles.chip, filter === item && styles.chipActive]}>
                  <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>
                    {item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TransactionCard category={categoryMap.get(item.categoryId)} transaction={item} />
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

function groupTransactionsByDay(transactions: Transaction[]): TransactionSection[] {
  const sections: TransactionSection[] = [];
  const sectionMap = new Map<string, TransactionSection>();

  for (const transaction of transactions) {
    const title = formatSectionDate(transaction.date);
    const existing = sectionMap.get(transaction.date);

    if (existing) {
      existing.data.push(transaction);
      continue;
    }

    const nextSection = {
      data: [transaction],
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
    gap: spacing.md,
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
  monthPicker: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
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
    backgroundColor: palette.surfaceMuted,
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
    fontSize: 17,
    fontWeight: '900',
  },
  chip: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: palette.emerald,
    borderColor: palette.emerald,
  },
  chipText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  chipTextActive: {
    color: palette.white,
  },
  sectionHeader: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '900',
    marginTop: spacing.xs,
    textTransform: 'uppercase',
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
