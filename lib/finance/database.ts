import type { SQLiteDatabase } from 'expo-sqlite';
import { defaultCategories } from './seed';
import {
  addMonth,
  currentPeriod,
  isValidISODate,
  periodFromISODate,
  shiftPeriod,
  toISODate,
  todayISO,
} from './format';
import type {
  Budget,
  BudgetInput,
  BudgetProgress,
  Category,
  DashboardSummary,
  Loan,
  LoanActivity,
  LoanActivityInput,
  LoanInput,
  LoanProgress,
  RecurringTransaction,
  RecurringTransactionInput,
  SavingsGoal,
  SavingsGoalInput,
  Subscription,
  SubscriptionInput,
  Transaction,
  TransactionInput,
  TransactionSearch,
} from './types';

type SumRow = { total: number | null };
type MetaRow = { value: string };

export const LOAN_REPAYMENT_CATEGORY_ID = 'loan-repayment';

export class BudgetRequiredError extends Error {
  categoryId: string;
  period: string;

  constructor(categoryId: string, period: string) {
    super(`A budget is required for ${categoryId} in ${period}`);
    this.name = 'BudgetRequiredError';
    this.categoryId = categoryId;
    this.period = period;
  }
}

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      categoryId TEXT NOT NULL,
      note TEXT NOT NULL,
      date TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY NOT NULL,
      categoryId TEXT NOT NULL,
      limitAmount REAL NOT NULL,
      period TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      targetAmount REAL NOT NULL,
      savedAmount REAL NOT NULL,
      dueDate TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      categoryId TEXT NOT NULL,
      nextDueDate TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      categoryId TEXT NOT NULL,
      note TEXT NOT NULL,
      nextDate TEXT NOT NULL,
      frequency TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      counterparty TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      dueDate TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loan_activities (
      id TEXT PRIMARY KEY NOT NULL,
      loanId TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      transactionId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  for (const category of defaultCategories) {
    await db.runAsync(
      `INSERT INTO categories (id, name, type, color)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type, color = excluded.color`,
      category.id,
      category.name,
      category.type,
      category.color
    );
  }

  const cleanupFlag = 'database-cleaned-v1';
  const cleanupRow = await db.getFirstAsync<MetaRow>(
    'SELECT value FROM app_meta WHERE key = ?',
    cleanupFlag
  );
  if (!cleanupRow) {
    await clearUserData(db);
    await db.runAsync('INSERT INTO app_meta (key, value) VALUES (?, ?)', cleanupFlag, 'true');
  }
}

export async function listCategories(db: SQLiteDatabase) {
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY type DESC, name ASC');
}

export async function listTransactions(db: SQLiteDatabase) {
  return db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY date DESC, id DESC');
}

export async function listTransactionsByPeriod(db: SQLiteDatabase, period = currentPeriod()) {
  // A range comparison (rather than substr) lets SQLite use the date index.
  return db.getAllAsync<Transaction>(
    'SELECT * FROM transactions WHERE date >= ? AND date < ? ORDER BY date DESC, id DESC',
    `${period}-01`,
    `${shiftPeriod(period, 1)}-01`
  );
}

export async function listTransactionPeriods(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ period: string }>(
    'SELECT DISTINCT substr(date, 1, 7) as period FROM transactions ORDER BY period ASC'
  );
  return rows.map((row) => row.period);
}

export async function searchTransactions(
  db: SQLiteDatabase,
  { categoryId, limit, query, type }: TransactionSearch
) {
  const pattern = `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`;
  const matches = ["t.note LIKE ? ESCAPE '\\'", "c.name LIKE ? ESCAPE '\\'"];
  const params: Array<string | number> = [pattern, pattern];

  const digits = query.replace(/[,\s]/g, '');
  if (/^\d+$/.test(digits)) {
    matches.push('CAST(CAST(t.amount AS INTEGER) AS TEXT) LIKE ?');
    params.push(`%${digits}%`);
  }

  const conditions = [`(${matches.join(' OR ')})`];
  if (type) {
    conditions.push('t.type = ?');
    params.push(type);
  }
  if (categoryId) {
    conditions.push('t.categoryId = ?');
    params.push(categoryId);
  }

  return db.getAllAsync<Transaction>(
    `SELECT t.* FROM transactions t
     LEFT JOIN categories c ON c.id = t.categoryId
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.date DESC, t.id DESC
     LIMIT ?`,
    ...params,
    limit
  );
}

export async function isLoanTransaction(db: SQLiteDatabase, transactionId: string) {
  const row = await db.getFirstAsync(
    'SELECT id FROM loan_activities WHERE transactionId = ?',
    transactionId
  );
  return row !== null;
}

