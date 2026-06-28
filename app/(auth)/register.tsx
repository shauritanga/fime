import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Screen } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    setError('');
    setSubmitting(true);

    try {
      await register({ name, password, phoneNumber });
      router.replace('/(tabs)');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create your account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined, web: undefined })} style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.hero}>
            <View style={styles.brandMark}>
              <Image source={require('../../assets/images/fime_logo.png')} style={styles.brandMarkImage} />
            </View>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Register with your name, phone number and password.</Text>
          </View>

          <Card>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                placeholder="Your full name"
                placeholderTextColor={palette.muted}
                style={styles.input}
                value={name}
                onChangeText={setName}
              />
            </View>

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
              <View style={styles.passwordRow}>
                <TextInput
                  placeholder="Create a password"
                  placeholderTextColor={palette.muted}
                  secureTextEntry={!passwordVisible}
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable
                  onPress={() => setPasswordVisible((current) => !current)}
                  style={({ pressed }) => [styles.visibilityButton, pressed && styles.pressed]}>
                  <SymbolView
                    name={{ ios: passwordVisible ? 'eye.slash' : 'eye', android: passwordVisible ? 'visibility_off' : 'visibility', web: passwordVisible ? 'visibility_off' : 'visibility' }}
                    tintColor={palette.emerald}
                    size={20}
                  />
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              disabled={submitting}
              onPress={handleRegister}
              style={({ pressed }) => [styles.primaryButton, submitting && styles.disabledButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Creating account...' : 'Register'}</Text>
            </Pressable>

            <Pressable onPress={() => router.push('/login')} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Already have an account? Log in</Text>
            </Pressable>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
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
  passwordRow: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingLeft: spacing.md,
  },
  passwordInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    minHeight: 54,
    paddingVertical: 0,
  },
  visibilityButton: {
    alignItems: 'center',
    height: 54,
    justifyContent: 'center',
    width: 54,
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
