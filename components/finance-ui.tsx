import { palette, radii, spacing } from '@/constants/theme';
import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

type CardProps = PropsWithChildren<{
  tone?: 'default' | 'dark' | 'soft';
}>;

type ScreenProps = PropsWithChildren<{
  edges?: Edge[];
}>;

export function Screen({ children, edges }: ScreenProps) {
  // White safe-area insets (status bar strip + bottom) with a cream content area.
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <View style={styles.screen}>{children}</View>
    </SafeAreaView>
  );
}

export function Card({ children, tone = 'default' }: CardProps) {
  return <View style={[styles.card, tone === 'dark' && styles.darkCard, tone === 'soft' && styles.softCard]}>{children}</View>;
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function ProgressBar({ value, color = palette.emerald }: { value: number; color?: string }) {
  const clampedValue = Math.max(0, Math.min(value, 1));
  const fillWidth = clampedValue === 0 ? 0 : Math.max(0.04, clampedValue) * 100;

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${fillWidth}%`, backgroundColor: color }]} />
    </View>
  );
}

export const financeStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  value: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  label: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.white,
    flex: 1,
  },
  screen: {
    backgroundColor: palette.background,
    flex: 1,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  darkCard: {
    backgroundColor: palette.slate,
    borderColor: palette.slate,
  },
  softCard: {
    backgroundColor: palette.emeraldSoft,
    borderColor: '#C7E2D6',
  },
  eyebrow: {
    color: palette.emerald,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  muted: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  progressTrack: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
});
