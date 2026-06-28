import { SymbolView } from 'expo-symbols';
import { Redirect, Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { palette } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isLoading, isSignedIn } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.white },
        headerTitleStyle: { color: palette.ink, fontWeight: '800' },
        headerShown: false,
        tabBarActiveTintColor: palette.emerald,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarStyle: {
          backgroundColor: palette.white,
          borderTopColor: palette.border,
          minHeight: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'house.fill',
                android: 'home',
                web: 'home',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'list.bullet',
                android: 'list',
                web: 'list',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'plus.circle.fill',
                android: 'add_circle',
                web: 'add_circle',
              }}
              tintColor={color}
              size={25}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'chart.line.uptrend.xyaxis',
                android: 'analytics',
                web: 'analytics',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'ellipsis.circle.fill',
                android: 'more_horiz',
                web: 'more_horiz',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
