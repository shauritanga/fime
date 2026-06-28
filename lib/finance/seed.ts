import { palette } from '@/constants/theme';
import type { Budget, Category, Transaction } from './types';

export const defaultCategories: Category[] = [
  { id: 'salary', name: 'Salary', type: 'income', color: palette.emerald },
  { id: 'freelance', name: 'Freelance', type: 'income', color: '#2D6F9F' },
  { id: 'food', name: 'Food', type: 'expense', color: palette.coral },
  { id: 'transport', name: 'Transport', type: 'expense', color: '#8B6F47' },
  { id: 'home', name: 'Home', type: 'expense', color: palette.gold },
  { id: 'utilities', name: 'Utilities', type: 'expense', color: '#606C85' },
  { id: 'health', name: 'Health', type: 'expense', color: '#B45474' },
  { id: 'fun', name: 'Leisure', type: 'expense', color: '#795B9F' },
  { id: 'loan-repayment', name: 'Loan repayment', type: 'expense', color: '#5F6D7A' },
];

export const sampleTransactions: Transaction[] = [
  {
    id: 'seed-1',
    type: 'income',
    amount: 1800000,
    categoryId: 'salary',
    note: 'June salary',
    date: '2026-06-24',
  },
  {
    id: 'seed-2',
    type: 'expense',
    amount: 128000,
    categoryId: 'food',
    note: 'Groceries and lunch',
    date: '2026-06-25',
  },
  {
    id: 'seed-3',
    type: 'expense',
    amount: 45000,
    categoryId: 'transport',
    note: 'Fuel and rides',
    date: '2026-06-22',
  },
  {
    id: 'seed-4',
    type: 'expense',
    amount: 90000,
    categoryId: 'utilities',
    note: 'Power and water',
    date: '2026-06-20',
  },
  {
    id: 'seed-5',
    type: 'income',
    amount: 420000,
    categoryId: 'freelance',
    note: 'Design retainer',
    date: '2026-06-18',
  },
];

export const sampleBudgets: Budget[] = [
  { id: 'budget-food', categoryId: 'food', limitAmount: 420000, period: '2026-06' },
  { id: 'budget-transport', categoryId: 'transport', limitAmount: 220000, period: '2026-06' },
  { id: 'budget-home', categoryId: 'home', limitAmount: 650000, period: '2026-06' },
  { id: 'budget-utilities', categoryId: 'utilities', limitAmount: 180000, period: '2026-06' },
];
