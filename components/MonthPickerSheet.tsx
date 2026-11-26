import { BottomSheet } from '@/components/BottomSheet';
import { Muted } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Periods are "YYYY-MM" strings, so they compare correctly as text.
export function MonthPickerSheet({
  maxPeriod,
  minPeriod,
  onClose,
  onSelect,
  periodsWithData,
  selected,
}: {
  maxPeriod: string;
  minPeriod: string;
  onClose: () => void;
  onSelect: (period: string) => void;
  periodsWithData: string[];
  selected: string;
}) {
  const [year, setYear] = useState(Number(selected.slice(0, 4)));
  const canGoBack = year > Number(minPeriod.slice(0, 4));
  const canGoForward = year < Number(maxPeriod.slice(0, 4));
  const filled = new Set(periodsWithData);

  return (
    <BottomSheet onClose={onClose} visible>
      <View style={styles.yearRow}>
        <Pressable
          accessibilityLabel="Previous year"
          accessibilityRole="button"
          disabled={!canGoBack}
          onPress={() => setYear(year - 1)}
          style={[styles.yearButton, !canGoBack && styles.disabled]}>
          <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor={palette.emerald} size={22} />
        </Pressable>
        <Text style={styles.year}>{year}</Text>
        <Pressable
          accessibilityLabel="Next year"
          accessibilityRole="button"
          disabled={!canGoForward}
          onPress={() => setYear(year + 1)}
          style={[styles.yearButton, !canGoForward && styles.disabled]}>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.emerald} size={22} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {monthNames.map((name, index) => {
          const period = `${year}-${String(index + 1).padStart(2, '0')}`;
          const disabled = period < minPeriod || period > maxPeriod;
          const active = period === selected;
          const hasData = filled.has(period);

          return (
            <View key={period} style={styles.cell}>
              <Pressable
                accessibilityLabel={`${name} ${year}${hasData ? '' : ', no transactions'}`}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected: active }}
                disabled={disabled}
                onPress={() => onSelect(period)}
                style={[styles.month, hasData && styles.monthFilled, active && styles.monthActive, disabled && styles.disabled]}>
                <Text style={[styles.monthText, active && styles.monthTextActive]}>{name}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Muted>Shaded months have transactions.</Muted>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  yearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  yearButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  year: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
    marginHorizontal: -4,
  },
  cell: {
    padding: 4,
    width: '25%',
  },
  month: {
    alignItems: 'center',
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
  },
  monthFilled: {
    backgroundColor: palette.emeraldSoft,
    borderColor: palette.emeraldSoft,
  },
  monthActive: {
    backgroundColor: palette.emerald,
    borderColor: palette.emerald,
  },
  monthText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  monthTextActive: {
    color: palette.white,
  },
  disabled: {
    opacity: 0.3,
  },
});
