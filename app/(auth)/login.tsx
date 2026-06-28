import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Card, Screen } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError('');
    setSubmitting(true);

    try {
      await signIn({ password, phoneNumber });
      router.replace('/(tabs)');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to log in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}>
        <View style={styles.hero}>
            <View style={styles.brandMark}>
              <Image source={require('../../assets/images/fime_logo.png')} style={styles.brandMarkImage} />
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue tracking your money in Fime.</Text>
          </View>

          <Card>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                keyboardType="phone-pad"
                placeholder="e.g. +255 700 000 000"
                placeholderTextColor={palette.muted}
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                placeholder="Your password"
                placeholderTextColor={palette.muted}
                secureTextEntry
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              disabled={submitting}
              onPress={handleLogin}
              style={({ pressed }) => [styles.primaryButton, submitting && styles.disabledButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Logging in...' : 'Log in'}</Text>
            </Pressable>

            <Pressable onPress={() => router.push('/register')} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Create a new account</Text>
            </Pressable>
          </Card>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: palette.slate,
    borderRadius: 22,
    height: 84,
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
    width: 84,
  },
  brandMarkImage: {
    height: '100%',
    width: '100%',
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: spacing.md,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: radii.md,
    height: 54,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.88,
  },
  disabledButton: {
    opacity: 0.62,
  },
  errorText: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  secondaryAction: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: 6,
  },
  secondaryActionText: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '800',
  },
});
