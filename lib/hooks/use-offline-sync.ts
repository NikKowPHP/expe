import { useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const supabase = createClient();

    // Track pending items
    const pendingCount = useLiveQuery(async () => {
        const [
            expenses,
            categories,
            subcategories,
            recurring,
            budgets,
            accounts
        ] = await Promise.all([
            db.expenses.where('sync_status').equals('pending').count(),
            db.categories.where('sync_status').equals('pending').count(),
            db.subcategories.where('sync_status').equals('pending').count(),
            db.recurring_expenses.where('sync_status').equals('pending').count(),
            db.budgets.where('sync_status').equals('pending').count(),
            db.accounts.where('sync_status').equals('pending').count(),
        ]);
        return expenses + categories + subcategories + recurring + budgets + accounts;
    }, [], 0);

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

        const allRecurring = await db.recurring_expenses.toArray();

        for (const recurring of allRecurring) {
            if (recurring.deleted_at) continue; // Skip deleted items
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
            console.log('[SYNC] Syncing categories...');
            // PUSH pending categories first
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
                    if (error) {
                        console.error('[SYNC] Error pushing category:', category.id, error);
                    } else {
                        await db.categories.update(category.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('[SYNC] Failed to sync category:', category.id, error);
                }
            }

            // PULL remote categories
            const { data: remoteCategories, error: categoriesError } = await supabase
                .from('categories')
                .select('*')
                .eq('user_id', userId);

            if (remoteCategories && !categoriesError) {
                for (const remoteCat of remoteCategories) {
                    const localCat = await db.categories.get(remoteCat.id);
                    if (!localCat || localCat.sync_status === 'synced') {
                        await db.categories.put({
                            ...remoteCat,
                            sync_status: 'synced',
                        });
                    }
                }
            }

            // --- 0.1 Sync Subcategories ---
            console.log('[SYNC] Syncing subcategories...');
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
                    if (error) {
                        console.error('[SYNC] Error pushing subcategory:', sub.id, error);
                        // Handle FK violation for category
                        if (error.code === '23503') { // Foreign key violation
                            const catId = sub.category_id;
                            console.warn(`[SYNC] Subcategory failed due to missing category ${catId}. Marking category as pending.`);
                            await db.categories.update(catId, { sync_status: 'pending' });
                        }
                    } else {
                        await db.subcategories.update(sub.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('[SYNC] Failed to sync subcategory:', sub.id, error);
                }
            }

            const { data: remoteSubcategories, error: subcategoriesError } = await supabase
                .from('subcategories')
                .select('*')
                .eq('user_id', userId);

            if (remoteSubcategories && !subcategoriesError) {
                for (const remoteSub of remoteSubcategories) {
                    const localSub = await db.subcategories.get(remoteSub.id);
                    if (!localSub || localSub.sync_status === 'synced') {
                        await db.subcategories.put({
                            ...remoteSub,
                            sync_status: 'synced',
                        });
                    }
                }
            }


            // --- 1. Sync Accounts ---
            console.log('[SYNC] Syncing accounts...');
            const pendingAccounts = await db.accounts.where('sync_status').equals('pending').toArray();

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
                        await db.accounts.update(account.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('[SYNC] Failed to sync account:', account.id, error);
                }
            }

            const { data: remoteAccounts, error: accountsError } = await supabase
                .from('accounts')
                .select('*')
                .eq('user_id', userId);

            if (remoteAccounts && !accountsError) {
                for (const remoteAccount of remoteAccounts) {
                    const localAccount = await db.accounts.get(remoteAccount.id);
                    if (!localAccount || localAccount.sync_status === 'synced') {
                        await db.accounts.put({
                            ...remoteAccount,
                            sync_status: 'synced',
                        });
                    }
                }
            }

            // --- 2. Sync Expenses ---
            console.log('[SYNC] Syncing expenses...');
            const pendingExpenses = await db.expenses.where('sync_status').equals('pending').toArray();

            for (const expense of pendingExpenses) {
                try {
                    const { error } = await supabase.from('expenses').upsert({
                        id: expense.id,
                        user_id: expense.user_id,
                        account_id: expense.account_id,
                        category_id: expense.category_id,
                        amount: expense.amount,
                        note: expense.note,
                        items: expense.items,
                        date: expense.date,
                        created_at: expense.created_at,
                        updated_at: expense.updated_at,
                        deleted_at: expense.deleted_at,
                    });

                    if (error) {
                        console.error('[SYNC] Error pushing expense:', expense.id, error);
                        
                        // RECOVERY LOGIC: Check for Foreign Key Violations
                        if (error.code === '23503') { 
                            // 23503 is Postgres code for foreign_key_violation
                            if (error.details && error.details.includes('accounts')) {
                                // Account missing
                                if (expense.account_id) {
                                    console.warn(`[SYNC] Expense failed due to missing account ${expense.account_id}. Marking account as pending.`);
                                    // Check if we have this account locally
                                    const localAccount = await db.accounts.get(expense.account_id);
                                    if (localAccount) {
                                        // Mark as pending so it gets pushed again next loop
                                        await db.accounts.update(expense.account_id, { sync_status: 'pending' });
                                    }
                                }
                            }
                            
                            if (error.details && error.details.includes('categories')) {
                                // Category missing
                                if (expense.category_id) {
                                    console.warn(`[SYNC] Expense failed due to missing category ${expense.category_id}. Marking category as pending.`);
                                    const localCat = await db.categories.get(expense.category_id);
                                    if (localCat) {
                                        await db.categories.update(expense.category_id, { sync_status: 'pending' });
                                    }
                                }
                            }
                        }
                    } else {
                        await db.expenses.update(expense.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('[SYNC] Failed to sync expense:', expense.id, error);
                }
            }

            // PULL Expenses
            const lastSync = localStorage.getItem('last_expense_sync');
            let query = supabase.from('expenses').select('*').eq('user_id', userId);

            if (lastSync) {
                query = query.gt('updated_at', lastSync);
            }

            const { data: remoteExpenses, error: fetchError } = await query;

            if (remoteExpenses && !fetchError) {
                for (const remoteExpense of remoteExpenses) {
                    const localExpense = await db.expenses.get(remoteExpense.id);
                    // Overwrite if synced or missing. Preserve local pending changes.
                    if (!localExpense || localExpense.sync_status === 'synced') {
                        await db.expenses.put({
                            ...remoteExpense,
                            sync_status: 'synced',
                        });
                    }
                }
                if (remoteExpenses.length > 0) {
                    const maxUpdatedAt = remoteExpenses.reduce((max, current) => {
                        return current.updated_at > max ? current.updated_at : max;
                    }, lastSync || '1970-01-01');
                    localStorage.setItem('last_expense_sync', maxUpdatedAt);
                } else if (!lastSync) {
                    localStorage.setItem('last_expense_sync', new Date().toISOString());
                }
            }


            // --- 3. Sync Recurring Expenses ---
            console.log('[SYNC] Syncing recurring expenses...');
            const pendingRecurring = await db.recurring_expenses.where('sync_status').equals('pending').toArray();

            for (const item of pendingRecurring) {
                try {
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
                        deleted_at: item.deleted_at,
                    });

                    if (error) {
                        console.error('[SYNC] Error pushing recurring expense:', item.id, error);
                         // Recovery for Category FK
                         if (error.code === '23503' && item.category_id) {
                            await db.categories.update(item.category_id, { sync_status: 'pending' });
                        }
                    } else {
                        await db.recurring_expenses.update(item.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('[SYNC] Failed to sync recurring expense:', item.id, error);
                }
            }

            const { data: remoteRecurring, error: recurringError } = await supabase
                .from('recurring_expenses')
                .select('*')
                .eq('user_id', userId);

            if (remoteRecurring && !recurringError) {
                for (const item of remoteRecurring) {
                    const localItem = await db.recurring_expenses.get(item.id);
                    if (!localItem || localItem.sync_status === 'synced') {
                        await db.recurring_expenses.put({
                            ...item,
                            sync_status: 'synced',
                            deleted_at: item.deleted_at,
                        });
                    }
                }
            }

            // --- 4. Process Due Recurring Expenses ---
            await processRecurringExpenses(userId);


            // --- 5. Sync Budgets ---
            console.log('[SYNC] Syncing budgets...');
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

                    if (error) {
                        console.error('[SYNC] Error pushing budget:', budget.id, error);
                         // Recovery for Category FK
                         if (error.code === '23503' && budget.category_id) {
                            await db.categories.update(budget.category_id, { sync_status: 'pending' });
                        }
                    } else {
                        await db.budgets.update(budget.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('[SYNC] Failed to sync budget:', budget.id, error);
                }
            }

            const { data: remoteBudgets, error: budgetsError } = await supabase
                .from('budgets')
                .select('*')
                .eq('user_id', userId);

            if (remoteBudgets && !budgetsError) {
                for (const remoteBudget of remoteBudgets) {
                    const localBudget = await db.budgets.get(remoteBudget.id);
                    if (!localBudget || localBudget.sync_status === 'synced') {
                        await db.budgets.put({
                            ...remoteBudget,
                            sync_status: 'synced',
                        });
                    }
                }
            }

            console.log('[SYNC] Sync completed successfully');

        } catch (error) {
            console.error('[SYNC] Sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, processRecurringExpenses, supabase]);

    useEffect(() => {
        const checkRecurring = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await processRecurringExpenses(user.id);
            }
        };
        checkRecurring();
    }, [processRecurringExpenses, supabase.auth]);

    useEffect(() => {
        if (isOnline) {
            syncExpenses();
        }
    }, [isOnline, syncExpenses]);

    return { isOnline, isSyncing, syncExpenses, pendingCount };
}
