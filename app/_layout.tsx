import Constants, { AppOwnership } from 'expo-constants';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { migrateDatabase } from '@/lib/finance/database';
import { DailyRemindersProvider } from '@/lib/notifications/DailyRemindersContext';
import { OnboardingProvider } from '@/lib/onboarding/OnboardingContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    let subscription: { remove: () => void } | null = null;

    async function setupNotificationRouting() {
      if (Platform.OS === 'web' || Constants.appOwnership === AppOwnership.Expo) {
        return;
      }

      let Notifications: typeof import('expo-notifications') | null = null;
      try {
        Notifications = require('expo-notifications');
      } catch {
        return;
      }

      if (!mounted) {
        return;
      }

      if (!Notifications) {
        return;
      }

      const goToAdd = () => {
        if (pathname !== '/add') {
          router.replace('/add');
        }
      };

      subscription = Notifications.addNotificationResponseReceivedListener(() => {
        goToAdd();
      });

      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse && mounted) {
        goToAdd();
      }
    }

    setupNotificationRouting();

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [pathname, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <OnboardingProvider>
          <DailyRemindersProvider>
            <SQLiteProvider databaseName="fime.db" onInit={migrateDatabase}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              </Stack>
            </SQLiteProvider>
          </DailyRemindersProvider>
        </OnboardingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
