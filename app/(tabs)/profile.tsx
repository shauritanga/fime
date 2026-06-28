import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import { BottomSheet } from '@/components/BottomSheet';
import { Card, Muted, Screen } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { useDailyReminders } from '@/lib/notifications/DailyRemindersContext';

export default function ProfileScreen() {
  const { profile, signOut, updateProfile } = useAuth();
  const {
    disableReminders,
    enableReminders,
    enabled: remindersEnabled,
    loading: remindersLoading,
    permissionStatus,
    reminderTimes,
  } = useDailyReminders();
  const [editing, setEditing] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [name, setName] = useState(profile?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '');
  const [imageUri, setImageUri] = useState(profile?.imageUri);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError('');
    setSaving(true);

    try {
      await updateProfile({ imageUri, name, phoneNumber });
      setEditing(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    setName(profile?.name ?? '');
    setPhoneNumber(profile?.phoneNumber ?? '');
    setImageUri(profile?.imageUri);
    setError('');
    setEditing(false);
  }

  function openEditor() {
    setName(profile?.name ?? '');
    setPhoneNumber(profile?.phoneNumber ?? '');
    setImageUri(profile?.imageUri);
    setError('');
    setEditing(true);
  }

  async function toggleReminders(nextValue: boolean) {
    try {
      if (nextValue) {
        await enableReminders();
      } else {
        await disableReminders();
      }
    } catch (nextError) {
      Alert.alert(
        'Notifications unavailable',
        nextError instanceof Error
          ? nextError.message
          : 'Unable to update notification reminders right now.'
      );
    }
  }

  async function chooseProfileImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo access to choose a profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.82,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0]?.uri);
      setError('');
    }
  }

  function confirmLogout() {
    Alert.alert('Log out', 'You will need your phone number and password to open Fime again.', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
        style: 'destructive',
        text: 'Log out',
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor={palette.ink} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable
            onPress={openEditor}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor={palette.emerald} size={21} />
          </Pressable>
        </View>

        <Card tone="dark">
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              {profile?.imageUri ? (
                <Image source={{ uri: profile.imageUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{profile?.initials ?? 'FI'}</Text>
              )}
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{profile?.name ?? 'Fime user'}</Text>
              <Text style={styles.phone}>{profile?.phoneNumber ?? 'No phone number'}</Text>
            </View>
          </View>
          <View style={styles.memberRow}>
            <Text style={styles.darkLabel}>Member since</Text>
            <Text style={styles.darkValue}>{profile?.createdAt ? formatMemberDate(profile.createdAt) : 'Today'}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Muted>Manage how Fime works on this device.</Muted>
          <View style={styles.actionGroup}>
            <ActionRow
              icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
              label="Edit profile"
              onPress={openEditor}
            />
            <ActionRow
              icon={{ ios: 'bell.badge', android: 'notifications', web: 'notifications' }}
              label="Notifications"
              onPress={() => setNotificationsOpen(true)}
            />
            <ActionRow
              icon={{ ios: 'globe', android: 'language', web: 'language' }}
              label="Currency and region"
              onPress={() => Alert.alert('Currency and region', 'Fime is currently set up for Tanzanian shillings and local date formats.')}
            />
            <ActionRow
              icon={{ ios: 'lock', android: 'security', web: 'security' }}
              label="App lock"
              onPress={() => Alert.alert('App lock', 'Use your phone lock to protect Fime on this device.')}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Account</Text>
          <Muted>Keep your data portable and private.</Muted>
          <View style={styles.actionGroup}>
            <ActionRow
              icon={{ ios: 'square.and.arrow.up', android: 'file_upload', web: 'file_upload' }}
              label="Export data"
              onPress={() => router.push('/insights/export')}
            />
            <ActionRow
              icon={{ ios: 'lock.shield', android: 'lock', web: 'lock' }}
              label="Privacy"
              onPress={() => Alert.alert('Privacy', 'Your Fime profile and finance data stay on this device.')}
            />
            <ActionRow
              icon={{ ios: 'questionmark.circle', android: 'help_outline', web: 'help_outline' }}
              label="Help and feedback"
              onPress={() => Alert.alert('Help and feedback', 'Share feedback from your usual support channel while in-app support is being prepared.')}
            />
            <ActionRow
              destructive
              icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
              label="Log out"
              onPress={confirmLogout}
            />
          </View>
        </Card>
      </ScrollView>
      <BottomSheet visible={editing} onClose={cancelEditing} contentStyle={styles.profileSheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sectionTitle}>Edit profile</Text>
          <Pressable onPress={cancelEditing} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.ink} size={20} />
          </Pressable>
        </View>

        <View style={styles.photoEditor}>
          <Pressable onPress={chooseProfileImage} style={({ pressed }) => [styles.largeAvatar, pressed && styles.pressed]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.largeAvatarText}>{profile?.initials ?? 'FI'}</Text>
            )}
            <View style={styles.cameraBadge}>
              <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} tintColor={palette.white} size={18} />
            </View>
          </Pressable>
          <View style={styles.photoActions}>
            <Pressable onPress={chooseProfileImage} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
              <Text style={styles.photoButtonText}>Change photo</Text>
            </Pressable>
            {imageUri ? (
              <Pressable onPress={() => setImageUri(undefined)} style={({ pressed }) => [styles.removePhotoButton, pressed && styles.pressed]}>
                <Text style={styles.removePhotoText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Name</Text>
          <BottomSheetTextInput
            placeholder="Your full name"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone number</Text>
          <BottomSheetTextInput
            keyboardType="phone-pad"
            placeholder="e.g. +255 700 000 000"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.formActions}>
          <Pressable onPress={cancelEditing} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={saving}
            onPress={handleSave}
            style={({ pressed }) => [styles.primaryButton, saving && styles.disabledButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        </View>
      </BottomSheet>
      <BottomSheet visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} contentStyle={styles.profileSheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Pressable onPress={() => setNotificationsOpen(false)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.ink} size={20} />
          </Pressable>
        </View>

        <View style={styles.reminderPanel}>
          <View style={styles.reminderHeader}>
            <View style={styles.reminderIcon}>
              <SymbolView name={{ ios: 'bell.badge.fill', android: 'notifications_active', web: 'notifications_active' }} tintColor={palette.emerald} size={22} />
            </View>
            <View style={styles.reminderCopy}>
              <Text style={styles.reminderTitle}>Daily wrap-up reminders</Text>
              <Muted>Record all income and expenses before the day ends.</Muted>
            </View>
          </View>

          <View style={styles.reminderTimes}>
            {reminderTimes.map((time) => (
              <View key={time} style={styles.reminderTimeChip}>
                <Text style={styles.reminderTimeText}>{time}</Text>
              </View>
            ))}
          </View>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchTitle}>{remindersEnabled ? 'Reminders on' : 'Reminders off'}</Text>
              <Text style={styles.switchMeta}>{getReminderStatusText(permissionStatus, remindersEnabled)}</Text>
            </View>
            <Switch
              disabled={remindersLoading || permissionStatus === 'unsupported'}
              ios_backgroundColor={palette.surfaceMuted}
              onValueChange={toggleReminders}
              thumbColor={palette.white}
              trackColor={{ false: palette.surfaceMuted, true: palette.emerald }}
              value={remindersEnabled}
            />
          </View>

          {permissionStatus === 'denied' ? (
            <Text style={styles.permissionText}>
              Notifications are blocked for Fime. Enable them in your device settings to use reminders.
            </Text>
          ) : null}
          {permissionStatus === 'unsupported' ? (
            <Text style={styles.permissionText}>
              Daily notification reminders are not supported on web.
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}

function ActionRow({
  destructive,
  icon,
  label,
  onPress,
}: {
  destructive?: boolean;
  icon: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, destructive && styles.destructiveIcon]}>
        <SymbolView name={icon} tintColor={destructive ? palette.coral : palette.emerald} size={20} />
      </View>
      <Text style={[styles.actionLabel, destructive && styles.destructiveText]}>{label}</Text>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={18} />
    </Pressable>
  );
}

function formatMemberDate(value: string) {
  return new Intl.DateTimeFormat('en-TZ', { month: 'short', year: 'numeric' }).format(new Date(value));
}

function getReminderStatusText(permissionStatus: string, enabled: boolean) {
  if (permissionStatus === 'unsupported') {
    return 'Not available on this platform';
  }
  if (permissionStatus === 'denied') {
    return 'Permission denied';
  }
  return enabled ? 'Scheduled every day' : 'Ask permission when you turn this on';
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: 999,
    height: 68,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 68,
  },
  avatarText: {
    color: palette.white,
    fontSize: 22,
    fontWeight: '900',
  },
  avatarImage: {
    borderRadius: 999,
    height: '100%',
    width: '100%',
  },
  identityCopy: {
    flex: 1,
  },
  name: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '900',
  },
  phone: {
    color: '#CAD8D2',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  memberRow: {
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  darkLabel: {
    color: '#B8C6C0',
    fontSize: 12,
    fontWeight: '700',
  },
  darkValue: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '900',
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  fieldGroup: {
    marginTop: spacing.md,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 16,
    height: 54,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  profileSheet: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  photoEditor: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  largeAvatar: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: 999,
    height: 96,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 96,
  },
  largeAvatarText: {
    color: palette.white,
    fontSize: 28,
    fontWeight: '900',
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: palette.slate,
    borderColor: palette.surface,
    borderRadius: 999,
    borderWidth: 2,
    bottom: 4,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 34,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  photoButtonText: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '900',
  },
  removePhotoButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  removePhotoText: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: radii.md,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.62,
  },
  reminderPanel: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  reminderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  reminderIcon: {
    alignItems: 'center',
    backgroundColor: palette.emeraldSoft,
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  reminderCopy: {
    flex: 1,
    minWidth: 0,
  },
  reminderTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  reminderTimes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reminderTimeChip: {
    backgroundColor: palette.emeraldSoft,
    borderColor: '#C7E2D6',
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  reminderTimeText: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '900',
  },
  switchRow: {
    alignItems: 'center',
    borderTopColor: palette.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  switchTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  switchMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  permissionText: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  actionGroup: {
    marginTop: spacing.sm,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: palette.emeraldSoft,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  destructiveIcon: {
    backgroundColor: palette.coralSoft,
  },
  actionLabel: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  destructiveText: {
    color: palette.coral,
  },
  pressed: {
    opacity: 0.84,
  },
});
