import { ProgressBar } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import type { AnswerCard } from '@/lib/assistant/types';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  title: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  headline: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
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
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  value: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  warning: {
    color: palette.coral,
  },
  detail: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  linkButton: {
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 40,
  },
  link: {
    color: palette.emerald,
    fontSize: 14,
    fontWeight: '900',
  },
});
