// The tools that change things. Rules enforced here, whatever the model asks:
//  - every value is checked before anything is saved;
//  - each change reports what it did in the app's own words, and can be undone where possible;
//  - deleting an entry or changing the sign-in phone number waits for a tap to confirm;
//  - logging out, deleting the account and passwords are never done from chat.
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  BudgetRequiredError,
  CategoryError,
  createCategory,
  createLoan,
  createRecurringTransaction,
  createSavingsGoal,
  createSubscription,
  createTransaction,
  deleteBudget,
  deleteCategory,
  deleteLoanActivity,
  deleteRecurringTransaction,
  deleteSavingsGoal,
  deleteSubscription,
  deleteTransaction,
  deleteUnusedLoan,
  isLoanTransaction,
  listBudgetProgress,
  listBudgets,
  listCategories,
  listLoans,
  listRecurringTransactions,
  listSubscriptions,
  listTransactions,
  markLoanReturned,
  markSubscriptionPaid,
  postDueRecurringTransactions,
  recordLoanRepayment,
  restoreTransaction,
  setRecurringNextDate,
  setSubscriptionDueDate,
  updateCategory,
  updateSubscription,
  updateTransaction,
  upsertBudget,
} from '../finance/database';
import { currentPeriod, formatFullDate, formatMoney, isValidISODate, todayISO } from '../finance/format';
import type { TransactionType } from '../finance/types';
import { findCategory } from './tools';

/** Things only the running app can do. */
export type AppBridge = {
  exportTransactions: () => Promise<number>;
  setReminders: (enabled: boolean) => Promise<void>;
  getProfile: () => { name: string; phoneNumber: string };
  updateProfile: (input: { name: string; phoneNumber: string }) => Promise<void>;
};

export type Change = { summary: string; undo?: () => Promise<void> };
export type PendingAction = { id: string; summary: string; run: () => Promise<Change> };
export type Screen = { label: string; href: ScreenHref };
export type ActionOutcome = { data: unknown; changes?: Change[]; pending?: PendingAction; screen?: Screen };

export const screens = {
  home: { label: 'Home', href: '/' },
  transactions: { label: 'Transactions', href: '/transactions' },
  analytics: { label: 'Analytics', href: '/analytics' },
  budgets: { label: 'Budgets', href: '/insights/budgets' },
  goals: { label: 'Savings goals', href: '/insights/goals' },
  loans: { label: 'Loans', href: '/insights/loans' },
  subscriptions: { label: 'Subscriptions', href: '/insights/subscriptions' },
  recurring: { label: 'Recurring', href: '/insights/recurring' },
  export: { label: 'Export', href: '/insights/export' },
  profile: { label: 'Profile', href: '/profile' },
} as const;
type ScreenHref = (typeof screens)[keyof typeof screens]['href'];

type Args = Record<string, unknown>;
type Context = { db: SQLiteDatabase; app: AppBridge; undo: Change[] };
type Action = (context: Context, args: Args) => Promise<ActionOutcome>;

const MAX_AMOUNT = 1_000_000_000_000;

/** A problem to explain to the user; nothing was saved. */
class Refused extends Error {}

function text(value: unknown, limit = 80) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function required(value: unknown, what: string) {
  const result = text(value);
  if (!result) {
    throw new Refused(`Ask the user for ${what}.`);
  }
  return result;
}

function amountOf(value: unknown, what = 'amount', allowZero = false) {
  const raw = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
  const amount = raw === '' || raw === null || raw === undefined ? NaN : Math.round(Number(raw));
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0) || amount > MAX_AMOUNT) {
    throw new Refused(`The ${what} must be a number of shillings${allowZero ? '' : ' above zero'}. Ask the user.`);
  }
  return amount;
}

function dateOf(value: unknown, fallback: string | null, what = 'date', notFuture = false) {
  const date = text(value) || fallback;
  if (!date || !isValidISODate(date)) {
    throw new Refused(`Ask the user for a real ${what}, written as YYYY-MM-DD.`);
  }
  if (notFuture && date > todayISO()) {
    throw new Refused(`The ${what} can't be in the future.`);
  }
  return date;
}

