'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Subcategory } from '@/lib/db/db';

export function useSubcategories(categoryId?: string) {
    const subcategories = useLiveQuery<Subcategory[]>(
        () => {
            if (categoryId) {
                return db.subcategories.where('category_id').equals(categoryId).toArray();
            }
            return db.subcategories.toArray();
        },
        [categoryId]
    );

    return {
        subcategories: subcategories || [],
        isLoading: subcategories === undefined,
    };
}
