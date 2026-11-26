import { palette, radii, spacing } from '@/constants/theme';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

/**
 * A button with a small menu floating under it, like the chart menu on Home. The menu overlaps
 * what follows, so give the surrounding row a `zIndex` above its later siblings.
 */
export function PopupMenu<T extends string>({
  accessibilityLabel,
  buttonStyle,
  children,
  onChange,
  options,
  value,
}: {
  accessibilityLabel: string;
  buttonStyle?: StyleProp<ViewStyle>;
  /** What the button shows. */
  children: ReactNode;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [buttonStyle, pressed && styles.pressed]}>
        {children}
      </Pressable>

      {open ? (
        <View style={styles.menu}>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.item,
                option.value === value && styles.itemActive,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.text, option.value === value && styles.textActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    position: 'relative',
    zIndex: 10,
  },
  menu: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    elevation: 8,
    padding: 4,
    position: 'absolute',
    right: 0,
    shadowColor: palette.slate,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    top: 40,
    width: 180,
    zIndex: 20,
  },
  item: {
    borderRadius: radii.sm,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  itemActive: {
    backgroundColor: palette.emeraldSoft,
  },
  text: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  textActive: {
    color: palette.emerald,
  },
  pressed: {
    opacity: 0.76,
  },
});
