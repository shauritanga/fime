import { Muted, Screen, Title } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const menuItems = [
  {
    detail: 'Set monthly category limits and track budget progress.',
    href: '/insights/budgets',
    stat: 'Limits',
    title: 'Budgets',
  },
  {
    detail: 'Track emergency funds, trips, or big purchases.',
    href: '/insights/goals',
    stat: 'Targets',
    title: 'Savings goals',
  },
  {
    detail: 'Track borrowed money and items with repayment history.',
    href: '/insights/loans',
    stat: 'Debt',
    title: 'Loans',
  },
  {
    detail: 'Keep recurring services and upcoming renewals visible.',
    href: '/insights/subscriptions',
    stat: 'Bills',
    title: 'Subscriptions',
  },
  {
    detail: 'Prepare predictable income and expenses for posting.',
    href: '/insights/recurring',
    stat: 'Schedule',
    title: 'Recurring transactions',
  },
  {
    detail: 'Share a CSV copy of locally stored transactions.',
    href: '/insights/export',
    stat: 'CSV',
    title: 'Export',
  },
] as const;

export default function InsightsMenuScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Title>More</Title>
          <Muted>Open focused tools for analysis, planning, automation, and exports.</Muted>
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
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.stat}</Text>
                </View>
              </View>
          </Pressable>
        ))}
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
  menuCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
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
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  badge: {
    backgroundColor: palette.emeraldSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: palette.emerald,
    fontSize: 11,
    fontWeight: '900',
  },
});
