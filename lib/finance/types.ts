export type TransactionType = 'income' | 'expense';

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note: string;
  date: string;
};

export type TransactionInput = Omit<Transaction, 'id'>;

export type Budget = {
  id: string;
  categoryId: string;
  limitAmount: number;
  period: string;
};

export type BudgetInput = Omit<Budget, 'id'>;

export type LoanType = 'money' | 'item';

export type LoanStatus = 'active' | 'repaid' | 'returned';

export type Loan = {
  id: string;
  type: LoanType;
  counterparty: string;
  title: string;
  amount: number;
  dueDate: string;
  status: LoanStatus;
  notes: string;
  createdAt: string;
};

export type LoanInput = Omit<Loan, 'id' | 'status' | 'createdAt'>;

export type LoanActivityType = 'repayment' | 'return';

export type LoanActivity = {
  id: string;
  loanId: string;
  type: LoanActivityType;
  amount: number;
  date: string;
  note: string;
  transactionId: string;
};

export type LoanActivityInput = Omit<LoanActivity, 'id' | 'transactionId'>;

export type LoanProgress = Loan & {
  activityCount: number;
  lastActivityDate: string | null;
  remainingAmount: number;
  repaidAmount: number;
  progress: number;
};

export type DashboardSummary = {
  balance: number;
  income: number;
  expenses: number;
  budgetLimit: number;
  budgetSpent: number;
  savingsBalance: number;
};

export type BudgetProgress = Budget & {
  category: Category;
  spent: number;
  remaining: number;
  progress: number;
};

export type ExpenseChartRange = 'weekly' | 'monthly' | 'yearly';

export type ExpenseChartBar = {
  label: string;
  total: number;
};

export type TrendChartPoint = {
  label: string;
  income: number;
  expense: number;
};

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  dueDate: string;
};

export type SavingsGoalInput = Omit<SavingsGoal, 'id'>;

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  nextDueDate: string;
};

export type SubscriptionInput = Omit<Subscription, 'id'>;

export type RecurringFrequency = 'weekly' | 'monthly';

export type RecurringTransaction = {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note: string;
  nextDate: string;
  frequency: RecurringFrequency;
};

export type RecurringTransactionInput = Omit<RecurringTransaction, 'id'>;
