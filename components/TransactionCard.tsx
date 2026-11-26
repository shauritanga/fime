import { centeredEmoji, palette, radii, spacing } from '@/constants/theme';
import { formatShortDate, formatSignedMoney } from '@/lib/finance/format';
import type { Category, Transaction } from '@/lib/finance/types';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function TransactionCard({
  category,
  dateStyle = 'short',
  grouped = false,
  onPress,
  showDivider = false,
  transaction,
}: {
  category?: Category;
  dateStyle?: 'short' | 'full' | 'none';
  grouped?: boolean;
  onPress?: () => void;
  showDivider?: boolean;
  transaction: Transaction;
}) {
  const icon = getCategoryIcon(transaction.categoryId);
  const title =
    transaction.note.trim() || getTransactionFallbackTitle(transaction.categoryId, transaction.type);
  const isIncome = transaction.type === 'income';
  const amount = formatSignedMoney(isIncome ? transaction.amount : -transaction.amount);
  const categoryName = category?.name ?? 'Category';
  const dateText =
    dateStyle === 'full'
      ? `${formatShortDate(transaction.date)} ${transaction.date.slice(0, 4)}`
      : formatShortDate(transaction.date);

  return (
    <Pressable
      accessibilityLabel={`${title}, ${categoryName}, ${isIncome ? 'income' : 'expense'} ${amount}`}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.transactionCard,
        grouped && styles.groupedCard,
        showDivider && styles.dividedCard,
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.transactionIcon,
          category?.emoji
            ? { backgroundColor: `${category.color}1F`, borderColor: `${category.color}55` }
            : null,
        ]}>
        {category?.emoji ? (
          <Text allowFontScaling={false} style={styles.emoji}>
            {category.emoji}
          </Text>
        ) : (
          <SymbolView name={icon} tintColor={palette.emerald} size={25} />
        )}
      </View>
      <View style={styles.transactionMiddle}>
        <Text numberOfLines={1} style={styles.transactionTitle}>
          {title}
        </Text>
        <View style={styles.transactionMetaRow}>
          <Text style={styles.categoryMeta}>{categoryName}</Text>
          {dateStyle !== 'none' ? (
            <>
              <Text style={styles.transactionMeta}>·</Text>
              <Text style={styles.transactionMeta}>{dateText}</Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={styles.transactionAmountBlock}>
        <Text style={[styles.transactionAmount, isIncome ? styles.income : styles.expense]}>{amount}</Text>
      </View>
    </Pressable>
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
  emoji: {
    ...centeredEmoji,
    fontSize: 22,
    lineHeight: 28,
  },
  transactionIcon: {
    alignItems: 'center',
    backgroundColor: palette.emeraldSoft,
    borderColor: palette.emeraldSoft,
    borderWidth: 1,
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
    justifyContent: 'center',
    minWidth: 88,
  },
  transactionAmount: {
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
  income: {
    color: palette.emerald,
  },
  expense: {
    color: palette.coral,
  },
  pressed: {
    opacity: 0.7,
  },
});
