import { Share } from 'react-native';
import type { Category, Transaction } from './types';

function csv(value: string) {
  // A leading =, +, - or @ would be treated as a formula by spreadsheet apps.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Opens the share sheet with every transaction as CSV; the user chooses where it goes. */
export async function shareTransactionsCsv(transactions: Transaction[], categories: Category[]) {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const rows = [
    'id,type,amount,category,note,date',
    ...transactions.map((item) =>
      [item.id, item.type, item.amount, csv(names.get(item.categoryId) ?? 'Category'), csv(item.note), item.date].join(',')
    ),
  ];

  await Share.share({ message: rows.join('\n'), title: 'Fime transactions export' });
  return transactions.length;
}
