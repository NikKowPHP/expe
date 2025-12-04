'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';

export interface BudgetStatus {
  budgetId: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  month: number;
  year: number;
}

export function useBudgets(month?: number, year?: number) {
  // Default to current month/year if not specified
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  // Fetch budgets for the target month/year
  const budgets = useLiveQuery(
    () => db.budgets
      .where(['month', 'year'])
      .equals([targetMonth, targetYear])
      .toArray(),
    [targetMonth, targetYear]
  );

  // Fetch all expenses to calculate spending
  const expenses = useLiveQuery(
    () => db.expenses.filter(e => !e.deleted_at).toArray(),
    []
  );

  // Fetch categories for display info
  const categories = useLiveQuery(
    () => db.categories.toArray(),
    []
  );

  // Calculate budget status
  const budgetStatuses = useLiveQuery(async () => {
    if (!budgets || !expenses || !categories) return [];

    const statuses: BudgetStatus[] = [];

    for (const budget of budgets) {
      // Calculate total spent for this category in this month/year
      const categoryExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return (
          expense.category_id === budget.category_id &&
          expenseDate.getMonth() + 1 === targetMonth &&
          expenseDate.getFullYear() === targetYear
        );
      });

      const spent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
      const remaining = budget.amount - spent;
      const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      // Get category info
      const category = categories.find(c => c.id === budget.category_id);

      statuses.push({
        budgetId: budget.id,
        categoryId: budget.category_id,
        categoryName: category?.name,
        categoryIcon: category?.icon,
        categoryColor: category?.color,
        budgetAmount: budget.amount,
        spent,
        remaining,
        percentUsed,
        month: budget.month,
        year: budget.year,
      });
    }

    return statuses;
  }, [budgets, expenses, categories, targetMonth, targetYear]);

  // Helper function to check if budget exists for category/month/year
  const hasBudget = (categoryId: string, month: number, year: number) => {
    return budgets?.some(
      b => b.category_id === categoryId && b.month === month && b.year === year
    ) ?? false;
  };

  return {
    budgets: budgets || [],
    budgetStatuses: budgetStatuses || [],
    isLoading: budgets === undefined || expenses === undefined || categories === undefined,
    hasBudget,
  };
}
