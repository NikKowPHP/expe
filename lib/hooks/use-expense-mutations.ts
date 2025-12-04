'use client';

import { db } from '@/lib/db/db';

export function useExpenseMutations() {
  const deleteExpense = async (id: string) => {
    // Delete from local database first
    await db.expenses.delete(id);

    // Try to delete from server if online
    if (navigator.onLine) {
      try {
        const response = await fetch(`/api/expenses/${id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.error('Failed to delete expense from server:', response.statusText);
        }
      } catch (error) {
        console.error('Failed to delete expense from server:', error);
        // Even if the server delete fails, keep local deletion
        // The item won't be re-synced since it doesn't exist locally
      }
    }
  };

  return {
    deleteExpense,
  };
}
