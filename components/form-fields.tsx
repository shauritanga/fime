import { palette, radii, spacing } from '@/constants/theme';
import { formatFullDate, isValidISODate, toISODate } from '@/lib/finance/format';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ComponentProps, PropsWithChildren, useState } from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

type FieldProps = PropsWithChildren<{
  label: string;
  style?: StyleProp<ViewStyle>;
}>;

/** A label that stays visible, unlike a placeholder. */
export function Field({ children, label, style }: FieldProps) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

/** Labelled text input for use inside a BottomSheet. */
export function SheetInput({
  containerStyle,
  label,
  style,
  ...inputProps
}: ComponentProps<typeof BottomSheetTextInput> & { containerStyle?: StyleProp<ViewStyle>; label: string }) {
  return (
    <Field label={label} style={containerStyle}>
      <BottomSheetTextInput
        accessibilityLabel={label}
        placeholderTextColor={palette.muted}
        {...inputProps}
        style={[styles.input, style]}
      />
    </Field>
  );
}

export function DateField({
  label,
  maximumDate,
  onChange,
  style,
  value,
}: {
  label: string;
  maximumDate?: Date;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  // Fall back to today if an old, hand-typed value isn't a real date.
  const dateValue = isValidISODate(value) ? new Date(`${value}T12:00:00`) : new Date();

  return (
    <Field label={label} style={style}>
      <Pressable
        accessibilityLabel={`${label}: ${formatFullDate(value)}`}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={styles.input}>
        <Text style={styles.value}>{formatFullDate(value)}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          maximumDate={maximumDate}
          mode="date"
          onDismiss={() => setOpen(false)}
          onValueChange={(_event, selected) => {
            setOpen(Platform.OS === 'ios');
            onChange(toISODate(selected));
          }}
          value={dateValue}
        />
      ) : null}
    </Field>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.sm,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  value: {
    color: palette.ink,
    fontSize: 15,
  },
});
