import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

const ONBOARDING_KEY = 'fime.onboardingSeen.v1';

type OnboardingContextValue = {
  completeOnboarding: () => Promise<void>;
  hasSeenOnboarding: boolean;
  isLoading: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadOnboardingStatus() {
      try {
        const storedValue = await readStorage(ONBOARDING_KEY);
        if (mounted) {
          setHasSeenOnboarding(storedValue === 'true');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadOnboardingStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    await writeStorage(ONBOARDING_KEY, 'true');
    setHasSeenOnboarding(true);
  }, []);

  const value = useMemo(
    () => ({
      completeOnboarding,
      hasSeenOnboarding,
      isLoading,
    }),
    [completeOnboarding, hasSeenOnboarding, isLoading]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }
  return value;
}

async function readStorage(key: string) {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }

  const available = await SecureStore.isAvailableAsync();
  if (!available) {
    return null;
  }
  return SecureStore.getItemAsync(key);
}

async function writeStorage(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