function typeOf(value: unknown): TransactionType {
  if (value !== 'income' && value !== 'expense') {
    throw new Refused('Say whether this is income or an expense.');
  }
  return value;
}

async function categoryOf(db: SQLiteDatabase, value: unknown, type: TransactionType) {
  const all = await listCategories(db);
  const usable = new Map(all.filter((item) => item.type === type).map((item) => [item.id, item]));
  const category = findCategory(usable, text(value));
  if (!category) {
    const names = [...usable.values()].map((item) => item.name).join(', ');
    throw new Refused(`Choose one of these ${type} categories: ${names}.`);
  }
  return category;
}

function saved(change: Change, extra: Record<string, unknown> = {}): ActionOutcome {
  return { data: { saved: true, summary: change.summary, ...extra }, changes: [change] };
}

function waiting(summary: string, run: () => Promise<Change>): ActionOutcome {
  return {
    data: {
      saved: false,
      waiting_for_confirmation: true,
      summary,
      note: 'Tell the user to tap Confirm below your reply. Do not say it is done.',
    },
    pending: { id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, summary, run },
  };
}

const setBudget: Action = async ({ db }, args) => {
  const category = await categoryOf(db, args.category, 'expense');
  const amount = amountOf(args.amount);
  const month = currentPeriod();
  const previous = (await listBudgets(db, month)).find((item) => item.categoryId === category.id);
  await upsertBudget(db, { categoryId: category.id, limitAmount: amount, period: month });
  const spent = (await listBudgetProgress(db, month)).find((item) => item.categoryId === category.id)?.spent ?? 0;

  return saved(
    {
      summary: `${category.name} budget set to ${formatMoney(amount)} for this month`,
      undo: async () => {
        if (previous) {
          await upsertBudget(db, previous);
        } else {
          await deleteBudget(db, category.id, month);
        }
      },
    },
    { previous_limit: previous?.limitAmount ?? null, spent_this_month: spent, left: amount - spent }
  );
};

async function anyCategory(db: SQLiteDatabase, value: unknown) {
  const all = new Map((await listCategories(db)).map((item) => [item.id, item]));
  const category = findCategory(all, text(value));
  if (!category) {
    throw new Refused(`No category has that name. The categories are: ${[...all.values()].map((item) => item.name).join(', ')}.`);
  }
  return category;
}

const addCategory: Action = async ({ db }, args) => {
  const type = typeOf(args.type);
  const category = await createCategory(db, {
    type,
    name: required(args.name, 'the name of the category'),
    emoji: required(args.emoji, 'an emoji for the category'),
  });

  return saved({
    summary: `Added ${type} category: ${category.emoji} ${category.name}`,
    undo: () => deleteCategory(db, category.id),
  });
};

const editCategory: Action = async ({ db }, args) => {
  const before = await anyCategory(db, args.category);
  const after = { name: text(args.new_name) || before.name, emoji: text(args.emoji, 20) || before.emoji };
  await updateCategory(db, before.id, after);

  return saved({
    summary: `Updated category: ${after.emoji} ${after.name}`,
    undo: () => updateCategory(db, before.id, before),
  });
};

const removeCategory: Action = async ({ db }, args) => {
  const category = await anyCategory(db, args.category);
  const label = `${category.emoji} ${category.name}`;

  return waiting(`Delete the category ${label} and any budget for it?`, async () => {
    await deleteCategory(db, category.id);
    return { summary: `Deleted category ${label}` };
  });
};

const addTransaction: Action = async ({ db }, args) => {
  const type = typeOf(args.type);
  const amount = amountOf(args.amount);
  const category = await categoryOf(db, args.category, type);
  const date = dateOf(args.date, todayISO(), 'date', true);
  const note = text(args.title) || category.name;
  const created = await createTransaction(db, { type, amount, categoryId: category.id, date, note });

  return saved({
    summary: `Added ${type}: ${note}, ${formatMoney(amount)} (${category.name}, ${formatFullDate(date)})`,
    undo: () => deleteTransaction(db, created.id),
  });
};

