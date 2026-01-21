'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Category } from '@/lib/db/db';

export function useCategories(type?: 'income' | 'expense') {
    const categories = useLiveQuery<Category[]>(
        () => {
            if (type) {
                return db.categories.where('type').equals(type).toArray();
            }
            return db.categories.toArray();
        },
        [type]
    );

    return {
        categories: categories || [],
        isLoading: categories === undefined,
    };
}
