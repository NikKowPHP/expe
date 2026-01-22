'use client';

import { db, Subcategory } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';

export function useSubcategoryMutations() {
  const supabase = createClient();

  const createSubcategory = async (input: {
    name: string;
    category_id: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const newSubcategory: Subcategory = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name: input.name,
      category_id: input.category_id,
      created_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    // Local
    await db.subcategories.add(newSubcategory);

    // Sync
    if (navigator.onLine) {
      try {
        const { error } = await supabase.from('subcategories').insert({
            id: newSubcategory.id,
            user_id: user.id,
            name: newSubcategory.name,
            category_id: newSubcategory.category_id,
            created_at: newSubcategory.created_at
        });
        
        if (!error) {
          await db.subcategories.update(newSubcategory.id, { sync_status: 'synced' });
        }
      } catch (error) {
        console.error('Failed to sync subcategory:', error);
      }
    }

    return newSubcategory;
  };

  const updateSubcategory = async (id: string, updates: Partial<Subcategory>) => {
    await db.subcategories.update(id, {
      ...updates,
      sync_status: 'pending',
    });

    if (navigator.onLine) {
      try {
        const { error } = await supabase.from('subcategories').update(updates).eq('id', id);
        if (!error) {
          await db.subcategories.update(id, { sync_status: 'synced' });
        }
      } catch (error) {
        console.error('Failed to sync subcategory update:', error);
      }
    }
  };

  const deleteSubcategory = async (id: string) => {
    if (navigator.onLine) {
      try {
        await supabase.from('subcategories').delete().eq('id', id);
      } catch (error) {
        console.error('Failed to delete subcategory from server:', error);
      }
    }
    await db.subcategories.delete(id);
  };

  return {
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
  };
}
