import { palette, radii, spacing } from '@/constants/theme';
import type { ExpenseChartRange } from '@/lib/finance/types';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const ranges: Array<{ label: string; value: ExpenseChartRange }> = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

export function ChartRangeMenu({
  onChange,
  value,
}: {
  onChange: (value: ExpenseChartRange) => void;
  value: ExpenseChartRange;
}) {
  const [open, setOpen] = useState(false);
  const selected = ranges.find((item) => item.value === value) ?? ranges[0];

  function selectRange(nextValue: ExpenseChartRange) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setOpen((current) => !current)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{selected.label}</Text>
        <SymbolView
          name={{ ios: open ? 'chevron.up' : 'chevron.down', android: open ? 'keyboard_arrow_up' : 'keyboard_arrow_down', web: open ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}
          tintColor={palette.emerald}
          size={18}
        />
      </Pressable>

      {open && (
        <View style={styles.menu}>
          {ranges.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => selectRange(item.value)}
              style={({ pressed }) => [styles.menuItem, value === item.value && styles.menuItemActive, pressed && styles.pressed]}>
              <Text style={[styles.menuText, value === item.value && styles.menuTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    position: 'relative',
    zIndex: 10,
  },
  button: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  buttonText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  menu: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    elevation: 8,
    minWidth: 116,
    padding: 4,
    position: 'absolute',
    right: 0,
    shadowColor: palette.slate,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    top: 44,
    zIndex: 20,
  },
  menuItem: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  menuItemActive: {
    backgroundColor: palette.emeraldSoft,
  },
  menuText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  menuTextActive: {
    color: palette.emerald,
  },
  pressed: {
    opacity: 0.76,
  },
});
