import { TransactionCard } from '@/components/TransactionCard';
import { Card, financeStyles, Muted, Screen, Title } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { useFinance } from '@/lib/finance/useFinance';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Filter = 'all' | 'income' | 'expense';

export default function TransactionsScreen() {
  const { categories, transactions } = useFinance();
  const [filter, setFilter] = useState<Filter>('all');
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const filtered = useMemo(
    () => transactions.filter((transaction) => filter === 'all' || transaction.type === filter),
    [filter, transactions]
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Title>Transactions</Title>
          <Muted>Review the money moving in and out of Fime.</Muted>
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

        {filtered.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No transactions here</Text>
            <Muted>Add a transaction and it will appear in this view.</Muted>
          </Card>
        ) : (
          filtered.map((transaction) => {
            const category = categoryMap.get(transaction.categoryId);
            return <TransactionCard category={category} key={transaction.id} transaction={transaction} />;
          })
        )}
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
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
});
