import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';

type OnboardingStep = {
  body: string;
  icon: SymbolViewProps['name'];
  title: string;
};

const steps: OnboardingStep[] = [
  {
    body: 'See income, expenses, and what is left for the month in one calm place.',
    icon: { ios: 'wallet.pass.fill', android: 'account_balance_wallet', web: 'account_balance_wallet' },
    title: 'Track your money',
  },
  {
    body: 'Set category limits and spot where spending is getting tight before it becomes a problem.',
    icon: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
    title: 'Plan better budgets',
  },
  {
    body: 'Keep recurring bills, subscriptions, savings goals, and loans close to your daily money view.',
    icon: { ios: 'bell.badge.fill', android: 'notifications_active', web: 'notifications_active' },
    title: 'Stay ahead',
  },
  {
    body: 'Your profile and finance data stay on this device, with export tools when you need them.',
    icon: { ios: 'lock.shield.fill', android: 'privacy_tip', web: 'privacy_tip' },
    title: 'Own your data',
  },
];

export default function OnboardingScreen() {
  const { completeOnboarding } = useOnboarding();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = steps[activeIndex];
  const isFirstStep = activeIndex === 0;
  const isLastStep = activeIndex === steps.length - 1;

  async function finish(path: '/login' | '/register') {
    await completeOnboarding();
    router.replace(path);
  }

  function goNext() {
    if (isLastStep) {
      finish('/register');
      return;
    }

    setActiveIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.brandMark}>
            <Image source={require('../assets/images/fime_logo.png')} style={styles.brandImage} />
          </View>
          <Pressable onPress={() => finish('/login')} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.visual}>
            <View style={styles.iconHalo}>
              <SymbolView name={activeStep.icon} tintColor={palette.emerald} size={76} />
            </View>
            <View style={styles.miniCard}>
              <Text style={styles.miniLabel}>Fime setup</Text>
              <Text style={styles.miniValue}>{activeIndex + 1} of {steps.length}</Text>
            </View>
          </View>

          <View>
            <Text style={styles.title}>{activeStep.title}</Text>
            <Text style={styles.body}>{activeStep.body}</Text>
          </View>

          <View style={styles.dots}>
            {steps.map((step, index) => (
              <View
                key={step.title}
                style={[styles.dot, index === activeIndex && styles.activeDot]}
              />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          {!isFirstStep ? (
            <Pressable
              onPress={() => setActiveIndex((current) => Math.max(current - 1, 0))}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={goNext} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{isLastStep ? 'Get started' : 'Next'}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => finish('/login')} style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}>
          <Text style={styles.loginText}>I already have an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: palette.slate,
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 54,
  },
  brandImage: {
    height: '100%',
    width: '100%',
  },
  skipButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skipText: {
    color: palette.emerald,
    fontSize: 14,
    fontWeight: '900',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  visual: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    minHeight: 230,
  },
  iconHalo: {
    alignItems: 'center',
    backgroundColor: palette.emeraldSoft,
    borderColor: '#C7E2D6',
    borderRadius: 999,
    borderWidth: 1,
    height: 176,
    justifyContent: 'center',
    width: 176,
  },
  miniCard: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'absolute',
  },
  miniLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  miniValue: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  title: {
    color: palette.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  body: {
    color: palette.muted,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  dot: {
    backgroundColor: palette.border,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  activeDot: {
    backgroundColor: palette.emerald,
    width: 28,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    height: 54,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: radii.md,
    flex: 1,
    height: 54,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
  },
  loginButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  loginText: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.84,
  },
});
