'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Category } from '@/lib/db/db';

export function useCategories() {
    const categories = useLiveQuery<Category[]>(
        () => db.categories.where('type').equals('expense').toArray(),
        []
    );

    return {
        categories: categories || [],
        isLoading: categories === undefined,
    };
}
