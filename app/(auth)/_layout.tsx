import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthContext';

export default function AuthLayout() {
  const { isLoading, isSignedIn } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
