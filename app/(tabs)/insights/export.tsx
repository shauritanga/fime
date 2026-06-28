import { ActionButton, csv } from '@/components/insights-controls';
import { Card, Muted, Screen, Title } from '@/components/finance-ui';
import { palette, spacing } from '@/constants/theme';
import { useFinance } from '@/lib/finance/useFinance';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

export default function ExportScreen() {
  const { categories, transactions } = useFinance();
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  async function exportCsv() {
    const rows = [
      'id,type,amount,category,note,date',
      ...transactions.map((transaction) => {
        const category = categoryMap.get(transaction.categoryId)?.name ?? 'Category';
        return [
          transaction.id,
          transaction.type,
          transaction.amount,
          csv(category),
          csv(transaction.note),
          transaction.date,
        ].join(',');
      }),
    ];

    await Share.share({
      message: rows.join('\n'),
      title: 'Fime transactions export',
    });
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Title>Export</Title>
          <Muted>Share a CSV copy of your local Fime transactions.</Muted>
        </View>

        <Card tone="soft">
          <Text style={styles.count}>{transactions.length}</Text>
          <Muted>transactions ready to export</Muted>
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
