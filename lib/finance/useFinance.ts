import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createLoan,
  createTransaction,
  createRecurringTransaction,
  createSavingsGoal,
  createSubscription,
  getDashboardSummary,
  listBudgetProgress,
  listCategories,
  listLoanActivities,
  listLoans,
  listRecurringTransactions,
  listSavingsGoals,
  listSubscriptions,
  listTransactions,
  markLoanReturned,
  postDueRecurringTransactions,
  recordLoanRepayment,
  updateSubscription,
  upsertBudget,
} from './database';
import type {
  BudgetInput,
  BudgetProgress,
  Category,
  DashboardSummary,
  LoanActivity,
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
} from './types';

const emptySummary: DashboardSummary = {
  balance: 0,
  income: 0,
  expenses: 0,
  budgetLimit: 0,
  budgetSpent: 0,
  savingsBalance: 0,
};

export function useFinance() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loans, setLoans] = useState<LoanProgress[]>([]);
  const [loanActivities, setLoanActivities] = useState<LoanActivity[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [
      nextCategories,
      nextTransactions,
      nextBudgets,
      nextSummary,
      nextGoals,
      nextSubscriptions,
      nextRecurringTransactions,
      nextLoans,
      nextLoanActivities,
    ] = await Promise.all([
      listCategories(db),
      listTransactions(db),
      listBudgetProgress(db),
      getDashboardSummary(db),
      listSavingsGoals(db),
      listSubscriptions(db),
      listRecurringTransactions(db),
      listLoans(db),
      listLoanActivities(db),
    ]);

    setCategories(nextCategories);
    setTransactions(nextTransactions);
    setBudgets(nextBudgets);
    setSummary(nextSummary);
    setGoals(nextGoals);
    setSubscriptions(nextSubscriptions);
    setRecurringTransactions(nextRecurringTransactions);
    setLoans(nextLoans);
    setLoanActivities(nextLoanActivities);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  );

  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === 'income'),
    [categories]
  );

  const addTransaction = useCallback(
    async (input: TransactionInput) => {
      await createTransaction(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const saveBudget = useCallback(
    async (input: BudgetInput) => {
      await upsertBudget(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const addSavingsGoal = useCallback(
    async (input: SavingsGoalInput) => {
      await createSavingsGoal(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const addSubscription = useCallback(
    async (input: SubscriptionInput) => {
      await createSubscription(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const saveSubscription = useCallback(
    async (input: Subscription) => {
      await updateSubscription(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const addRecurringTransaction = useCallback(
    async (input: RecurringTransactionInput) => {
      await createRecurringTransaction(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const addLoan = useCallback(
    async (input: LoanInput) => {
      await createLoan(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const repayLoan = useCallback(
    async (loanId: string, amount: number, date: string, note: string) => {
      await recordLoanRepayment(db, {
        amount,
        date,
        loanId,
        note,
      });
      await refresh();
    },
    [db, refresh]
  );

  const returnLoan = useCallback(
    async (loanId: string, date: string, note: string) => {
      await markLoanReturned(db, loanId, date, note);
      await refresh();
    },
    [db, refresh]
  );

  const postDueRecurring = useCallback(async () => {
    const posted = await postDueRecurringTransactions(db);
    await refresh();
    return posted;
  }, [db, refresh]);

  return {
    addTransaction,
    addRecurringTransaction,
    addLoan,
    addSavingsGoal,
    addSubscription,
    loanActivities,
    loans,
    budgets,
    categories,
    expenseCategories,
    goals,
    incomeCategories,
    loading,
    postDueRecurring,
    recurringTransactions,
    refresh,
    repayLoan,
    returnLoan,
    saveBudget,
    saveSubscription,
    summary,
    subscriptions,
    transactions,
  };
}