async function ownTransaction(db: SQLiteDatabase, id: unknown) {
  const transaction = (await listTransactions(db)).find((item) => item.id === text(id, 200));
  if (!transaction) {
    throw new Refused('Find the transaction first with find_transactions, then use its id.');
  }
  if (await isLoanTransaction(db, transaction.id)) {
    throw new Refused("This entry belongs to a loan repayment and can't be changed.");
  }
  return transaction;
}

const editTransaction: Action = async ({ db }, args) => {
  const before = await ownTransaction(db, args.id);
  const after = {
    ...before,
    amount: args.amount === undefined ? before.amount : amountOf(args.amount),
    categoryId:
      args.category === undefined ? before.categoryId : (await categoryOf(db, args.category, before.type)).id,
    date: args.date === undefined ? before.date : dateOf(args.date, null, 'date', true),
    note: text(args.title) || before.note,
  };
  await updateTransaction(db, after);

  return saved({
    summary: `Updated ${after.note}: ${formatMoney(after.amount)} on ${formatFullDate(after.date)}`,
    undo: () => restoreTransaction(db, before),
  });
};

const removeTransaction: Action = async ({ db }, args) => {
  const target = await ownTransaction(db, args.id);
  const label = `${target.note}, ${formatMoney(target.amount)} on ${formatFullDate(target.date)}`;

  return waiting(`Delete ${label}?`, async () => {
    await deleteTransaction(db, target.id);
    return { summary: `Deleted ${label}`, undo: () => restoreTransaction(db, target) };
  });
};

const addGoal: Action = async ({ db }, args) => {
  const name = required(args.name, 'the name of the goal');
  const targetAmount = amountOf(args.target, 'target amount');
  const savedAmount = args.saved === undefined ? 0 : amountOf(args.saved, 'amount saved', true);
  const dueDate = dateOf(args.target_date, null, 'target date');
  const goal = await createSavingsGoal(db, { name, targetAmount, savedAmount, dueDate });

  return saved({
    summary: `Added savings goal: ${name}, ${formatMoney(targetAmount)} by ${formatFullDate(dueDate)}`,
    undo: () => deleteSavingsGoal(db, goal.id),
  });
};

const addSubscription: Action = async ({ db }, args) => {
  const name = required(args.name, 'the name of the subscription');
  const amount = amountOf(args.amount);
  const category = await categoryOf(db, args.category, 'expense');
  const nextDueDate = dateOf(args.next_due_date, todayISO(), 'due date');
  const created = await createSubscription(db, { name, amount, categoryId: category.id, nextDueDate });

  return saved({
    summary: `Added subscription: ${name}, ${formatMoney(amount)} a month, due ${formatFullDate(nextDueDate)}`,
    undo: () => deleteSubscription(db, created.id),
  });
};

async function ownSubscription(db: SQLiteDatabase, id: unknown) {
  const subscription = (await listSubscriptions(db)).find((item) => item.id === text(id, 200));
  if (!subscription) {
    throw new Refused('Look up the subscription with upcoming_payments, then use its id.');
  }
  return subscription;
}

const editSubscription: Action = async ({ db }, args) => {
  const before = await ownSubscription(db, args.id);
  const after = {
    ...before,
    name: text(args.name) || before.name,
    amount: args.amount === undefined ? before.amount : amountOf(args.amount),
    categoryId:
      args.category === undefined ? before.categoryId : (await categoryOf(db, args.category, 'expense')).id,
    nextDueDate:
      args.next_due_date === undefined ? before.nextDueDate : dateOf(args.next_due_date, null, 'due date'),
  };
  await updateSubscription(db, after);

  return saved({
    summary: `Updated subscription ${after.name}: ${formatMoney(after.amount)}, due ${formatFullDate(after.nextDueDate)}`,
    undo: async () => {
      await updateSubscription(db, before);
    },
  });
};

