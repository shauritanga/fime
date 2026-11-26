// The "retrieval" half of the assistant: each tool reads the phone's database and does the sums here,
// so the model never has to add numbers and only receives what the question needs.
// The matching tool descriptions are in server/app/prompt.py.
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  listBudgetProgress,
  listCategories,
  listLoans,
  listRecurringTransactions,
  listSavingsGoals,
  listSubscriptions,
  listTransactions,
  listTransactionsByPeriod,
} from '../finance/database';
import { currentPeriod, formatFullDate, formatMoney, formatPeriod, shiftPeriod } from '../finance/format';
import type { Transaction } from '../finance/types';
import type { CardRow, ToolOutput } from './types';

type Args = Record<string, unknown>;

const MAX_LISTED = 15;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function monthArgument(value: unknown) {
  const month = text(value);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : '';
}

function total(transactions: Transaction[], type: Transaction['type']) {
  return transactions.reduce((sum, item) => (item.type === type ? sum + item.amount : sum), 0);
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

async function categoryLookup(db: SQLiteDatabase) {
  const categories = await listCategories(db);
  return new Map(categories.map((category) => [category.id, category]));
}

async function spendingSummary(db: SQLiteDatabase, args: Args): Promise<ToolOutput> {
  const month = monthArgument(args.month) || currentPeriod();
  const categories = await categoryLookup(db);
  const transactions = await listTransactionsByPeriod(db, month);
  const income = total(transactions, 'income');
  const expense = total(transactions, 'expense');

  const byId = new Map<string, number>();
  for (const item of transactions) {
    if (item.type === 'expense') {
      byId.set(item.categoryId, (byId.get(item.categoryId) ?? 0) + item.amount);
    }
  }
  const breakdown = [...byId.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => ({
      id,
      category: categories.get(id)?.name ?? 'Other',
      color: categories.get(id)?.color,
      amount,
      percent: percent(amount, expense),
    }));

  // Only months that have records count, so a new user isn't compared with empty months.
  const earlier: number[] = [];
  for (let offset = 1; offset <= 3; offset += 1) {
    const rows = await listTransactionsByPeriod(db, shiftPeriod(month, -offset));
    if (rows.length > 0) {
      earlier.push(total(rows, 'expense'));
    }
  }
  const average = earlier.length ? Math.round(earlier.reduce((a, b) => a + b, 0) / earlier.length) : null;

  return {
    data: {
      month,
      month_is_still_in_progress: month === currentPeriod(),
      transaction_count: transactions.length,
      income,
      expense,
      net: income - expense,
      spending_by_category: breakdown.map(({ category, amount, percent: share }) => ({
        category,
        amount,
        percent: share,
      })),
      previous_months_with_data: earlier.length,
      previous_average_expense: average,
      expense_difference_from_average: average === null ? null : expense - average,
    },
    card: transactions.length
      ? {
          title: `Spending in ${formatPeriod(month)}`,
          headline: formatMoney(expense),
          caption: `Income ${formatMoney(income)}`,
          rows: breakdown.slice(0, 5).map((item) => ({
            label: item.category,
            value: formatMoney(item.amount),
            detail: `${item.percent}%`,
            color: item.color,
            progress: item.percent / 100,
          })),
          link: { label: 'See where you spent it', period: month },
        }
      : undefined,
  };
}

async function findTransactions(db: SQLiteDatabase, args: Args): Promise<ToolOutput> {
  const categories = await categoryLookup(db);
  const month = monthArgument(args.month);
  const query = text(args.query).toLowerCase();
  const wanted = text(args.category).toLowerCase();
  const type = args.type === 'income' || args.type === 'expense' ? args.type : '';
  const category = [...categories.values()].find(
    (item) => item.name.toLowerCase() === wanted || item.id === wanted
  );
  if (wanted && !category) {
    return {
      data: {
        error: 'No category has that name.',
        categories: [...categories.values()].map((item) => item.name),
      },
    };
  }

  const source = month ? await listTransactionsByPeriod(db, month) : await listTransactions(db);
  const matches = source.filter((item) => {
    const name = categories.get(item.categoryId)?.name ?? '';
    return (
      (!type || item.type === type) &&
      (!category || item.categoryId === category.id) &&
      (!query || item.note.toLowerCase().includes(query) || name.toLowerCase().includes(query))
    );
  });
  const listed = [...matches]
    .sort((a, b) => (args.sort === 'largest' ? b.amount - a.amount : 0))
    .slice(0, MAX_LISTED);

  return {
    data: {
      month: month || 'all months',
      match_count: matches.length,
      total_expense: total(matches, 'expense'),
      total_income: total(matches, 'income'),
      listed: listed.length,
      transactions: listed.map((item) => ({
        date: item.date,
        title: item.note.slice(0, 80),
        category: categories.get(item.categoryId)?.name ?? 'Other',
        type: item.type,
        amount: item.amount,
      })),
    },
    card: listed.length
      ? {
          title: `${matches.length} ${matches.length === 1 ? 'transaction' : 'transactions'}`,
          caption: matches.length > 6 ? 'Showing the first 6' : undefined,
          rows: listed.slice(0, 6).map((item) => ({
            label: item.note || categories.get(item.categoryId)?.name || 'Transaction',
            value: `${item.type === 'income' ? '+' : '−'}${formatMoney(item.amount)}`,
            detail: formatFullDate(item.date),
            color: categories.get(item.categoryId)?.color,
          })),
          link: { label: 'Open transactions', period: month || undefined, categoryId: category?.id },
        }
      : undefined,
  };
}

async function budgetStatus(db: SQLiteDatabase, args: Args): Promise<ToolOutput> {
  const month = monthArgument(args.month) || currentPeriod();
  const budgets = await listBudgetProgress(db, month);
  const items = budgets
    .map((budget) => ({
      category: budget.category.name,
      color: budget.category.color,
      limit: budget.limitAmount,
      spent: budget.spent,
      left: budget.limitAmount - budget.spent,
      percent_used: percent(budget.spent, budget.limitAmount),
    }))
    .sort((a, b) => b.percent_used - a.percent_used);

  return {
    data: { month, budgets: items.map(({ color: _color, ...item }) => item) },
    card: items.length
      ? {
          title: `Budgets for ${formatPeriod(month)}`,
          rows: items.map((item) => ({
            label: item.category,
            value: item.left >= 0 ? `${formatMoney(item.left)} left` : `${formatMoney(-item.left)} over`,
            detail: `${item.percent_used}%`,
            color: item.color,
            progress: item.percent_used / 100,
            warning: item.percent_used >= 85,
          })),
        }
      : undefined,
  };
}

async function monthlyTrend(db: SQLiteDatabase, args: Args): Promise<ToolOutput> {
  const requested = Math.round(Number(args.months));
  const count = Number.isFinite(requested) ? Math.min(12, Math.max(2, requested)) : 6;
  const months: Array<{ month: string; income: number; expense: number; net: number }> = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const month = shiftPeriod(currentPeriod(), -offset);
    const rows = await listTransactionsByPeriod(db, month);
    if (rows.length > 0) {
      const income = total(rows, 'income');
      const expense = total(rows, 'expense');
      months.push({ month, income, expense, net: income - expense });
    }
  }
  const largest = Math.max(1, ...months.map((item) => item.expense));

  return {
    data: { current_month_is_still_in_progress: currentPeriod(), months_with_data: months },
    card: months.length
      ? {
          title: 'Spending by month',
          rows: months.map((item) => ({
            label: formatPeriod(item.month),
            value: formatMoney(item.expense),
            progress: item.expense / largest,
          })),
        }
      : undefined,
  };
}

