import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthContext';

export default function Index() {
  const { isLoading, isSignedIn } = useAuth();

  if (isLoading) {
    return null;
  }

  return <Redirect href={isSignedIn ? '/(tabs)' : '/login'} />;
}
