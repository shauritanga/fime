import Constants, { AppOwnership } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

const REMINDERS_ENABLED_KEY = 'fime.dailyReminders.enabled.v1';
const REMINDERS_IDS_KEY = 'fime.dailyReminders.ids.v1';
const REMINDER_CHANNEL_ID = 'daily-money-reminders';

const reminderRequests = [
  {
    body: "Record today's income and expenses while they're still fresh.",
    hour: 20,
    minute: 0,
    title: 'Quick money check',
  },
  {
    body: 'Add anything you paid or received today before you close the day.',
    hour: 22,
    minute: 0,
    title: 'Wrap up your spending',
  },
  {
    body: 'Capture any final income or expenses before the day ends.',
    hour: 23,
    minute: 40,
    title: 'Last call for today',
  },
] as const;

type PermissionStatus = 'denied' | 'granted' | 'undetermined' | 'unsupported';
type NotificationsModule = typeof import('expo-notifications');

type DailyRemindersContextValue = {
  disableReminders: () => Promise<void>;
  enableReminders: () => Promise<void>;
  enabled: boolean;
  loading: boolean;
  permissionStatus: PermissionStatus;
  reminderTimes: string[];
};

const DailyRemindersContext = createContext<DailyRemindersContextValue | null>(null);

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

export function DailyRemindersProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');

  const refreshPermissionStatus = useCallback(async () => {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      setPermissionStatus('unsupported');
      return 'unsupported';
    }

    const permission = await Notifications.getPermissionsAsync();
    const nextStatus = permission.granted ? 'granted' : permission.status;
    setPermissionStatus(nextStatus);
    return nextStatus;
  }, []);

  const disableReminders = useCallback(async () => {
    setLoading(true);
    try {
      const Notifications = await getNotificationsModule();
      await cancelStoredReminders(Notifications);
      await writeStorage(REMINDERS_ENABLED_KEY, 'false');
      setEnabled(false);
      await refreshPermissionStatus();
    } finally {
      setLoading(false);
    }
  }, [refreshPermissionStatus]);

  const enableReminders = useCallback(async () => {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      setPermissionStatus('unsupported');
      throw new Error('Daily reminders require a development build or production build.');
    }

    setLoading(true);
    try {
      const currentPermission = await Notifications.getPermissionsAsync();
      const permission = currentPermission.granted
        ? currentPermission
        : await Notifications.requestPermissionsAsync();

      if (!permission.granted) {
        setPermissionStatus(permission.status);
        await writeStorage(REMINDERS_ENABLED_KEY, 'false');
        setEnabled(false);
        throw new Error('Notification permission was not granted.');
      }

      setPermissionStatus('granted');
      const scheduledIds = await scheduleDailyReminders(Notifications);
      await writeStorage(REMINDERS_IDS_KEY, JSON.stringify(scheduledIds));
      await writeStorage(REMINDERS_ENABLED_KEY, 'true');
      setEnabled(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadReminders() {
      try {
        const [storedEnabled, status] = await Promise.all([
          readStorage(REMINDERS_ENABLED_KEY),
          refreshPermissionStatus(),
        ]);

        if (storedEnabled === null && status !== 'unsupported') {
          try {
            await enableReminders();
          } catch {
            // Permission was denied or unavailable. Keep reminders off.
          }
          return;
        } else if (storedEnabled === 'true' && status === 'granted') {
          const Notifications = await getNotificationsModule();
          const scheduledIds = Notifications ? await scheduleDailyReminders(Notifications) : [];
          await writeStorage(REMINDERS_IDS_KEY, JSON.stringify(scheduledIds));
        } else if (storedEnabled === 'true' && status !== 'granted') {
          await writeStorage(REMINDERS_ENABLED_KEY, 'false');
        }

        if (mounted) {
          setEnabled(storedEnabled === null ? status === 'granted' : storedEnabled === 'true' && status === 'granted');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadReminders();

    return () => {
      mounted = false;
    };
  }, [enableReminders, refreshPermissionStatus]);

  const value = useMemo(
    () => ({
      disableReminders,
      enableReminders,
      enabled,
      loading,
      permissionStatus,
      reminderTimes: reminderRequests.map((request) => formatReminderTime(request.hour, request.minute)),
    }),
    [disableReminders, enableReminders, enabled, loading, permissionStatus]
  );

  return <DailyRemindersContext.Provider value={value}>{children}</DailyRemindersContext.Provider>;
}

export function useDailyReminders() {
  const value = useContext(DailyRemindersContext);
  if (!value) {
    throw new Error('useDailyReminders must be used inside DailyRemindersProvider');
  }
  return value;
}

async function getNotificationsModule() {
  if (Platform.OS === 'web' || Constants.appOwnership === AppOwnership.Expo) {
    return null;
  }

  notificationsModulePromise ??= import('expo-notifications')
    .then((Notifications) => {
      if (!notificationHandlerConfigured) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        notificationHandlerConfigured = true;
      }
      return Notifications;
    })
    .catch((error) => {
      console.warn('Unable to load notifications module', error);
      return null;
    });

  return notificationsModulePromise;
}

async function scheduleDailyReminders(Notifications: NotificationsModule) {
  await cancelStoredReminders(Notifications);
  await ensureNotificationChannel(Notifications);

  const scheduledIds: string[] = [];
  for (const request of reminderRequests) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        body: request.body,
        sound: true,
        title: request.title,
      },
      trigger: {
        channelId: REMINDER_CHANNEL_ID,
        hour: request.hour,
        minute: request.minute,
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
      },
    });
    scheduledIds.push(id);
  }

  return scheduledIds;
}

async function ensureNotificationChannel(Notifications: NotificationsModule) {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    description: 'Daily reminders to record income and expenses.',
    importance: Notifications.AndroidImportance.DEFAULT,
    name: 'Daily money reminders',
  });
}

async function cancelStoredReminders(Notifications?: NotificationsModule | null) {
  const storedIds = await readStorage(REMINDERS_IDS_KEY);
  const ids = storedIds ? parseNotificationIds(storedIds) : [];
  if (Notifications) {
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  }
  await deleteStorage(REMINDERS_IDS_KEY);
}

function parseNotificationIds(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function formatReminderTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

async function deleteStorage(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
