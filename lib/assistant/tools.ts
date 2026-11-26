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
import { currentPeriod, isValidISODate, shiftPeriod, todayISO } from '../finance/format';
import type { Category, Transaction } from '../finance/types';

type Args = Record<string, unknown>;
type Categories = Map<string, Category>;

const MAX_LISTED = 15;
const MAX_DAYS_LISTED = 62;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function monthArgument(value: unknown) {
  const month = text(value);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : '';
}

function dateArgument(value: unknown) {
  const date = text(value);
  return isValidISODate(date) ? date : '';
}

/** The number of calendar days from one date to another, counting both. */
function dayCount(from: string, to: string) {
  const day = (value: string) => Date.parse(`${value}T00:00:00Z`);
  return Math.round((day(to) - day(from)) / 86_400_000) + 1;
}

function total(transactions: Transaction[], type: Transaction['type']) {
  return transactions.reduce((sum, item) => (item.type === type ? sum + item.amount : sum), 0);
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

async function categoryLookup(db: SQLiteDatabase): Promise<Categories> {
  const categories = await listCategories(db);
  return new Map(categories.map((category) => [category.id, category]));
}

function findCategory(categories: Categories, wanted: string) {
  const name = wanted.toLowerCase();
  return [...categories.values()].find((item) => item.name.toLowerCase() === name || item.id === name);
}

function unknownCategory(categories: Categories) {
  return {
    error: 'No category has that name.',
    categories: [...categories.values()].map((item) => item.name),
  };
}

function describe(item: Transaction, categories: Categories) {
  return {
    date: item.date,
    title: item.note.slice(0, 80),
    category: categories.get(item.categoryId)?.name ?? 'Other',
    type: item.type,
    amount: item.amount,
  };
}

function byCategory(transactions: Transaction[], categories: Categories) {
  const expense = total(transactions, 'expense');
  const byId = new Map<string, number>();
  for (const item of transactions) {
    if (item.type === 'expense') {
      byId.set(item.categoryId, (byId.get(item.categoryId) ?? 0) + item.amount);
    }
  }
  return [...byId.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => ({
      category: categories.get(id)?.name ?? 'Other',
      amount,
      percent: percent(amount, expense),
    }));
}

/** Totals for one day, a range of dates, or everything recorded. */
async function periodTotals(db: SQLiteDatabase, args: Args) {
  const categories = await categoryLookup(db);
  const wanted = text(args.category);
  const category = wanted ? findCategory(categories, wanted) : undefined;
  if (wanted && !category) {
    return unknownCategory(categories);
  }

  const allTime = args.all_time === true;
  const first = dateArgument(args.from);
  const second = dateArgument(args.to);
  // A date that can't be read must not quietly become "today".
  if (!allTime && ((args.from && !first) || (args.to && !second))) {
    return { error: 'Dates must be real dates written as YYYY-MM-DD.' };
  }

  const everything = await listTransactions(db); // newest first
  const today = todayISO();
  // With no dates at all, the question is about today.
  let from = allTime ? (everything[everything.length - 1]?.date ?? today) : first || second || today;
  let to = allTime ? (everything[0]?.date ?? today) : second || from;
  if (allTime && to < today) {
    to = today;
  }
  if (from > to) {
    [from, to] = [to, from];
  }

  const rows = everything.filter(
    (item) => item.date >= from && item.date <= to && (!category || item.categoryId === category.id)
  );
  const expense = total(rows, 'expense');
  const income = total(rows, 'income');

  const days = new Map<string, { date: string; expense: number; income: number }>();
  for (const item of rows) {
    const day = days.get(item.date) ?? { date: item.date, expense: 0, income: 0 };
    day[item.type] += item.amount;
    days.set(item.date, day);
  }
  const daily = [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
  const spendingDays = daily.filter((day) => day.expense > 0);
  const highest = [...spendingDays].sort((a, b) => b.expense - a.expense)[0];
  // Days that haven't happened yet don't count toward a daily average.
  const lastElapsed = to < today ? to : today;
  const elapsed = from <= lastElapsed ? dayCount(from, lastElapsed) : 0;
  const elapsedExpense = total(
    rows.filter((item) => item.date <= lastElapsed),
    'expense'
  );

  return {
    from,
    to,
    category: category?.name ?? 'all categories',
    calendar_days_so_far: elapsed,
    transaction_count: rows.length,
    income,
    expense,
    net: income - expense,
    average_expense_per_day: elapsed ? Math.round(elapsedExpense / elapsed) : null,
    days_with_spending: spendingDays.length,
    highest_spending_day: highest ? { date: highest.date, expense: highest.expense } : null,
    spending_by_category: byCategory(rows, categories),
    // Only days with records are listed; any other day in the range is zero.
    daily_totals: daily.slice(0, MAX_DAYS_LISTED),
    daily_totals_omitted: Math.max(daily.length - MAX_DAYS_LISTED, 0),
    transactions: rows.slice(0, MAX_LISTED).map((item) => describe(item, categories)),
    transactions_omitted: Math.max(rows.length - MAX_LISTED, 0),
  };
}

async function spendingSummary(db: SQLiteDatabase, args: Args) {
  const month = monthArgument(args.month) || currentPeriod();
  const categories = await categoryLookup(db);
  const transactions = await listTransactionsByPeriod(db, month);
  const income = total(transactions, 'income');
  const expense = total(transactions, 'expense');

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
    month,
    month_is_still_in_progress: month === currentPeriod(),
    transaction_count: transactions.length,
    income,
    expense,
    net: income - expense,
    spending_by_category: byCategory(transactions, categories),
    previous_months_with_data: earlier.length,
    previous_average_expense: average,
    expense_difference_from_average: average === null ? null : expense - average,
  };
}

async function findTransactions(db: SQLiteDatabase, args: Args) {
  const categories = await categoryLookup(db);
  const month = monthArgument(args.month);
  const from = dateArgument(args.from);
  const to = dateArgument(args.to);
  const query = text(args.query).toLowerCase();
  const wanted = text(args.category);
  const type = args.type === 'income' || args.type === 'expense' ? args.type : '';
  const category = wanted ? findCategory(categories, wanted) : undefined;
  if (wanted && !category) {
    return unknownCategory(categories);
  }

  const source = month ? await listTransactionsByPeriod(db, month) : await listTransactions(db);
  const matches = source.filter((item) => {
    const name = categories.get(item.categoryId)?.name ?? '';
    return (
      (!type || item.type === type) &&
      (!from || item.date >= from) &&
      (!to || item.date <= to) &&
      (!category || item.categoryId === category.id) &&
      (!query || item.note.toLowerCase().includes(query) || name.toLowerCase().includes(query))
    );
  });
  const listed = [...matches]
    .sort((a, b) => (args.sort === 'largest' ? b.amount - a.amount : 0))
    .slice(0, MAX_LISTED);

  return {
    month: month || 'all months',
    match_count: matches.length,
    total_expense: total(matches, 'expense'),
    total_income: total(matches, 'income'),
    listed: listed.length,
    transactions: listed.map((item) => describe(item, categories)),
  };
}

async function budgetStatus(db: SQLiteDatabase, args: Args) {
  const month = monthArgument(args.month) || currentPeriod();
  const budgets = await listBudgetProgress(db, month);
  const items = budgets
    .map((budget) => ({
      category: budget.category.name,
      limit: budget.limitAmount,
      spent: budget.spent,
      left: budget.limitAmount - budget.spent,
      percent_used: percent(budget.spent, budget.limitAmount),
    }))
    .sort((a, b) => b.percent_used - a.percent_used);

  return { month, budgets: items };
}

async function monthlyTrend(db: SQLiteDatabase, args: Args) {
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

  return { current_month_is_still_in_progress: currentPeriod(), months_with_data: months };
}

async function upcomingPayments(db: SQLiteDatabase) {
  const subscriptions = await listSubscriptions(db);
  const recurring = await listRecurringTransactions(db);
  const allLoans = await listLoans(db);
  const loans = allLoans.filter((loan) => loan.status === 'active');

  // Names of the people a loan is from are deliberately not sent.
  return {
    total_money_owed_on_loans: loans.reduce(
      (sum, loan) => sum + (loan.type === 'money' ? loan.remainingAmount : 0),
      0
    ),
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
    unpaid_loans: loans.map((loan) => ({
      title: loan.title,
      kind: loan.type,
      borrowed: loan.amount,
      repaid: loan.repaidAmount,
      still_owed: loan.type === 'money' ? loan.remainingAmount : null,
      due_date: loan.dueDate,
    })),
    settled_loans: allLoans
      .filter((loan) => loan.status !== 'active')
      .map((loan) => ({ title: loan.title, amount: loan.amount, status: loan.status })),
  };
}

async function savingsGoals(db: SQLiteDatabase) {
  const goals = (await listSavingsGoals(db)).map((goal) => ({
    name: goal.name,
    target: goal.targetAmount,
    saved: goal.savedAmount,
    remaining: Math.max(goal.targetAmount - goal.savedAmount, 0),
    percent_saved: percent(goal.savedAmount, goal.targetAmount),
    target_date: goal.dueDate,
  }));

  return { goals };
}

const tools: Record<string, (db: SQLiteDatabase, args: Args) => Promise<unknown>> = {
  period_totals: periodTotals,
  spending_summary: spendingSummary,
  find_transactions: findTransactions,
  budget_status: budgetStatus,
  monthly_trend: monthlyTrend,
  upcoming_payments: upcomingPayments,
  savings_goals: savingsGoals,
};

/** Runs one tool the model asked for; the result is sent back to it. */
export async function runTool(db: SQLiteDatabase, name: string, args: Args): Promise<unknown> {
  const tool = Object.prototype.hasOwnProperty.call(tools, name) ? tools[name] : undefined;
  if (!tool) {
    return { error: 'That tool is not available.' };
  }
  return tool(db, args);
}