const paySubscription: Action = async ({ db }, args) => {
  const subscription = await ownSubscription(db, args.id);
  const paid = await markSubscriptionPaid(db, subscription.id);

  return saved({
    summary: `Marked ${subscription.name} paid: ${formatMoney(subscription.amount)} recorded today`,
    undo: async () => {
      await deleteTransaction(db, paid.transactionId);
      await setSubscriptionDueDate(db, subscription.id, paid.previousDueDate);
    },
  });
};

const addRecurring: Action = async ({ db }, args) => {
  const type = typeOf(args.type);
  const amount = amountOf(args.amount);
  const category = await categoryOf(db, args.category, type);
  const note = required(args.title, 'a title');
  if (args.frequency !== 'weekly' && args.frequency !== 'monthly') {
    throw new Refused('Ask whether it repeats weekly or monthly.');
  }
  const nextDate = dateOf(args.next_date, todayISO(), 'next date');
  const created = await createRecurringTransaction(db, {
    type,
    amount,
    categoryId: category.id,
    note,
    nextDate,
    frequency: args.frequency,
  });

  return saved({
    summary: `Added ${args.frequency} ${type}: ${note}, ${formatMoney(amount)}, from ${formatFullDate(nextDate)}`,
    undo: () => deleteRecurringTransaction(db, created.id),
  });
};

const postDue: Action = async ({ db }) => {
  const idsBefore = new Set((await listTransactions(db)).map((item) => item.id));
  const schedules = await listRecurringTransactions(db);
  const { posted, skipped } = await postDueRecurringTransactions(db);
  const added = (await listTransactions(db)).filter((item) => !idsBefore.has(item.id));
  const data = { posted, skipped };
  if (!posted) {
    return { data: { saved: false, ...data } };
  }

  return saved(
    {
      summary: `Added ${posted} due recurring ${posted === 1 ? 'entry' : 'entries'}`,
      undo: async () => {
        for (const item of added) {
          await deleteTransaction(db, item.id);
        }
        for (const schedule of schedules) {
          await setRecurringNextDate(db, schedule.id, schedule.nextDate);
        }
      },
    },
    data
  );
};

const addLoan: Action = async ({ db }, args) => {
  const type = args.kind === 'item' ? 'item' : 'money';
  const counterparty = required(args.borrowed_from, 'who it was borrowed from');
  const title = required(args.title, type === 'item' ? 'the item' : 'what the loan is for');
  const amount = amountOf(args.amount, type === 'item' ? 'estimated value' : 'amount borrowed');
  const dueDate = dateOf(args.due_date, null, 'due date');
  const loan = await createLoan(db, { type, counterparty, title, amount, dueDate, notes: text(args.notes, 200) });

  // The lender's name is saved but deliberately left out of what goes back to the model.
  return saved({
    summary: `Added ${type} loan: ${title}, ${formatMoney(amount)}, due ${formatFullDate(dueDate)}`,
    undo: () => deleteUnusedLoan(db, loan.id),
  });
};

async function ownLoan(db: SQLiteDatabase, id: unknown) {
  const loan = (await listLoans(db)).find((item) => item.id === text(id, 200));
  if (!loan || loan.status !== 'active') {
    throw new Refused('Look up unpaid loans with upcoming_payments, then use the id.');
  }
  return loan;
}

const repayLoan: Action = async ({ db }, args) => {
  const loan = await ownLoan(db, args.id);
  const amount = amountOf(args.amount);
  if (loan.type !== 'money' || amount > loan.remainingAmount) {
    throw new Refused(`Only up to ${formatMoney(loan.remainingAmount)} can be repaid on this loan.`);
  }
  const date = dateOf(args.date, todayISO(), 'date', true);
  const activity = await recordLoanRepayment(db, { loanId: loan.id, amount, date, note: '' });

  return saved(
    {
      summary: `Recorded ${formatMoney(amount)} repayment on ${loan.title}`,
      undo: () => deleteLoanActivity(db, activity),
    },
    { still_owed: loan.remainingAmount - amount }
  );
};

