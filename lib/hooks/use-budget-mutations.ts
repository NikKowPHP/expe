'use client';

import { db, Budget } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';

export function useBudgetMutations() {
  const supabase = createClient();

  const createBudget = async (input: {
    category_id: string;
    amount: number;
    month: number;
    year: number;
    copyToFutureMonths?: number; // Number of months to copy forward
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const budgetsToCreate: Budget[] = [];
    const monthsToCopy = input.copyToFutureMonths || 0;

    // Create budget for current month + future months if specified
    for (let i = 0; i <= monthsToCopy; i++) {
      const targetDate = new Date(input.year, input.month - 1 + i, 1);
      const targetMonth = targetDate.getMonth() + 1;
      const targetYear = targetDate.getFullYear();

      const newBudget: Budget = {
        id: crypto.randomUUID(),
        user_id: user.id,
        category_id: input.category_id,
        amount: input.amount,
        month: targetMonth,
        year: targetYear,
        created_at: new Date().toISOString(),
        sync_status: 'pending',
      };

      budgetsToCreate.push(newBudget);
    }

    // Save to local database first (offline-first)
    await db.budgets.bulkAdd(budgetsToCreate);

    // Try to sync immediately if online
    if (navigator.onLine) {
      for (const budget of budgetsToCreate) {
        try {
          const response = await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category_id: budget.category_id,
              amount: budget.amount,
              month: budget.month,
              year: budget.year,
            }),
          });
          
          if (response.ok) {
            const serverBudget = await response.json();
            // Update with server ID and mark as synced
            await db.budgets.update(budget.id, {
              id: serverBudget.id,
              sync_status: 'synced',
            });
          }
        } catch (error) {
          console.error('Failed to sync budget:', error);
          // Budget will remain with sync_status: 'pending'
        }
      }
    }

    return budgetsToCreate[0]; // Return the first budget (current month)
  };

  const updateBudget = async (id: string, updates: Partial<Budget>) => {
    // Update locally first
    await db.budgets.update(id, {
      ...updates,
      sync_status: 'pending',
    });

    // Try to sync if online
    if (navigator.onLine) {
      try {
        const response = await fetch(`/api/budgets/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        
        if (response.ok) {
          await db.budgets.update(id, { sync_status: 'synced' });
        }
      } catch (error) {
        console.error('Failed to sync budget update:', error);
      }
    }
  };

  const deleteBudget = async (id: string) => {
    // Delete from local database
    await db.budgets.delete(id);

    // Try to delete from server if online
    if (navigator.onLine) {
      try {
        await fetch(`/api/budgets/${id}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Failed to delete budget from server:', error);
      }
    }
  };

  return {
    createBudget,
    updateBudget,
    deleteBudget,
  };
}
