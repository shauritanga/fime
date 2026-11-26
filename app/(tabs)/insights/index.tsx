import { Muted, Screen, Title } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const menuItems = [
  {
    detail: 'Monthly limits by category.',
    href: '/insights/budgets',
    title: 'Budgets',
  },
  {
    detail: 'Save toward something.',
    href: '/insights/goals',
    title: 'Savings goals',
  },
  {
    detail: 'Money and items you borrowed.',
    href: '/insights/loans',
    title: 'Loans',
  },
  {
    detail: 'Bills and renewals to pay.',
    href: '/insights/subscriptions',
    title: 'Subscriptions',
  },
  {
    detail: 'Regular income and expenses.',
    href: '/insights/recurring',
    title: 'Recurring transactions',
  },
  {
    detail: 'Share your transactions as a CSV file.',
    href: '/insights/export',
    title: 'Export',
  },
] as const;

export default function InsightsMenuScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Title>More</Title>
          <Muted>Plan your money and manage your data.</Muted>
        </View>

        {menuItems.map((item) => (
          <Pressable
            key={item.title}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [styles.menuCard, pressed && styles.menuCardPressed]}>
              <View style={styles.cardRow}>
                <View style={styles.copy}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Muted>{item.detail}</Muted>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  menuCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuCardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  cardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
  },
  itemTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  chevron: {
    color: palette.muted,
    fontSize: 26,
  },
});
