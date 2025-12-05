import { useEffect, useState, useCallback } from 'react';
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

    // Process recurring expenses - extracted to hook scope so it can run offline
    const processRecurringExpenses = useCallback(async (userId: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Dexie stores booleans as 1/0 sometimes depending on backend, but usually true/false works.
        // Let's just fetch all and filter.
        const allRecurring = await db.recurring_expenses.toArray();
        
        for (const recurring of allRecurring) {
            if (!recurring.active) continue;

            const nextDue = new Date(recurring.next_due_date);
            let modified = false;

            while (nextDue <= today) {
                // Create expense
                await db.expenses.add({
                    id: crypto.randomUUID(),
                    user_id: userId,
                    category_id: recurring.category_id,
                    amount: recurring.amount,
                    note: recurring.description || 'Recurring Expense',
                    date: nextDue.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending',
                });

                // Calculate next date
                if (recurring.frequency === 'daily') {
                    nextDue.setDate(nextDue.getDate() + 1);
                } else if (recurring.frequency === 'weekly') {
                    nextDue.setDate(nextDue.getDate() + 7);
                } else if (recurring.frequency === 'monthly') {
                    nextDue.setMonth(nextDue.getMonth() + 1);
                } else if (recurring.frequency === 'yearly') {
                    nextDue.setFullYear(nextDue.getFullYear() + 1);
                }
                modified = true;
            }

            if (modified) {
                await db.recurring_expenses.update(recurring.id, {
                    next_due_date: nextDue.toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending',
                });
            }
        }
    }, []);

    const syncExpenses = useCallback(async () => {
        if (!isOnline) return;
        setIsSyncing(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn('Cannot sync expenses: User not authenticated.');
            setIsSyncing(false);
            return;
        }
        const userId = user.id;
        
        console.log('[SYNC] Starting sync for user:', userId);

        try {
            // --- 0. Sync Categories ---
            // Pull
            const { data: remoteCategories, error: categoriesError } = await supabase
                .from('categories')
                .select('*')
                .eq('user_id', userId);

            if (remoteCategories && !categoriesError) {
                for (const remoteCat of remoteCategories) {
                    await db.categories.put({
                        ...remoteCat,
                        sync_status: 'synced',
                    });
                }
            }

            // --- 0.1 Sync Subcategories ---
            // Pull
            const { data: remoteSubcategories, error: subcategoriesError } = await supabase
                .from('subcategories')
                .select('*')
                .eq('user_id', userId);

            if (remoteSubcategories && !subcategoriesError) {
                for (const remoteSub of remoteSubcategories) {
                    await db.subcategories.put({
                        ...remoteSub,
                        sync_status: 'synced',
                    });
                }
            }

            // Push pending subcategories
            const pendingSubcategories = await db.subcategories.where('sync_status').equals('pending').toArray();
            for (const sub of pendingSubcategories) {
                try {
                    const { error } = await supabase.from('subcategories').upsert({
                        id: sub.id,
                        user_id: sub.user_id,
                        name: sub.name,
                        category_id: sub.category_id,
                        created_at: sub.created_at,
                    });
                    if (!error) await db.subcategories.update(sub.id, { sync_status: 'synced' });
                } catch (error) {
                    console.error('Failed to sync subcategory:', sub.id, error);
                }
            }

            // Push pending categories
            const pendingCategories = await db.categories.where('sync_status').equals('pending').toArray();
            for (const category of pendingCategories) {
                try {
                    const { error } = await supabase.from('categories').upsert({
                        id: category.id,
                        user_id: category.user_id,
                        name: category.name,
                        icon: category.icon,
                        type: category.type,
                        color: category.color,
                        is_default: category.is_default,
                    });
                    if (!error) await db.categories.update(category.id, { sync_status: 'synced' });
                } catch (error) {
                    console.error('Failed to sync category:', category.id, error);
                }
            }

            // --- 1. Sync Accounts FIRST (before expenses need them) ---
            console.log('[SYNC] Syncing accounts...');
            const { data: remoteAccounts, error: accountsError } = await supabase
                .from('accounts')
                .select('*')
                .eq('user_id', userId);

            if (accountsError) {
                console.error('[SYNC] Error fetching remote accounts:', accountsError);
            }

            if (remoteAccounts && !accountsError) {
                console.log('[SYNC] Fetched', remoteAccounts.length, 'remote accounts');
                for (const remoteAccount of remoteAccounts) {
                    await db.accounts.put({
                        ...remoteAccount,
                        sync_status: 'synced',
                    });
                }
            }

            // Push pending accounts
            const pendingAccounts = await db.accounts.where('sync_status').equals('pending').toArray();
            console.log('[SYNC] Pushing', pendingAccounts.length, 'pending accounts');
            
            for (const account of pendingAccounts) {
                try {
                    const { error } = await supabase.from('accounts').upsert({
                        id: account.id,
                        user_id: account.user_id,
                        name: account.name,
                        type: account.type,
                        balance: account.balance,
                        currency: account.currency,
                        created_at: account.created_at,
                        updated_at: account.updated_at,
                    });

                    if (error) {
                        console.error('[SYNC] Error pushing account:', account.id, error);
                    } else {
                        console.log('[SYNC] Successfully pushed account:', account.name);
                        await db.accounts.update(account.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('Failed to sync account:', account.id, error);
                }
            }

            // --- 2. Sync Expenses (AFTER accounts) ---
            console.log('[SYNC] Syncing expenses...');
            
            // Push pending
            const pendingExpenses = await db.expenses.where('sync_status').equals('pending').toArray();
            for (const expense of pendingExpenses) {
                const { error } = await supabase.from('expenses').upsert({
                    id: expense.id,
                    user_id: expense.user_id,
                    account_id: expense.account_id, // Add account_id
                    category_id: expense.category_id,
                    amount: expense.amount,
                    note: expense.note,
                    items: expense.items, // Add items field
                    date: expense.date,
                    created_at: expense.created_at,
                    updated_at: expense.updated_at,
                    deleted_at: expense.deleted_at, // Send deleted_at
                });

                if (!error) {
                    await db.expenses.update(expense.id, { sync_status: 'synced' });
                }
            }

            // Pull new/updated (Incremental Sync)
            const lastSync = localStorage.getItem('last_expense_sync');
            let query = supabase
                .from('expenses')
                .select('*')
                .eq('user_id', userId);

            if (lastSync) {
                query = query.gt('updated_at', lastSync);
            }
            
            // Fetch all changes (no limit, or handle pagination if needed. For now, assume reasonable volume)
            const { data: remoteExpenses, error: fetchError } = await query;

            if (remoteExpenses && !fetchError) {
                for (const remoteExpense of remoteExpenses) {
                    const localExpense = await db.expenses.get(remoteExpense.id);
                    
                    // If local has pending changes, conflict resolution needed. 
                    // For now, server wins or we skip. Let's say server wins for simplicity unless we want to get fancy.
                    // But if we just edited it locally, we might want to keep local.
                    // Simple rule: if local is 'synced' or doesn't exist, overwrite.
                    if (!localExpense || localExpense.sync_status === 'synced') {
                        await db.expenses.put({
                            ...remoteExpense,
                            sync_status: 'synced',
                        });
                    }
                }
                // Update last sync timestamp
                if (remoteExpenses.length > 0) {
                     // Find the max updated_at
                     const maxUpdatedAt = remoteExpenses.reduce((max, current) => {
                         return current.updated_at > max ? current.updated_at : max;
                     }, lastSync || '1970-01-01');
                     localStorage.setItem('last_expense_sync', maxUpdatedAt);
                } else if (!lastSync) {
                    // If first sync and no data, set to now to avoid fetching everything next time? 
                    // No, better to leave it null or set to a safe past date.
                    localStorage.setItem('last_expense_sync', new Date().toISOString());
                }
            }


            // --- 2. Sync Recurring Expenses ---
             // Pull
             const { data: remoteRecurring, error: recurringError } = await supabase
                .from('recurring_expenses')
                .select('*')
                .eq('user_id', userId);

            if (remoteRecurring && !recurringError) {
                for (const item of remoteRecurring) {
                    await db.recurring_expenses.put({
                        ...item,
                        sync_status: 'synced',
                    });
                }
            }

            // Push pending
            const pendingRecurring = await db.recurring_expenses.where('sync_status').equals('pending').toArray();
            for (const item of pendingRecurring) {
                const { error } = await supabase.from('recurring_expenses').upsert({
                    id: item.id,
                    user_id: item.user_id,
                    category_id: item.category_id,
                    amount: item.amount,
                    description: item.description,
                    frequency: item.frequency,
                    next_due_date: item.next_due_date,
                    active: item.active,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                });

                if (!error) {
                    await db.recurring_expenses.update(item.id, { sync_status: 'synced' });
                }
            }

            // --- 3. Process Due Recurring Expenses ---
            await processRecurringExpenses(userId);


            // --- 4. Sync Budgets ---
            const { data: remoteBudgets, error: budgetsError } = await supabase
                .from('budgets')
                .select('*')
                .eq('user_id', userId);

            if (remoteBudgets && !budgetsError) {
                for (const remoteBudget of remoteBudgets) {
                    await db.budgets.put({
                        ...remoteBudget,
                        sync_status: 'synced',
                    });
                }
            }

            // Push pending budgets
            const pendingBudgets = await db.budgets.where('sync_status').equals('pending').toArray();
            for (const budget of pendingBudgets) {
                try {
                    const { error } = await supabase.from('budgets').upsert({
                        id: budget.id,
                        user_id: budget.user_id,
                        category_id: budget.category_id,
                        amount: budget.amount,
                        month: budget.month,
                        year: budget.year,
                    });

                    if (!error) {
                        await db.budgets.update(budget.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('Failed to sync budget:', budget.id, error);
                }
            }

            // (Accounts now synced above before expenses)
            
            console.log('[SYNC] Sync completed successfully');

        } catch (error) {
            console.error('[SYNC] Sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, processRecurringExpenses, supabase]);

    // Process recurring expenses on mount (works offline)
    useEffect(() => {
        const checkRecurring = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await processRecurringExpenses(user.id);
            }
        };
        checkRecurring();
    }, [processRecurringExpenses, supabase.auth]); // Runs once on mount

    // Auto-sync when coming online
    useEffect(() => {
        if (isOnline) {
            syncExpenses();
        }
    }, [isOnline, syncExpenses]);

    return { isOnline, isSyncing, syncExpenses };
}
