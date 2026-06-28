import { palette, radii, spacing } from '@/constants/theme';
import { formatMoney, formatShortDate } from '@/lib/finance/format';
import type { Category, Transaction } from '@/lib/finance/types';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

export function TransactionCard({
  category,
  grouped = false,
  showDivider = false,
  transaction,
}: {
  category?: Category;
  grouped?: boolean;
  showDivider?: boolean;
  transaction: Transaction;
}) {
  const icon = getCategoryIcon(transaction.categoryId);
  const title =
    transaction.note.trim() || getTransactionFallbackTitle(transaction.categoryId, transaction.type);

  return (
    <View style={[styles.transactionCard, grouped && styles.groupedCard, showDivider && styles.dividedCard]}>
      <View style={styles.transactionIcon}>
        <SymbolView name={icon} tintColor={palette.emerald} size={25} />
      </View>
      <View style={styles.transactionMiddle}>
        <Text numberOfLines={1} style={styles.transactionTitle}>
          {title}
        </Text>
        <View style={styles.transactionMetaRow}>
          <Text style={styles.categoryMeta}>{category?.name ?? 'Category'}</Text>
          <Text style={styles.transactionMeta}>·</Text>
          <Text style={styles.transactionMeta}>{formatShortDate(transaction.date)}</Text>
        </View>
      </View>
      <View style={styles.transactionAmountBlock}>
        <Text style={styles.transactionAmount}>{formatMoney(transaction.amount)}</Text>
        <Text style={transaction.type === 'income' ? styles.creditLabel : styles.debitLabel}>
          {transaction.type === 'income' ? 'Credit' : 'Debit'}
        </Text>
      </View>
    </View>
  );
}

function getCategoryIcon(categoryId: string) {
  const icons = {
    food: { ios: 'cup.and.saucer.fill', android: 'local_cafe', web: 'local_cafe' },
    freelance: { ios: 'briefcase.fill', android: 'work', web: 'work' },
    fun: { ios: 'sparkles', android: 'celebration', web: 'celebration' },
    health: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
    home: { ios: 'house.fill', android: 'home', web: 'home' },
    salary: { ios: 'banknote.fill', android: 'payments', web: 'payments' },
    transport: { ios: 'car.fill', android: 'directions_car', web: 'directions_car' },
    utilities: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  } as const;

  return icons[categoryId as keyof typeof icons] ?? { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' };
}

function getTransactionFallbackTitle(categoryId: string, type: 'income' | 'expense') {
  const titles = {
    food: 'Bought food or drinks',
    freelance: 'Freelance payment received',
    fun: 'Watched movies or entertainment',
    health: 'Health or pharmacy payment',
    home: 'Home expense payment',
    salary: 'Salary received',
    transport: 'Transport ride or fuel',
    utilities: 'Utility bill payment',
  } as const;

  return titles[categoryId as keyof typeof titles] ?? (type === 'income' ? 'Money received' : 'Money spent');
}

const styles = StyleSheet.create({
  transactionCard: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 78,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  groupedCard: {
    borderRadius: 0,
    borderWidth: 0,
  },
  dividedCard: {
    borderTopColor: palette.border,
    borderTopWidth: 1,
  },
  transactionIcon: {
    alignItems: 'center',
    backgroundColor: palette.emeraldSoft,
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  transactionMiddle: {
    flex: 1,
    minWidth: 0,
  },
  transactionTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
  },
  transactionAmountBlock: {
    alignItems: 'flex-end',
    gap: 4,
    justifyContent: 'center',
    minWidth: 88,
  },
  transactionAmount: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  transactionMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  categoryMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  transactionMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  creditLabel: {
    color: palette.emerald,
    fontSize: 12,
    fontWeight: '900',
  },
  debitLabel: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: '900',
  },
});
