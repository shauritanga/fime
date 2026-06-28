import { financeStyles } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function CategoryChips({
  categories,
  onSelect,
  selectedId,
}: {
  categories: Array<{ id: string; name: string; color: string }>;
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  return (
    <View style={financeStyles.chipRow}>
      {categories.map((category) => (
        <Pressable
          key={category.id}
          onPress={() => onSelect(category.id)}
          style={[
            styles.categoryChip,
            selectedId === category.id && {
              backgroundColor: category.color,
              borderColor: category.color,
            },
          ]}>
          <Text style={[styles.categoryText, selectedId === category.id && styles.categoryTextActive]}>
            {category.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'muted';
}) {
  return (
    <Pressable onPress={onPress} style={[styles.action, tone === 'muted' && styles.actionMuted]}>
      <Text style={[styles.actionText, tone === 'muted' && styles.actionTextMuted]}>{label}</Text>
    </Pressable>
  );
}

export function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export const insightFormStyles = StyleSheet.create({
  input: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  inputFlex: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  segment: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.sm,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    padding: 4,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  segmentActive: {
    backgroundColor: palette.white,
  },
  segmentText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  segmentTextActive: {
    color: palette.ink,
  },
});

const styles = StyleSheet.create({
  categoryChip: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  categoryTextActive: {
    color: palette.white,
  },
  action: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: radii.sm,
    flex: 1,
    marginTop: spacing.sm,
    paddingVertical: 13,
  },
  actionMuted: {
    backgroundColor: palette.surfaceMuted,
  },
  actionText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '900',
  },
  actionTextMuted: {
    color: palette.ink,
  },
});
