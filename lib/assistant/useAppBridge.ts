import { useAuth } from '@/lib/auth/AuthContext';
import { listCategories, listTransactions } from '@/lib/finance/database';
import { shareTransactionsCsv } from '@/lib/finance/export';
import { useDailyReminders } from '@/lib/notifications/DailyRemindersContext';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef } from 'react';
import type { AppBridge } from './actions';

/** Gives the assistant the few things only the running app can do. */
export function useAppBridge() {
  const db = useSQLiteContext();
  const auth = useAuth();
  const reminders = useDailyReminders();
  // Read through a ref so an undo made later still sees the latest profile.
  const latest = useRef({ auth, reminders });
  useEffect(() => {
    latest.current = { auth, reminders };
  });

  return useMemo<AppBridge>(
    () => ({
      exportTransactions: async () =>
        shareTransactionsCsv(await listTransactions(db), await listCategories(db)),
      setReminders: (enabled) =>
        enabled ? latest.current.reminders.enableReminders() : latest.current.reminders.disableReminders(),
      getProfile: () => ({
        name: latest.current.auth.profile?.name ?? '',
        phoneNumber: latest.current.auth.profile?.phoneNumber ?? '',
      }),
      updateProfile: (input) =>
        latest.current.auth.updateProfile({ ...input, imageUri: latest.current.auth.profile?.imageUri }),
    }),
    [db]
  );
}