async function upcomingPayments(db: SQLiteDatabase): Promise<ToolOutput> {
  const subscriptions = await listSubscriptions(db);
  const recurring = await listRecurringTransactions(db);
  const loans = (await listLoans(db)).filter((loan) => loan.status === 'active');

  // Names of the people a loan is from are deliberately not sent.
  const loanItems = loans.map((loan) => ({
    title: loan.title,
    kind: loan.type,
    still_owed: loan.type === 'money' ? loan.remainingAmount : null,
    due_date: loan.dueDate,
  }));
  const rows: Array<CardRow & { date: string }> = [
    ...subscriptions.map((item) => ({
      date: item.nextDueDate,
      label: item.name,
      value: formatMoney(item.amount),
      detail: `Subscription · ${formatFullDate(item.nextDueDate)}`,
    })),
    ...recurring
      .filter((item) => item.type === 'expense')
      .map((item) => ({
        date: item.nextDate,
        label: item.note,
        value: formatMoney(item.amount),
        detail: `${item.frequency === 'weekly' ? 'Weekly' : 'Monthly'} · ${formatFullDate(item.nextDate)}`,
      })),
    ...loanItems.map((item) => ({
      date: item.due_date,
      label: item.title,
      value: item.still_owed === null ? 'Return item' : formatMoney(item.still_owed),
      detail: `Loan · ${formatFullDate(item.due_date)}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const totalOwed = loans.reduce((sum, loan) => sum + (loan.type === 'money' ? loan.remainingAmount : 0), 0);

  return {
    data: {
      total_money_owed_on_loans: totalOwed,
      subscriptions: subscriptions.map((item) => ({
        name: item.name,
        monthly_amount: item.amount,
        next_due_date: item.nextDueDate,
      })),
      recurring: recurring.map((item) => ({
        title: item.note,
        type: item.type,
        amount: item.amount,
        frequency: item.frequency,
        next_date: item.nextDate,
      })),
      unpaid_loans: loanItems,
    },
    card: rows.length
      ? {
          title: 'Coming up',
          caption: totalOwed > 0 ? `Still owed on loans: ${formatMoney(totalOwed)}` : undefined,
          rows: rows.slice(0, 8),
        }
      : undefined,
  };
}

async function savingsGoals(db: SQLiteDatabase): Promise<ToolOutput> {
  const goals = (await listSavingsGoals(db)).map((goal) => ({
    name: goal.name,
    target: goal.targetAmount,
    saved: goal.savedAmount,
    remaining: Math.max(goal.targetAmount - goal.savedAmount, 0),
    percent_saved: percent(goal.savedAmount, goal.targetAmount),
    target_date: goal.dueDate,
  }));

  return {
    data: { goals },
    card: goals.length
      ? {
          title: 'Savings goals',
          rows: goals.map((goal) => ({
            label: goal.name,
            value: `${formatMoney(goal.saved)} of ${formatMoney(goal.target)}`,
            detail: `${goal.percent_saved}%`,
            progress: goal.percent_saved / 100,
          })),
        }
      : undefined,
  };
}

const tools: Record<string, (db: SQLiteDatabase, args: Args) => Promise<ToolOutput>> = {
  spending_summary: spendingSummary,
  find_transactions: findTransactions,
  budget_status: budgetStatus,
  monthly_trend: monthlyTrend,
  upcoming_payments: upcomingPayments,
  savings_goals: savingsGoals,
};

export async function runTool(db: SQLiteDatabase, name: string, args: Args): Promise<ToolOutput> {
  const tool = Object.prototype.hasOwnProperty.call(tools, name) ? tools[name] : undefined;
  if (!tool) {
    return { data: { error: 'That tool is not available.' } };
  }
  return tool(db, args);
}
