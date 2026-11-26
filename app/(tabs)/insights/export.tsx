import { ActionButton } from '@/components/insights-controls';
import { Card, Muted, Screen } from '@/components/finance-ui';
import { palette, spacing } from '@/constants/theme';
import { shareTransactionsCsv } from '@/lib/finance/export';
import { useFinance } from '@/lib/finance/useFinance';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ExportScreen() {
  const { categories, transactions } = useFinance();

  function exportCsv() {
    return shareTransactionsCsv(transactions, categories);
  }

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card tone="soft">
          <Text style={styles.count}>{transactions.length}</Text>
          <Muted>{transactions.length === 1 ? 'transaction' : 'transactions'} ready to export</Muted>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>CSV export</Text>
          <Muted>The export includes id, type, amount, category, note, and date.</Muted>
          <ActionButton label="Export CSV" onPress={exportCsv} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  count: {
    color: palette.ink,
    fontSize: 42,
    fontWeight: '900',
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
});
