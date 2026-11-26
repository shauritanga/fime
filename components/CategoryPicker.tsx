import { palette, radii, spacing } from '@/constants/theme';
import {
  CategoryError,
  createCategory,
  deleteCategory,
  isCustomCategory,
  updateCategory,
} from '@/lib/finance/database';
import type { Category, TransactionType } from '@/lib/finance/types';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CategoryChips } from './insights-controls';

const suggestedEmojis = [
  '🛒', '📚', '👕', '⛽', '📱', '🙏', '👶', '🎓', '✈️', '🏥', '🐄', '🌱',
  '🔧', '💇', '🎁', '⚽', '🍺', '☕', '🐶', '🏦', '💻', '🧾', '🛠️', '❤️',
];

/** Category chips with the means to add, rename and remove the user's own categories. */
export function CategoryPicker({
  categories,
  inSheet,
  onChanged,
  onSelect,
  selectedId,
  type,
}: {
  /** The categories on offer, already limited to `type`. */
  categories: Category[];
  /** Set inside a BottomSheet, where text boxes must lift with the keyboard. */
  inSheet?: boolean;
  /** Reload the category list after a change. */
  onChanged: () => Promise<unknown> | unknown;
  onSelect: (id: string) => void;
  selectedId: string;
  type: TransactionType;
}) {
  const db = useSQLiteContext();
  // `null` when the form is closed; an empty id means a new category.
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = categories.find((item) => item.id === selectedId);
  const Input = inSheet ? BottomSheetTextInput : TextInput;

  function open(category?: Category) {
    setEditing({ id: category?.id ?? '' });
    setName(category?.name ?? '');
    setEmoji(category?.emoji ?? '');
    setError('');
  }

  async function run(change: () => Promise<void>) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await change();
      await onChanged();
      setEditing(null);
    } catch (cause) {
      if (!(cause instanceof CategoryError)) {
        console.warn('Unable to change the category', cause);
      }
      setError(cause instanceof CategoryError ? cause.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    run(async () => {
      if (editing?.id) {
        await updateCategory(db, editing.id, { name, emoji });
      } else {
        onSelect((await createCategory(db, { name, emoji, type })).id);
      }
    });
  }

  function confirmDelete(id: string) {
    Alert.alert('Delete category?', 'Any budget set for it is removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await deleteCategory(db, id);
            onSelect('');
          }),
      },
    ]);
  }

  return (
    <View>
      <CategoryChips categories={categories} onSelect={onSelect} selectedId={selectedId} />

      {editing === null ? (
        <View style={styles.links}>
          <Pressable accessibilityRole="button" onPress={() => open()} style={styles.link}>
            <Text style={styles.linkText}>+ New category</Text>
          </Pressable>
          {selected && isCustomCategory(selected.id) ? (
            <Pressable accessibilityRole="button" onPress={() => open(selected)} style={styles.link}>
              <Text style={styles.linkText}>Edit {selected.name}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>{editing.id ? 'Edit category' : `New ${type} category`}</Text>
          <Input
            accessibilityLabel="Category name"
            maxLength={30}
            onChangeText={setName}
            placeholder="Name, e.g. School fees"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={name}
          />
          <Text style={styles.label}>Emoji</Text>
          <View style={styles.grid}>
            {suggestedEmojis.map((item) => (
              <Pressable
                accessibilityLabel={`Emoji ${item}`}
                accessibilityRole="button"
                accessibilityState={{ selected: emoji === item }}
                key={item}
                onPress={() => setEmoji(item)}
                style={[styles.emoji, emoji === item && styles.emojiSelected]}>
                <Text style={styles.emojiText}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <Input
            accessibilityLabel="Or type your own emoji"
            onChangeText={setEmoji}
            placeholder="Or type any emoji from your keyboard"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={emoji}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={save} style={styles.primary}>
              <Text style={styles.primaryText}>{editing.id ? 'Save category' : 'Add category'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setEditing(null)} style={styles.link}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
            {editing.id ? (
              <Pressable accessibilityRole="button" onPress={() => confirmDelete(editing.id)} style={styles.link}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  link: {
    justifyContent: 'center',
    minHeight: 44,
  },
  linkText: {
    color: palette.emerald,
    fontSize: 14,
    fontWeight: '900',
  },
  deleteText: {
    color: palette.coral,
    fontSize: 14,
    fontWeight: '900',
  },
  form: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emoji: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emojiSelected: {
    backgroundColor: palette.emeraldSoft,
    borderColor: palette.emerald,
    borderWidth: 2,
  },
  emojiText: {
    fontSize: 22,
  },
  error: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  primary: {
    backgroundColor: palette.emerald,
    borderRadius: radii.sm,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  primaryText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '900',
  },
});
