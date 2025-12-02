import { useEffect, useState } from 'react';
import { db } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';
// We'll assume we have a user from a context or just check auth.

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const syncExpenses = async () => {
        if (!isOnline) return;
        setIsSyncing(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn('Cannot sync expenses: User not authenticated.');
            setIsSyncing(false);
            return;
        }
        const userId = user.id;

        try {
            // 1. Push pending expenses
            const pendingExpenses = await db.expenses.where('sync_status').equals('pending').toArray();

            for (const expense of pendingExpenses) {
                const { error } = await supabase.from('expenses').upsert({
                    id: expense.id,
                    user_id: expense.user_id,
                    category_id: expense.category_id,
                    amount: expense.amount,
                    note: expense.note,
                    date: expense.date,
                    updated_at: new Date().toISOString(), // Update timestamp
                });

                if (!error) {
                    await db.expenses.update(expense.id, { sync_status: 'synced' });
                }
            }

            // 2. Pull new expenses (Simple strategy: fetch all after last sync? Or just all for now?)
            // For simplicity, let's just fetch the last 50 expenses for now.
            const { data: remoteExpenses, error: fetchError } = await supabase
                .from('expenses')
                .select('*')
                .order('date', { ascending: false })
                .limit(50);

            if (remoteExpenses && !fetchError) {
                for (const remoteExpense of remoteExpenses) {
                    // Check if it exists locally
                    const localExpense = await db.expenses.get(remoteExpense.id);
                    if (!localExpense || localExpense.sync_status === 'synced') {
                        // Only overwrite if local is synced (don't overwrite pending local changes)
                        await db.expenses.put({
                            ...remoteExpense,
                            sync_status: 'synced',
                        });
                    }
                }
            }

        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-sync when coming online
    useEffect(() => {
        if (isOnline) {
            syncExpenses();
        }
    }, [isOnline]);

    return { isOnline, isSyncing, syncExpenses };
}
