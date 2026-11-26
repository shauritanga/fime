import { palette, spacing } from '@/constants/theme';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

/** Floating shortcut to the new-transaction form. */
export function AddButton() {
  return (
    <Pressable
      accessibilityLabel="Add transaction"
      accessibilityRole="button"
      onPress={() => router.navigate('/add')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={palette.white} size={30} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: 999,
    bottom: spacing.md,
    elevation: 8,
    height: 60,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    width: 60,
  },
  pressed: {
    opacity: 0.84,
  },
});
