import { ActionButton, insightFormStyles } from '@/components/insights-controls';
import { BottomSheet } from '@/components/BottomSheet';
import { Card, Muted, Screen, Title } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { formatMoney, todayISO } from '@/lib/finance/format';
import { useFinance } from '@/lib/finance/useFinance';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Svg, { Circle } from 'react-native-svg';

export default function GoalsScreen() {
  const { addSavingsGoal, goals } = useFinance();
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalSaved, setGoalSaved] = useState('');
  const [goalDue, setGoalDue] = useState(todayISO());
  const [sheetOpen, setSheetOpen] = useState(false);

  async function saveGoal() {
    const target = Number(goalTarget.replace(/,/g, ''));
    const saved = Number(goalSaved.replace(/,/g, '')) || 0;

    if (!goalName.trim() || target <= 0) {
      Alert.alert('Missing goal', 'Enter a goal name and target amount.');
      return;
    }

    await addSavingsGoal({
      dueDate: goalDue,
      name: goalName.trim(),
      savedAmount: saved,
      targetAmount: target,
    });
    setGoalName('');
    setGoalTarget('');
    setGoalSaved('');
    setGoalDue(todayISO());
    setSheetOpen(false);
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Title>Savings goals</Title>
          <Muted>Track money set aside for upcoming priorities.</Muted>
        </View>

        <View style={styles.goalList}>
          {goals.map((goal, index) => (
            <GoalCard
              key={goal.id}
              name={goal.name}
              savedAmount={goal.savedAmount}
              targetAmount={goal.targetAmount}
              variant={index % goalVariants.length}
            />
          ))}
        </View>
      </ScrollView>

      <Pressable onPress={() => setSheetOpen(true)} style={styles.fab}>
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={palette.white} size={30} />
      </Pressable>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Add goal</Text>
            <Muted>Set a target and track your progress.</Muted>
          </View>
          <Pressable onPress={() => setSheetOpen(false)} style={styles.closeButton}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.ink} size={22} />
          </Pressable>
        </View>
        <BottomSheetTextInput placeholder="Goal name" placeholderTextColor={palette.muted} style={insightFormStyles.input} value={goalName} onChangeText={setGoalName} />
        <View style={insightFormStyles.twoColumn}>
          <BottomSheetTextInput keyboardType="numeric" placeholder="Target" placeholderTextColor={palette.muted} style={insightFormStyles.inputFlex} value={goalTarget} onChangeText={setGoalTarget} />
          <BottomSheetTextInput keyboardType="numeric" placeholder="Saved" placeholderTextColor={palette.muted} style={insightFormStyles.inputFlex} value={goalSaved} onChangeText={setGoalSaved} />
        </View>
        <BottomSheetTextInput placeholder="Due date YYYY-MM-DD" placeholderTextColor={palette.muted} style={insightFormStyles.input} value={goalDue} onChangeText={setGoalDue} />
        <ActionButton label="Add goal" onPress={saveGoal} />
      </BottomSheet>
    </Screen>
  );
}

const goalVariants = [
  {
    color: palette.coral,
    icon: { ios: 'car.fill', android: 'directions_car', web: 'directions_car' },
    surface: palette.coralSoft,
  },
  {
    color: palette.gold,
    icon: { ios: 'graduationcap.fill', android: 'school', web: 'school' },
    surface: palette.goldSoft,
  },
  {
    color: palette.slate,
    icon: { ios: 'beach.umbrella.fill', android: 'beach_access', web: 'beach_access' },
    surface: palette.surfaceMuted,
  },
  {
    color: palette.emerald,
    icon: { ios: 'target', android: 'flag', web: 'flag' },
    surface: palette.emeraldSoft,
  },
] as const;

function GoalCard({
  name,
  savedAmount,
  targetAmount,
  variant,
}: {
  name: string;
  savedAmount: number;
  targetAmount: number;
  variant: number;
}) {
  const theme = goalVariants[variant];
  const progress = Math.min(savedAmount / Math.max(targetAmount, 1), 1);
  const percentage = Math.round(progress * 100);

  return (
    <View style={styles.goalCard}>
      <View style={[styles.iconTile, { backgroundColor: theme.surface }]}>
        <SymbolView name={theme.icon} tintColor={theme.color} size={28} />
      </View>

      <View style={styles.goalCopy}>
        <Text style={styles.goalTitle}>{name}</Text>
        <Text style={styles.goalAmount}>
          {formatMoney(savedAmount)} <Text style={styles.goalTarget}>of {formatMoney(targetAmount)}</Text>
        </Text>
      </View>

      <CircularProgress color={theme.color} progress={progress} percentage={percentage} />
    </View>
  );
}

function CircularProgress({
  color,
  percentage,
  progress,
}: {
  color: string;
  percentage: number;
  progress: number;
}) {
  const size = 72;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <View style={styles.circularWrap}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          stroke={palette.surfaceMuted}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.circularText, { color }]}>{percentage}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  goalList: {
    gap: spacing.md,
  },
  goalCard: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 116,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconTile: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  goalCopy: {
    flex: 1,
    minWidth: 0,
  },
  goalTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  goalAmount: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  goalTarget: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  circularWrap: {
    alignItems: 'center',
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  circularText: {
    fontSize: 16,
    fontWeight: '900',
    position: 'absolute',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: 999,
    bottom: spacing.lg,
    elevation: 8,
    height: 62,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    shadowColor: palette.slate,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    width: 62,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
});
