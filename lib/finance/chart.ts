import type { ExpenseChartBar, ExpenseChartRange, Transaction, TrendChartPoint } from './types';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildExpenseChartData(
  transactions: Transaction[],
  range: ExpenseChartRange,
  now = new Date()
): ExpenseChartBar[] {
  const expenses = transactions.filter((transaction) => transaction.type === 'expense');

  if (range === 'weekly') {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      return {
        key: toISODate(date),
        label: dayLabels[date.getDay()],
        total: 0,
      };
    });

    return sumIntoBuckets(expenses, days, (date) => toISODate(date));
  }

  if (range === 'monthly') {
    const year = now.getFullYear();
    const month = now.getMonth();
    const weeksInMonth = Math.ceil(new Date(year, month + 1, 0).getDate() / 7);
    const weeks = Array.from({ length: weeksInMonth }, (_, index) => ({
      key: String(index + 1),
      label: `W${index + 1}`,
      total: 0,
    }));

    return sumIntoBuckets(expenses, weeks, (date) => {
      if (date.getFullYear() !== year || date.getMonth() !== month) {
        return '';
      }
      return String(Math.ceil(date.getDate() / 7));
    });
  }

  const year = now.getFullYear();
  const months = monthLabels.map((label, index) => ({
    key: String(index),
    label,
    total: 0,
  }));

  return sumIntoBuckets(expenses, months, (date) => {
    if (date.getFullYear() !== year) {
      return '';
    }
    return String(date.getMonth());
  });
}

export function buildIncomeExpenseTrendData(
  transactions: Transaction[],
  range: ExpenseChartRange,
  now = new Date()
): TrendChartPoint[] {
  const buckets = buildTrendBuckets(range, now);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const transaction of transactions) {
    const date = new Date(`${transaction.date}T12:00:00`);
    const bucket = bucketMap.get(getBucketKey(date, range, now));

    if (!bucket) {
      continue;
    }

    if (transaction.type === 'income') {
      bucket.income += transaction.amount;
    } else {
      bucket.expense += transaction.amount;
    }
  }

  return buckets.map(({ label, income, expense }) => ({ label, income, expense }));
}

function buildTrendBuckets(range: ExpenseChartRange, now: Date) {
  if (range === 'weekly') {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      return {
        key: toISODate(date),
        label: dayLabels[date.getDay()],
        income: 0,
        expense: 0,
      };
    });
  }

  if (range === 'monthly') {
    const weeksInMonth = Math.ceil(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() / 7);
    return Array.from({ length: weeksInMonth }, (_, index) => ({
      key: String(index + 1),
      label: `W${index + 1}`,
      income: 0,
      expense: 0,
    }));
  }

  return monthLabels.map((label, index) => ({
    key: String(index),
    label,
    income: 0,
    expense: 0,
  }));
}

function getBucketKey(date: Date, range: ExpenseChartRange, now: Date) {
  if (range === 'weekly') {
    return toISODate(date);
  }

  if (range === 'monthly') {
    if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) {
      return '';
    }
    return String(Math.ceil(date.getDate() / 7));
  }

  if (date.getFullYear() !== now.getFullYear()) {
    return '';
  }
  return String(date.getMonth());
}

function sumIntoBuckets(
  transactions: Transaction[],
  buckets: Array<ExpenseChartBar & { key: string }>,
  getKey: (date: Date) => string
) {
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const transaction of transactions) {
    const date = new Date(`${transaction.date}T12:00:00`);
    const bucket = bucketMap.get(getKey(date));

    if (bucket) {
      bucket.total += transaction.amount;
    }
  }

  return buckets.map(({ label, total }) => ({ label, total }));
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}
