// Pure calculations behind the Analytics tab. Everything is based on recorded transactions.
import { shiftPeriod } from './format';
import type { Budget, Category, Transaction } from './types';

export type Totals = { income: number; expense: number; net: number };
export type Point = Totals & { key: string; label: string; title: string };
export type Range = 'days' | 'months' | 'year';

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Colour belongs to the category, so it stays the same whatever its rank. */
const chartColors: Record<string, string> = {
  food: '#f47230',
  transport: '#257de0',
  home: '#f2a600',
  utilities: '#6a4ce2',
  health: '#ee7fac',
  fun: '#00b894',
  'loan-repayment': '#008a17',
};
export const otherColor = '#9AA19D';

export function categoryColor(categoryId: string, own?: string) {
  return chartColors[categoryId] ?? own ?? otherColor;
}

export function sumTotals(transactions: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const item of transactions) {
    if (item.type === 'income') {
      income += item.amount;
    } else {
      expense += item.amount;
    }
  }
  return { income, expense, net: income - expense };
}

export function inMonth(transactions: Transaction[], period: string, lastDay = 31) {
  const limit = `${period}-${String(lastDay).padStart(2, '0')}`;
  return transactions.filter((item) => item.date.startsWith(period) && item.date <= limit);
}

export function daysInMonth(period: string) {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/**
 * The same stretch of the month before. While a month is still running, it is compared with the
 * same number of days, so a part month isn't set against a whole one.
 */
export function previousComparable(transactions: Transaction[], period: string, today: string) {
  const running = today.startsWith(period);
  const lastDay = running ? Number(today.slice(8, 10)) : 31;
  return { rows: inMonth(transactions, shiftPeriod(period, -1), lastDay), sameDays: running };
}

/** Percentage change, or `null` when there is nothing earlier to compare with. */
export function change(current: number, previous: number) {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

export function monthSeries(transactions: Transaction[], endPeriod: string, count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const period = shiftPeriod(endPeriod, index - count + 1);
    const label = monthLabels[Number(period.slice(5, 7)) - 1];
    return {
      key: period,
      label,
      title: `${label} ${period.slice(0, 4)}`,
      ...sumTotals(inMonth(transactions, period)),
    };
  });
}

/** One point per day of the month, up to today for the running month. */
export function daySeries(transactions: Transaction[], period: string, today: string): Point[] {
  const count = today.startsWith(period) ? Number(today.slice(8, 10)) : daysInMonth(period);
  const rows = inMonth(transactions, period);
  const month = monthLabels[Number(period.slice(5, 7)) - 1];
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    const key = `${period}-${String(day).padStart(2, '0')}`;
    return {
      key,
      label: String(day),
      title: `${day} ${month}`,
      ...sumTotals(rows.filter((item) => item.date === key)),
    };
  });
}

export type CategorySpend = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  amount: number;
  /** 0 to 1 of the month's spending. */
  share: number;
  count: number;
  previous: number;
};

export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  period: string,
  today: string
): CategorySpend[] {
  const expenses = inMonth(transactions, period).filter((item) => item.type === 'expense');
  const earlier = previousComparable(transactions, period, today).rows.filter((item) => item.type === 'expense');
  const total = sumTotals(expenses).expense;
  const ids = [...new Set(expenses.map((item) => item.categoryId))];

  return ids
    .map((id) => {
      const rows = expenses.filter((item) => item.categoryId === id);
      const amount = sumTotals(rows).expense;
      const category = categories.find((item) => item.id === id);
      return {
        id,
        name: category?.name ?? 'Other',
        emoji: category?.emoji ?? '',
        color: categoryColor(id, category?.color),
        amount,
        share: total > 0 ? amount / total : 0,
        count: rows.length,
        previous: sumTotals(earlier.filter((item) => item.categoryId === id)).expense,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** At most `limit` slices; the smallest are gathered into "Other" so the ring stays readable. */
export function donutSlices(items: CategorySpend[], limit = 6) {
  const slices = items.map(({ id, name, color, amount, share }) => ({ id, name, color, amount, share }));
  if (slices.length <= limit) {
    return slices;
  }
  const rest = slices.slice(limit - 1);
  return [
    ...slices.slice(0, limit - 1),
    {
      id: 'other',
      name: 'Other',
      color: otherColor,
      amount: rest.reduce((sum, item) => sum + item.amount, 0),
      share: rest.reduce((sum, item) => sum + item.share, 0),
    },
  ];
}

export type BudgetLine = {
  id: string;
  name: string;
  limit: number;
  spent: number;
  status: 'over' | 'close' | 'ok';
};

export function budgetReport(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  period: string,
  today: string
) {
  const spending = categoryBreakdown(transactions, categories, period, today);
  const lines: BudgetLine[] = budgets
    .map((budget) => {
      const spent = spending.find((item) => item.id === budget.categoryId)?.amount ?? 0;
      return {
        id: budget.categoryId,
        name: categories.find((category) => category.id === budget.categoryId)?.name ?? 'Other',
        limit: budget.limitAmount,
        spent,
        status: (spent > budget.limitAmount ? 'over' : spent >= budget.limitAmount * 0.85 ? 'close' : 'ok') as BudgetLine['status'],
      };
    })
    .sort((a, b) => b.spent / (b.limit || 1) - a.spent / (a.limit || 1));

  const limit = lines.reduce((sum, line) => sum + line.limit, 0);
  const spent = lines.reduce((sum, line) => sum + line.spent, 0);
  const running = today.startsWith(period);
  const day = Number(today.slice(8, 10));
  const days = daysInMonth(period);

  return {
    lines,
    limit,
    spent,
    unbudgeted: spending.filter((item) => !budgets.some((budget) => budget.categoryId === item.id)),
    // A straight-line estimate, rounded to thousands; too early in the month it would swing wildly.
    projected: running && day >= 7 ? Math.round((spent / day) * days / 1000) * 1000 : null,
    daysLeft: running ? days - day : 0,
  };
}

/** A round number at or above `value`, for the top of a chart's axis. */
export function niceCeiling(value: number) {
  if (value <= 0) {
    return 1;
  }
  const scale = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((option) => option * scale >= value) ?? 10;
  return step * scale;
}

export function compactNumber(value: number) {
  const format = (scaled: number, suffix: string) => `${Number(scaled.toFixed(scaled < 10 ? 1 : 0))}${suffix}`;
  if (Math.abs(value) >= 1_000_000_000) return format(value / 1_000_000_000, 'B');
  if (Math.abs(value) >= 1_000_000) return format(value / 1_000_000, 'M');
  if (Math.abs(value) >= 1_000) return format(value / 1_000, 'k');
  return String(Math.round(value));
}
