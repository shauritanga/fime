import { ProgressBar } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import type { AnswerCard } from '@/lib/assistant/types';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { assistantFonts as font, assistantTheme as theme } from './theme';

export function AnswerCardView({
  card,
  onOpenLink,
}: {
  card: AnswerCard;
  onOpenLink: (link: NonNullable<AnswerCard['link']>) => void;
}) {
  const link = card.link;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{card.title}</Text>
      {card.headline ? <Text style={styles.headline}>{card.headline}</Text> : null}
      {card.caption ? <Text style={styles.detail}>{card.caption}</Text> : null}

      {card.rows.map((row, index) => (
        <View key={`${row.label}-${index}`} style={styles.row}>
          <View style={styles.rowTop}>
            {row.color ? <View style={[styles.dot, { backgroundColor: row.color }]} /> : null}
            <Text numberOfLines={1} style={styles.label}>
              {row.label}
            </Text>
            <Text style={[styles.value, row.warning && styles.warning]}>{row.value}</Text>
          </View>
          {row.detail ? <Text style={styles.detail}>{row.detail}</Text> : null}
          {row.progress !== undefined ? (
            <ProgressBar value={row.progress} color={row.warning ? palette.coral : (row.color ?? palette.emerald)} />
          ) : null}
        </View>
      ))}

      {link ? (
        <Pressable accessibilityRole="link" onPress={() => onOpenLink(link)} style={styles.linkButton}>
          <Text style={styles.link}>{link.label} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: radii.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  title: {
    color: theme.faint,
    fontFamily: font.semibold,
    fontSize: 13,
  },
  headline: {
    color: theme.ink,
    fontFamily: font.bold,
    fontSize: 24,
    marginTop: 2,
  },
  row: {
    gap: 4,
    marginTop: spacing.sm,
  },
  rowTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  label: {
    color: theme.ink,
    flex: 1,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  value: {
    color: theme.ink,
    fontFamily: font.bold,
    fontSize: 14,
  },
  warning: {
    color: palette.coral,
  },
  detail: {
    color: palette.muted,
    fontFamily: font.medium,
    fontSize: 12,
  },
  linkButton: {
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 40,
  },
  link: {
    color: theme.accent,
    fontFamily: font.bold,
    fontSize: 15,
  },
});