export async function updateTransaction(db: SQLiteDatabase, transaction: Transaction) {
  const existing = await db.getFirstAsync<Transaction>(
    'SELECT * FROM transactions WHERE id = ?',
    transaction.id
  );
  if (!existing) {
    throw new Error('Transaction not found');
  }
  await ensureNotLoanTransaction(db, transaction.id);

  const movesBudget =
    existing.categoryId !== transaction.categoryId ||
    periodFromISODate(existing.date) !== periodFromISODate(transaction.date);
  if (transaction.type === 'expense' && movesBudget) {
    await ensureExpenseBudget(db, transaction.categoryId, transaction.date);
  }

  await insertTransaction(db, transaction);
}

export async function deleteTransaction(db: SQLiteDatabase, transactionId: string) {
  await ensureNotLoanTransaction(db, transactionId);
  await db.runAsync('DELETE FROM transactions WHERE id = ?', transactionId);
}

async function ensureNotLoanTransaction(db: SQLiteDatabase, transactionId: string) {
  if (await isLoanTransaction(db, transactionId)) {
    throw new Error('This entry belongs to a loan and cannot be changed here.');
  }
}

export async function createTransaction(db: SQLiteDatabase, input: TransactionInput) {
  if (input.type === 'expense') {
    await ensureExpenseBudget(db, input.categoryId, input.date);
  }

  const transaction: Transaction = {
    ...input,
    id: `txn-${Date.now()}`,
  };
  await insertTransaction(db, transaction);
  return transaction;
}

// A monthly limit stays in force until it is changed: a month with no budgets
// of its own starts with a copy of the latest earlier month's budgets.
export async function carryBudgetsForward(db: SQLiteDatabase, period: string) {
  if (period > currentPeriod()) {
    return;
  }
  await db.runAsync(
    `INSERT OR IGNORE INTO budgets (id, categoryId, limitAmount, period)
     SELECT 'budget-' || categoryId || '-' || ?, categoryId, limitAmount, ?
     FROM budgets
     WHERE period = (SELECT MAX(period) FROM budgets WHERE period < ?)
       AND NOT EXISTS (SELECT 1 FROM budgets WHERE period = ?)`,
    period,
    period,
    period,
    period
  );
}

export async function listBudgets(db: SQLiteDatabase, period = currentPeriod()) {
  await carryBudgetsForward(db, period);
  return db.getAllAsync<Budget>('SELECT * FROM budgets WHERE period = ? ORDER BY limitAmount DESC', period);
}

export async function upsertBudget(db: SQLiteDatabase, input: BudgetInput) {
  // Carry first, so saving one limit doesn't stop the others from arriving.
  await carryBudgetsForward(db, input.period);
  const existing = await db.getFirstAsync<Budget>(
    'SELECT * FROM budgets WHERE categoryId = ? AND period = ?',
    input.categoryId,
    input.period
  );
  const budget: Budget = {
    ...input,
    id: existing?.id ?? `budget-${input.categoryId}-${input.period}`,
  };

  await db.runAsync(
    `INSERT INTO budgets (id, categoryId, limitAmount, period)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET limitAmount = excluded.limitAmount`,
    budget.id,
    budget.categoryId,
    budget.limitAmount,
    budget.period
  );
  return budget;
}

export async function listSavingsGoals(db: SQLiteDatabase) {
  return db.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals ORDER BY dueDate ASC, name ASC');
}

export async function createSavingsGoal(db: SQLiteDatabase, input: SavingsGoalInput) {
  const goal: SavingsGoal = {
    ...input,
    id: `goal-${Date.now()}`,
  };

  await db.runAsync(
    'INSERT INTO savings_goals (id, name, targetAmount, savedAmount, dueDate) VALUES (?, ?, ?, ?, ?)',
    goal.id,
    goal.name,
    goal.targetAmount,
    goal.savedAmount,
    goal.dueDate
  );
  return goal;
}

export async function listSubscriptions(db: SQLiteDatabase) {
  return db.getAllAsync<Subscription>(
    'SELECT * FROM subscriptions ORDER BY nextDueDate ASC, amount DESC'
  );
}

export async function createSubscription(db: SQLiteDatabase, input: SubscriptionInput) {
  await ensureExpenseBudget(db, input.categoryId, input.nextDueDate);

  const subscription: Subscription = {
    ...input,
    id: `sub-${Date.now()}`,
  };

  await db.runAsync(
    'INSERT INTO subscriptions (id, name, amount, categoryId, nextDueDate) VALUES (?, ?, ?, ?, ?)',
    subscription.id,
    subscription.name,
    subscription.amount,
    subscription.categoryId,
    subscription.nextDueDate
  );
  return subscription;
}

