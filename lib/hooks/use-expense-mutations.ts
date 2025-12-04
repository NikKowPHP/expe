'use client';

import { db } from '@/lib/db/db';

export function useExpenseMutations() {
  const deleteExpense = async (id: string) => {
    // Soft delete: update deleted_at and sync_status
    try {
      await db.expenses.update(id, {
        deleted_at: new Date().toISOString(),
        sync_status: 'pending',
        updated_at: new Date().toISOString(),
      });
      
      // We don't need to call the API directly here. 
      // useOfflineSync will pick up the pending change and sync it.
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  return {
    deleteExpense,
  };
}
