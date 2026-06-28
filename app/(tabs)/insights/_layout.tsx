import { palette } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function InsightsLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: palette.background },
        headerStyle: { backgroundColor: palette.white },
        headerTintColor: palette.ink,
        headerTitleStyle: { fontWeight: '800' },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="budgets" options={{ title: 'Budgets' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="goals" options={{ title: 'Savings Goals' }} />
      <Stack.Screen name="loans" options={{ title: 'Loans' }} />
      <Stack.Screen name="subscriptions" options={{ title: 'Subscriptions' }} />
      <Stack.Screen name="recurring" options={{ title: 'Recurring' }} />
      <Stack.Screen name="export" options={{ title: 'Export' }} />
    </Stack>
  );
}