export async function updateSubscription(db: SQLiteDatabase, subscription: Subscription) {
  await ensureExpenseBudget(db, subscription.categoryId, subscription.nextDueDate);

  await db.runAsync(
    `UPDATE subscriptions
     SET name = ?, amount = ?, categoryId = ?, nextDueDate = ?
     WHERE id = ?`,
    subscription.name,
    subscription.amount,
    subscription.categoryId,
    subscription.nextDueDate,
    subscription.id
  );
  return subscription;
}

export async function listRecurringTransactions(db: SQLiteDatabase) {
  return db.getAllAsync<RecurringTransaction>(
    'SELECT * FROM recurring_transactions ORDER BY nextDate ASC, amount DESC'
  );
}

export async function createRecurringTransaction(
  db: SQLiteDatabase,
  input: RecurringTransactionInput
) {
  if (input.type === 'expense') {
    await ensureExpenseBudget(db, input.categoryId, input.nextDate);
  }

  const recurring: RecurringTransaction = {
    ...input,
    id: `rec-${Date.now()}`,
  };

  await db.runAsync(
    `INSERT INTO recurring_transactions (id, type, amount, categoryId, note, nextDate, frequency)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    recurring.id,
    recurring.type,
    recurring.amount,
    recurring.categoryId,
    recurring.note,
    recurring.nextDate,
    recurring.frequency
  );
  return recurring;
}

/** Records every occurrence that has fallen due, including any that were missed. */
export async function postDueRecurringTransactions(db: SQLiteDatabase, today = new Date()) {
  const dueBy = toISODate(today);
  const dueItems = await db.getAllAsync<RecurringTransaction>(
    'SELECT * FROM recurring_transactions WHERE nextDate <= ? ORDER BY nextDate ASC',
    dueBy
  );
  let posted = 0;
  const skipped: Array<{ note: string; reason: 'budget' | 'date' }> = [];

  for (const item of dueItems) {
    if (!isValidISODate(item.nextDate)) {
      skipped.push({ note: item.note, reason: 'date' });
      continue;
    }

    let date = item.nextDate;
    while (date <= dueBy) {
      if (item.type === 'expense') {
        try {
          await ensureExpenseBudget(db, item.categoryId, date);
        } catch (error) {
          if (error instanceof BudgetRequiredError) {
            // Stop here so this occurrence is still due once a budget exists.
            skipped.push({ note: item.note, reason: 'budget' });
            break;
          }
          throw error;
        }
      }

      // The id includes the due date, so one occurrence can't be recorded twice.
      await insertTransaction(db, {
        id: `txn-${item.id}-${date}`,
        amount: item.amount,
        categoryId: item.categoryId,
        date,
        note: item.note,
        type: item.type,
      });
      date = advanceDate(date, item.frequency);
      await db.runAsync('UPDATE recurring_transactions SET nextDate = ? WHERE id = ?', date, item.id);
      posted += 1;
    }
  }

  return { posted, skipped };
}

/** Records this month's payment as an expense and moves the due date on a month. */
export async function markSubscriptionPaid(db: SQLiteDatabase, subscriptionId: string) {
  await db.withTransactionAsync(async () => {
    const subscription = await db.getFirstAsync<Subscription>(
      'SELECT * FROM subscriptions WHERE id = ?',
      subscriptionId
    );
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    await createTransaction(db, {
      amount: subscription.amount,
      categoryId: subscription.categoryId,
      date: todayISO(),
      note: subscription.name,
      type: 'expense',
    });

    const from = isValidISODate(subscription.nextDueDate) ? subscription.nextDueDate : todayISO();
    await db.runAsync(
      'UPDATE subscriptions SET nextDueDate = ? WHERE id = ?',
      addMonth(from),
      subscription.id
    );
  });
}

export async function listLoans(db: SQLiteDatabase) {
  const loans = await db.getAllAsync<Loan>('SELECT * FROM loans ORDER BY createdAt DESC, dueDate ASC');
  const activities = await db.getAllAsync<LoanActivity>('SELECT * FROM loan_activities ORDER BY date DESC, id DESC');

  const activityMap = new Map<string, LoanActivity[]>();
  for (const activity of activities) {
    const existing = activityMap.get(activity.loanId) ?? [];
    existing.push(activity);
    activityMap.set(activity.loanId, existing);
  }

  return loans.map<LoanProgress>((loan) => {
    const loanActivities = activityMap.get(loan.id) ?? [];
    const repaidAmount =
      loan.type === 'money'
        ? loanActivities
            .filter((activity) => activity.type === 'repayment')
            .reduce((sum, activity) => sum + activity.amount, 0)
        : 0;
    const remainingAmount = loan.type === 'money' ? Math.max(loan.amount - repaidAmount, 0) : 0;
    const progress =
      loan.type === 'money'
        ? loan.amount > 0
          ? Math.min(repaidAmount / loan.amount, 1)
          : 0
        : loan.status === 'returned'
          ? 1
          : 0;

    return {
      ...loan,
      activityCount: loanActivities.length,
      lastActivityDate: loanActivities[0]?.date ?? null,
      remainingAmount,
      progress,
      repaidAmount,
    };
  });
}

export async function listLoanActivities(db: SQLiteDatabase) {
  return db.getAllAsync<LoanActivity>('SELECT * FROM loan_activities ORDER BY date DESC, id DESC');
}

export async function createLoan(db: SQLiteDatabase, input: LoanInput) {
  const loan: Loan = {
    ...input,
    createdAt: todayISO(),
    id: `loan-${Date.now()}`,
    status: 'active',
  };

  await db.runAsync(
    `INSERT INTO loans (id, type, counterparty, title, amount, dueDate, status, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    loan.id,
    loan.type,
    loan.counterparty,
    loan.title,
    loan.amount,
    loan.dueDate,
    loan.status,
    loan.notes,
    loan.createdAt
  );
  return loan;
}

export async function recordLoanRepayment(
  db: SQLiteDatabase,
  input: Omit<LoanActivityInput, 'type'>
) {
  const loan = await db.getFirstAsync<Loan>('SELECT * FROM loans WHERE id = ?', input.loanId);
  if (!loan) {
    throw new Error('Loan not found');
  }
  if (loan.type !== 'money') {
    throw new Error('Only money loans can be repaid with expense transactions');
  }

  const repaidAmount = await sumLoanActivityAmount(db, loan.id, 'repayment');
  const remainingAmount = Math.max(loan.amount - repaidAmount, 0);
  if (input.amount <= 0) {
    throw new Error('Repayment amount must be greater than zero');
  }
  if (input.amount > remainingAmount) {
    throw new Error('Repayment exceeds the remaining loan balance');
  }

  const note = input.note.trim() || `Repayment for ${loan.title}`;
  const transaction = await createTransaction(db, {
    amount: input.amount,
    categoryId: LOAN_REPAYMENT_CATEGORY_ID,
    date: input.date,
    note,
    type: 'expense',
  });

  const activity: LoanActivity = {
    amount: input.amount,
    date: input.date,
    id: `loan-activity-${Date.now()}`,
    loanId: loan.id,
    note,
    transactionId: transaction.id,
    type: 'repayment',
  };

  await db.runAsync(
    `INSERT INTO loan_activities (id, loanId, type, amount, date, note, transactionId)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    activity.id,
    activity.loanId,
    activity.type,
    activity.amount,
    activity.date,
    activity.note,
    activity.transactionId
  );

  const nextRemaining = remainingAmount - input.amount;
  if (nextRemaining <= 0) {
    await db.runAsync('UPDATE loans SET status = ? WHERE id = ?', 'repaid', loan.id);
  }

  return activity;
}

export async function markLoanReturned(db: SQLiteDatabase, loanId: string, date: string, note: string) {
  const loan = await db.getFirstAsync<Loan>('SELECT * FROM loans WHERE id = ?', loanId);
  if (!loan) {
    throw new Error('Loan not found');
  }
  if (loan.type !== 'item') {
    throw new Error('Only item loans can be marked as returned');
  }

  const activity: LoanActivity = {
    amount: 0,
    date,
    id: `loan-activity-${Date.now()}`,
    loanId: loan.id,
    note: note.trim() || `Returned ${loan.title}`,
    transactionId: '',
    type: 'return',
  };

  await db.runAsync(
    `INSERT INTO loan_activities (id, loanId, type, amount, date, note, transactionId)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    activity.id,
    activity.loanId,
    activity.type,
    activity.amount,
    activity.date,
    activity.note,
    activity.transactionId
  );
  await db.runAsync('UPDATE loans SET status = ? WHERE id = ?', 'returned', loan.id);
  return activity;
}

export async function getDashboardSummary(db: SQLiteDatabase): Promise<DashboardSummary> {
  const period = currentPeriod();
  const transactions = await listTransactions(db);
  const subscriptions = await listSubscriptions(db);
  const monthTransactions = transactions.filter((transaction) => periodFromISODate(transaction.date) === period);
  const currentSubscriptions = subscriptions.filter(
    (subscription) => periodFromISODate(subscription.nextDueDate) === period
  );
  const income = sumTransactionCollection(monthTransactions, 'income');
  const expenses =
    sumTransactionCollection(monthTransactions, 'expense') +
    currentSubscriptions.reduce((total, subscription) => total + subscription.amount, 0);
  const budgets = await listBudgetProgress(db);
  const budgetLimit = budgets.reduce((total, budget) => total + budget.limitAmount, 0);
  const budgetSpent = budgets.reduce((total, budget) => total + budget.spent, 0);

  return {
    balance: income - expenses,
    income,
    expenses,
    budgetLimit,
    budgetSpent,
    savingsBalance: sumSavingsBucket(transactions, period),
  };
}

export async function listBudgetProgress(
  db: SQLiteDatabase,
  period = currentPeriod()
): Promise<BudgetProgress[]> {
  const budgets = await listBudgets(db, period);
  const categories = await listCategories(db);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  const progress: BudgetProgress[] = [];
  for (const budget of budgets) {
    const spent = await sumCategorySpend(db, budget.categoryId, period);
    const category = categoryMap.get(budget.categoryId);

    progress.push({
      ...budget,
      category: category ?? {
        id: budget.categoryId,
        name: 'Category',
        type: 'expense' as const,
        color: '#888888',
      },
      spent,
      remaining: budget.limitAmount - spent,
      progress: budget.limitAmount > 0 ? Math.min(spent / budget.limitAmount, 1) : 0,
    });
  }

  return progress.sort((a, b) => b.progress - a.progress);
}

async function insertTransaction(db: SQLiteDatabase, transaction: Transaction) {
  await db.runAsync(
    'INSERT OR REPLACE INTO transactions (id, type, amount, categoryId, note, date) VALUES (?, ?, ?, ?, ?, ?)',
    transaction.id,
    transaction.type,
    transaction.amount,
    transaction.categoryId,
    transaction.note,
    transaction.date
  );
}

async function clearUserData(db: SQLiteDatabase) {
  await db.execAsync(`
    DELETE FROM transactions;
    DELETE FROM budgets;
    DELETE FROM savings_goals;
    DELETE FROM subscriptions;
    DELETE FROM recurring_transactions;
    DELETE FROM loan_activities;
    DELETE FROM loans;
  `);
}

async function ensureExpenseBudget(db: SQLiteDatabase, categoryId: string, date: string) {
  const budget = await getBudgetForCategoryPeriod(db, categoryId, periodFromISODate(date));
  if (!budget) {
    throw new BudgetRequiredError(categoryId, periodFromISODate(date));
  }
  return budget;
}

async function getBudgetForCategoryPeriod(db: SQLiteDatabase, categoryId: string, period: string) {
  await carryBudgetsForward(db, period);
  return db.getFirstAsync<Budget>(
    'SELECT * FROM budgets WHERE categoryId = ? AND period = ?',
    categoryId,
    period
  );
}

async function sumLoanActivityAmount(
  db: SQLiteDatabase,
  loanId: string,
  activityType: LoanActivity['type']
) {
  const row = await db.getFirstAsync<SumRow>(
    'SELECT SUM(amount) as total FROM loan_activities WHERE loanId = ? AND type = ?',
    loanId,
    activityType
  );
  return row?.total ?? 0;
}

function sumTransactionCollection(transactions: Transaction[], type: 'income' | 'expense') {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function sumSavingsBucket(transactions: Transaction[], currentPeriodValue: string) {
  const monthTotals = new Map<string, { expense: number; income: number }>();

  for (const transaction of transactions) {
    const period = periodFromISODate(transaction.date);
    const bucket = monthTotals.get(period) ?? { expense: 0, income: 0 };
    if (transaction.type === 'income') {
      bucket.income += transaction.amount;
    } else {
      bucket.expense += transaction.amount;
    }
    monthTotals.set(period, bucket);
  }

  return Array.from(monthTotals.entries())
    .filter(([period]) => period < currentPeriodValue)
    .reduce((total, [, bucket]) => total + Math.max(bucket.income - bucket.expense, 0), 0);
}

async function sumCategorySpend(db: SQLiteDatabase, categoryId: string, period: string) {
  const row = await db.getFirstAsync<SumRow>(
    `SELECT SUM(amount) as total
     FROM transactions
     WHERE type = 'expense' AND categoryId = ? AND substr(date, 1, 7) = ?`,
    categoryId,
    period
  );
  return row?.total ?? 0;
}

function advanceDate(value: string, frequency: 'weekly' | 'monthly') {
  if (frequency === 'monthly') {
    return addMonth(value);
  }

  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + 7);
  return toISODate(date);
}