const returnLoan: Action = async ({ db }, args) => {
  const loan = await ownLoan(db, args.id);
  if (loan.type !== 'item') {
    throw new Refused('That is a money loan. Record a repayment instead.');
  }
  const activity = await markLoanReturned(db, loan.id, todayISO(), '');

  return saved({ summary: `Marked ${loan.title} returned`, undo: () => deleteLoanActivity(db, activity) });
};

const setReminders: Action = async ({ app }, args) => {
  if (typeof args.enabled !== 'boolean') {
    throw new Refused('Say whether reminders should be on or off.');
  }
  const enabled = args.enabled;
  await app.setReminders(enabled);
  return saved({
    summary: `Daily reminders turned ${enabled ? 'on' : 'off'}`,
    undo: () => app.setReminders(!enabled),
  });
};

const exportTransactions: Action = async ({ app }) => {
  const count = await app.exportTransactions();
  return {
    data: { opened_share_sheet: true, transactions: count, note: 'The user chooses where to send the file.' },
  };
};

const editProfile: Action = async ({ app }, args) => {
  const before = app.getProfile();
  const after = {
    name: text(args.name) || before.name,
    phoneNumber: text(args.phone_number, 30) || before.phoneNumber,
  };
  if (after.name === before.name && after.phoneNumber === before.phoneNumber) {
    throw new Refused('Ask what the new name or phone number should be.');
  }
  const apply = async (): Promise<Change> => {
    await app.updateProfile(after);
    return { summary: 'Profile updated', undo: () => app.updateProfile(before) };
  };

  // The phone number is used to sign in, so a misheard digit could lock the user out.
  if (after.phoneNumber !== before.phoneNumber) {
    return waiting(`Change your sign-in phone number to ${after.phoneNumber}?`, apply);
  }
  return saved(await apply());
};

const undoLast: Action = async ({ undo }) => {
  const change = undo[undo.length - 1];
  if (!change?.undo) {
    return { data: { undone: false, reason: 'There is no change from this chat that can be undone.' } };
  }
  await change.undo();
  undo.pop();
  const summary = `Undone: ${change.summary}`;
  return { data: { undone: true, summary }, changes: [{ summary }] };
};

const openScreen: Action = async (_context, args) => {
  const screen = screens[text(args.screen) as keyof typeof screens];
  if (!screen) {
    throw new Refused(`Choose one of: ${Object.keys(screens).join(', ')}.`);
  }
  return { data: { button_shown: `Open ${screen.label}` }, screen };
};

const actions: Record<string, Action> = {
  add_category: addCategory,
  update_category: editCategory,
  delete_category: removeCategory,
  set_budget: setBudget,
  add_transaction: addTransaction,
  update_transaction: editTransaction,
  delete_transaction: removeTransaction,
  add_savings_goal: addGoal,
  add_subscription: addSubscription,
  update_subscription: editSubscription,
  pay_subscription: paySubscription,
  add_recurring: addRecurring,
  post_due_recurring: postDue,
  add_loan: addLoan,
  repay_loan: repayLoan,
  return_loan: returnLoan,
  set_reminders: setReminders,
  export_transactions: exportTransactions,
  update_profile: editProfile,
  undo_last: undoLast,
  open_screen: openScreen,
};

export function isAction(name: string) {
  return Object.prototype.hasOwnProperty.call(actions, name);
}

export async function runAction(context: Context, name: string, args: Args): Promise<ActionOutcome> {
  try {
    return await actions[name](context, args);
  } catch (error) {
    if (error instanceof Refused || error instanceof CategoryError) {
      return { data: { saved: false, error: error.message } };
    }
    if (error instanceof BudgetRequiredError) {
      const categories = await listCategories(context.db);
      const category = categories.find((item) => item.id === error.categoryId)?.name ?? 'that category';
      return {
        data: {
          saved: false,
          error: `${category} has no budget for ${error.period}, and an expense needs one. Ask the user what monthly limit to set.`,
        },
      };
    }
    if (error instanceof Error && /loan|Repayment|already has activity/i.test(error.message)) {
      return { data: { saved: false, error: error.message } };
    }
    throw error;
  }
}
