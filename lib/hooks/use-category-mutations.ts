'use client';

import { db, Category } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';

export function useCategoryMutations() {
  const supabase = createClient();

  const createCategory = async (input: {
    name: string;
    icon: string;
    color: string;
    type?: 'income' | 'expense';
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const newCategory: Category = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name: input.name,
      icon: input.icon,
      color: input.color,
      type: input.type || 'expense',
      is_default: false,
      sync_status: 'pending',
    };

    // Save to local database first (offline-first)
    await db.categories.add(newCategory);

    // Try to sync immediately if online
    if (navigator.onLine) {
      try {
        const response = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        
        if (response.ok) {
          const serverCategory = await response.json();
          // Update with server ID and mark as synced
          await db.categories.update(newCategory.id, {
            id: serverCategory.id,
            sync_status: 'synced',
          });
        }
      } catch (error) {
        console.error('Failed to sync category:', error);
        // Category will remain with sync_status: 'pending'
      }
    }

    return newCategory;
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    // Update locally first
    await db.categories.update(id, {
      ...updates,
      sync_status: 'pending',
    });

    // Try to sync if online
    if (navigator.onLine) {
      try {
        const response = await fetch(`/api/categories/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        
        if (response.ok) {
          await db.categories.update(id, { sync_status: 'synced' });
        }
      } catch (error) {
        console.error('Failed to sync category update:', error);
      }
    }
  };

  const deleteCategory = async (id: string) => {
    // Check if it's a default category
    const category = await db.categories.get(id);
    if (category?.is_default) {
      throw new Error('Cannot delete default categories');
    }

    // If online, try to delete from server first to check for constraints
    if (navigator.onLine) {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        // Check for foreign key constraint violation
        if (data.error && data.error.includes('foreign key constraint')) {
           throw new Error('Cannot delete this category because it contains expenses. Please reassign or delete the expenses first.');
        }
        throw new Error(data.error || 'Failed to delete category');
      }
    }

    // If server delete succeeded or we are offline, delete locally
    await db.categories.delete(id);
  };

  return {
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
