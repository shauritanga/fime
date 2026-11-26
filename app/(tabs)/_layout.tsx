import { SymbolView } from 'expo-symbols';
import { Redirect, router, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { palette } from '@/constants/theme';
import { newChat } from '@/lib/assistant/store';
import { useAuth } from '@/lib/auth/AuthContext';

export default function TabLayout() {
  const { isLoading, isSignedIn } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isSignedIn) {
    // Don't leave one person's conversation for whoever signs in next.
    newChat();
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.white },
        headerTitleStyle: { color: palette.ink, fontWeight: '800' },
        headerShown: false,
        tabBarActiveTintColor: palette.emerald,
        tabBarInactiveTintColor: palette.muted,
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
      {/* The centre button opens the chat above the tabs, so the tab bar is out of the way. */}
      <Tabs.Screen
        name="ask"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push('/assistant');
          },
        }}
        options={{
          title: 'Assistant',
          tabBarAccessibilityLabel: 'Money assistant',
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.assistantButton}>
              <SymbolView
                name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                tintColor={palette.white}
                size={26}
              />
            </View>
          ),
          tabBarIconStyle: styles.assistantIcon,
        }}
      />
      {/* Opened from the + buttons, so it has no tab of its own. */}
      <Tabs.Screen name="add" options={{ href: null }} />
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

const styles = StyleSheet.create({
  assistantIcon: {
    height: 48,
    width: 48,
  },
  assistantButton: {
    alignItems: 'center',
    backgroundColor: '#100B1A',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
