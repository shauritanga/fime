import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthContext';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';

export default function AuthLayout() {
  const { isLoading, isSignedIn, profile } = useAuth();
  const { hasSeenOnboarding, isLoading: isOnboardingLoading } = useOnboarding();

  if (isLoading || isOnboardingLoading) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  if (!profile && !hasSeenOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
