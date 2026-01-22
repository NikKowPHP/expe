<reasoning>
I will implement the Account Transfers feature as requested.

Plan:
1.  **Database & Schema**:
    *   Create a new migration file `supabase/migrations/20260122000000_transfers.sql` to define the `transfers` table and its RLS policies.
    *   Update `lib/db/db.ts` to include the `transfers` table in the Dexie schema (version 9).

2.  **Sync Logic**:
    *   Update `lib/hooks/use-offline-sync.ts` to handle syncing of the `transfers` table (push pending, pull remote).

3.  **UI - Add Transfer**:
    *   Modify `components/features/add-expense/StepAmount.tsx` to include a "Transfer" tab. When selected, it will show "From Account" and "To Account" selectors.
    *   Update `components/features/add-expense/AddExpenseWizard.tsx` to handle the `transfer` type. It will skip the Category step and save directly to the `transfers` table.

4.  **Logic - Account Balances**:
    *   Update `components/features/accounts/AccountCard.tsx` to calculate balances including transfers (subtract from `from_account`, add to `to_account`).
    *   Note: The Total Net Worth calculation in `DashboardView` shouldn't change because internal transfers sum to zero (money just moves pockets), but I'll review it to ensure it uses the updated account balances logic if it relies on summing them up.

5.  **Analytics**:
    *   Since transfers are in a separate table, they are automatically excluded from the Expenses-based analytics.

Let's start with the database and sync infrastructure.
</reasoning>

<modifications>
<file path="supabase/migrations/20260122000000_transfers.sql">
<![CDATA[
-- TRANSFERS
create table public.transfers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  from_account_id uuid references public.accounts not null,
  to_account_id uuid references public.accounts not null,
  amount numeric(12, 2) not null,
  note text,
  date timestamp with time zone not null default now(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone,
  sync_status text default 'synced'
);

alter table public.transfers enable row level security;

create policy "Users can view their own transfers" on transfers
  for select using (auth.uid() = user_id);

create policy "Users can insert their own transfers" on transfers
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own transfers" on transfers
  for update using (auth.uid() = user_id);

create policy "Users can delete their own transfers" on transfers
  for delete using (auth.uid() = user_id);
]]>
</file>

<file path="lib/db/db.ts">
<![CDATA[
import Dexie, { Table } from 'dexie';

export interface Account {
    id: string;
    user_id: string;
    name: string;
    type: 'cash' | 'bank' | 'credit';
    balance: number; // Initial balance
    currency: string;
    created_at: string;
    updated_at: string;
    sync_status: 'synced' | 'pending' | 'error';
}

export interface Expense {
    id: string; // UUID
    user_id: string;
    account_id?: string; // Link to account
    category_id: string;
    amount: number;
    note?: string;
    items?: { description: string; amount: number; category_id?: string; subcategory_id?: string }[];
    date: string; // ISO date string
    created_at: string;
    updated_at: string;
    deleted_at?: string | null; // Soft delete timestamp
    sync_status: 'synced' | 'pending' | 'error';
}

export interface Transfer {
    id: string;
    user_id: string;
    from_account_id: string;
    to_account_id: string;
    amount: number;
    note?: string;
    date: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    sync_status: 'synced' | 'pending' | 'error';
}

export interface RecurringExpense {
    id: string;
    user_id: string;
    category_id: string;
    amount: number;
    description?: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    next_due_date: string; // ISO date string
    active: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null; // Soft delete timestamp
    sync_status: 'synced' | 'pending' | 'error';
}

export interface Category {
    id: string;
    user_id: string;
    name: string;
    icon: string;
    type: 'income' | 'expense';
    color?: string;
    is_default: boolean;
    sync_status: 'synced' | 'pending' | 'error';
}

export interface Subcategory {
    id: string;
    user_id: string;
    name: string;
    category_id: string;
    created_at: string;
    sync_status: 'synced' | 'pending' | 'error';
}

export interface Budget {
    id: string;
    user_id: string;
    category_id: string;
    amount: number;
    month: number; // 1-12
    year: number;
    created_at: string;
    sync_status: 'synced' | 'pending' | 'error';
}

export class ExpenseDatabase extends Dexie {
    expenses!: Table<Expense>;
    transfers!: Table<Transfer>;
    recurring_expenses!: Table<RecurringExpense>;
    categories!: Table<Category>;
    subcategories!: Table<Subcategory>;
    budgets!: Table<Budget>;
    accounts!: Table<Account>;

    constructor() {
        super('ExpenseTrackerDB');
        this.version(9).stores({
            expenses: 'id, user_id, category_id, account_id, date, sync_status, deleted_at', // id is primary key
            transfers: 'id, user_id, from_account_id, to_account_id, date, sync_status, deleted_at',
            recurring_expenses: 'id, user_id, category_id, next_due_date, active, sync_status, deleted_at',
            categories: 'id, user_id, type, sync_status',
            subcategories: 'id, user_id, category_id, name, sync_status',
            budgets: 'id, user_id, category_id, [month+year], sync_status',
            accounts: 'id, user_id, sync_status'
        });
    }
}

export const db = new ExpenseDatabase();
]]>
</file>

<file path="lib/hooks/use-offline-sync.ts">
<![CDATA[
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
            transfers,
            categories,
            subcategories,
            recurring,
            budgets,
            accounts
        ] = await Promise.all([
            db.expenses.where('sync_status').equals('pending').count(),
            db.transfers.where('sync_status').equals('pending').count(),
            db.categories.where('sync_status').equals('pending').count(),
            db.subcategories.where('sync_status').equals('pending').count(),
            db.recurring_expenses.where('sync_status').equals('pending').count(),
            db.budgets.where('sync_status').equals('pending').count(),
            db.accounts.where('sync_status').equals('pending').count(),
        ]);
        return expenses + transfers + categories + subcategories + recurring + budgets + accounts;
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

    // Process recurring expenses
    const processRecurringExpenses = useCallback(async (userId: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allRecurring = await db.recurring_expenses.toArray();

        for (const recurring of allRecurring) {
            if (recurring.deleted_at) continue;
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
                        if (error.code === '23503') {
                            const catId = sub.category_id;
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
                        if (error.code === '23503') { 
                            if (error.details && error.details.includes('accounts') && expense.account_id) {
                                await db.accounts.update(expense.account_id, { sync_status: 'pending' });
                            }
                            if (error.details && error.details.includes('categories') && expense.category_id) {
                                await db.categories.update(expense.category_id, { sync_status: 'pending' });
                            }
                        }
                    } else {
                        await db.expenses.update(expense.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('[SYNC] Failed to sync expense:', expense.id, error);
                }
            }

            const lastSync = localStorage.getItem('last_expense_sync');
            let query = supabase.from('expenses').select('*').eq('user_id', userId);
            if (lastSync) query = query.gt('updated_at', lastSync);

            const { data: remoteExpenses, error: fetchError } = await query;

            if (remoteExpenses && !fetchError) {
                for (const remoteExpense of remoteExpenses) {
                    const localExpense = await db.expenses.get(remoteExpense.id);
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

            // --- 2.5 Sync Transfers ---
            console.log('[SYNC] Syncing transfers...');
            const pendingTransfers = await db.transfers.where('sync_status').equals('pending').toArray();

            for (const transfer of pendingTransfers) {
                try {
                    const { error } = await supabase.from('transfers').upsert({
                        id: transfer.id,
                        user_id: transfer.user_id,
                        from_account_id: transfer.from_account_id,
                        to_account_id: transfer.to_account_id,
                        amount: transfer.amount,
                        note: transfer.note,
                        date: transfer.date,
                        created_at: transfer.created_at,
                        updated_at: transfer.updated_at,
                        deleted_at: transfer.deleted_at,
                    });

                    if (error) {
                        console.error('[SYNC] Error pushing transfer:', transfer.id, error);
                        if (error.code === '23503') { // FK Violation
                            if (transfer.from_account_id) await db.accounts.update(transfer.from_account_id, { sync_status: 'pending' });
                            if (transfer.to_account_id) await db.accounts.update(transfer.to_account_id, { sync_status: 'pending' });
                        }
                    } else {
                        await db.transfers.update(transfer.id, { sync_status: 'synced' });
                    }
                } catch (error) {
                    console.error('[SYNC] Failed to sync transfer:', transfer.id, error);
                }
            }

            const { data: remoteTransfers, error: transfersError } = await supabase
                .from('transfers')
                .select('*')
                .eq('user_id', userId);

            if (remoteTransfers && !transfersError) {
                for (const remoteTransfer of remoteTransfers) {
                    const localTransfer = await db.transfers.get(remoteTransfer.id);
                    if (!localTransfer || localTransfer.sync_status === 'synced') {
                        await db.transfers.put({
                            ...remoteTransfer,
                            sync_status: 'synced',
                        });
                    }
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
]]>
</file>

<file path="components/features/add-expense/StepAmount.tsx">
<![CDATA[
import { useState, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Wallet, Camera, Loader2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';

interface StepAmountProps {
    onNext: (amount: string, type: 'expense' | 'income' | 'transfer', accountId: string, toAccountId?: string) => void;
    onScan: (e: React.ChangeEvent<HTMLInputElement>, accountId: string) => void;
    isScanning?: boolean;
    scanError?: string | null;
}

export function StepAmount({ onNext, onScan, isScanning = false, scanError = null }: StepAmountProps) {
    const [value, setValue] = useState('');
    const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
    
    // accountId is "From Account" for transfers, or the main account for income/expense
    const [accountId, setAccountId] = useState('');
    // toAccountId is only for transfers
    const [toAccountId, setToAccountId] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const accounts = useLiveQuery(() => db.accounts.toArray());

    const defaultAccountId = useMemo(() => {
        if (!accounts || accounts.length === 0) return '';
        const defaultAcc = accounts.find(a => a.name === 'Cash') || accounts[0];
        return defaultAcc.id;
    }, [accounts]);

    useEffect(() => {
        if (defaultAccountId && !accountId) {
            setAccountId(defaultAccountId);
        }
    }, [defaultAccountId, accountId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    const handleSubmit = () => {
        if (!value) return;
        const selectedAccountId = accountId || defaultAccountId;
        
        if (type === 'transfer') {
            if (selectedAccountId && toAccountId && selectedAccountId !== toAccountId) {
                onNext(value, type, selectedAccountId, toAccountId);
            }
        } else {
             if (selectedAccountId) {
                onNext(value, type, selectedAccountId);
            }
        }
    };

    const resolvedAccountId = accountId || defaultAccountId;
    const isTransfer = type === 'transfer';
    const canSubmit = value && resolvedAccountId && (!isTransfer || (toAccountId && toAccountId !== resolvedAccountId));

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full p-6 justify-center"
        >
            {/* Type Toggle */}
            <div className="flex justify-center mb-8">
                <div className="bg-secondary p-1 rounded-full flex gap-1">
                    <button
                        onClick={() => setType('expense')}
                        className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all ${
                            type === 'expense' 
                                ? 'bg-background shadow-sm text-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Expense
                    </button>
                    <button
                        onClick={() => setType('income')}
                        className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all ${
                            type === 'income' 
                                ? 'bg-background shadow-sm text-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Income
                    </button>
                    <button
                        onClick={() => setType('transfer')}
                        className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all ${
                            type === 'transfer' 
                                ? 'bg-background shadow-sm text-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Transfer
                    </button>
                </div>
            </div>

            <h2 className="text-2xl font-bold mb-8 text-center">
                {type === 'expense' ? 'How much?' : type === 'income' ? 'Income Amount' : 'Transfer Amount'}
            </h2>

            <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold ${
                    type === 'income' ? 'text-green-500' : type === 'transfer' ? 'text-blue-500' : 'text-muted-foreground'
                }`}>$</span>
                <input
                    ref={inputRef}
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={`w-full text-6xl font-bold bg-transparent border-none outline-none text-center p-4 pl-12 ${
                        type === 'income' ? 'text-green-500' : type === 'transfer' ? 'text-blue-500' : ''
                    }`}
                    placeholder="0"
                    inputMode="decimal"
                />
            </div>

            {/* Account Selection */}
            <div className="mt-8 flex flex-col gap-4 items-center">
                
                {/* From Account */}
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-xl w-full max-w-xs justify-between">
                    <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{isTransfer ? 'From:' : 'Account:'}</span>
                    </div>
                    <select
                        value={resolvedAccountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-medium text-right"
                    >
                        {accounts?.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                </div>

                {/* To Account (Transfer Only) */}
                {isTransfer && (
                    <>
                        <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
                        <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-xl w-full max-w-xs justify-between">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">To:</span>
                            </div>
                            <select
                                value={toAccountId}
                                onChange={(e) => setToAccountId(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm font-medium text-right"
                            >
                                <option value="">Select Account</option>
                                {accounts?.filter(a => a.id !== resolvedAccountId).map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}
            </div>

            <div className="mt-12 flex justify-center gap-4">
                {/* Scan Button (Hidden for Transfer) */}
                {!isTransfer && (
                    <div className="flex flex-col items-center">
                        <Button
                            size="lg"
                            variant="outline"
                            className="rounded-full w-16 h-16 p-0 border-2"
                            onClick={() => !isScanning && fileInputRef.current?.click()}
                            disabled={isScanning}
                        >
                            {isScanning ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => onScan(e, resolvedAccountId)}
                                disabled={isScanning}
                            />
                        </Button>
                        {isScanning && <span className="mt-2 text-xs text-muted-foreground">Scanning receipt...</span>}
                        {scanError && !isScanning && <span className="mt-2 text-xs text-destructive text-center max-w-[120px]">{scanError}</span>}
                    </div>
                )}

                <Button
                    size="lg"
                    className={`rounded-full w-16 h-16 p-0 ${
                        type === 'income' ? 'bg-green-500 hover:bg-green-600' : 
                        type === 'transfer' ? 'bg-blue-500 hover:bg-blue-600' : ''
                    }`}
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                >
                    <ArrowRight className="w-8 h-8" />
                </Button>
            </div>
        </motion.div>
    );
}
]]>
</file>

<file path="components/features/add-expense/AddExpenseWizard.tsx">
<![CDATA[
'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { StepAmount } from './StepAmount';
import { StepCategory } from './StepCategory';
import { StepDetails } from './StepDetails';
import { StepReceiptReview } from './StepReceiptReview';
import { db } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';

interface ReceiptItem {
    description: string;
    amount: number;
    category_id: string;
    subcategory_name?: string;
    new_category_name?: string;
}

export function AddExpenseWizard() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState('');
    const [transactionType, setTransactionType] = useState<'expense' | 'income' | 'transfer'>('expense');
    const [accountId, setAccountId] = useState<string>(''); 
    const [toAccountId, setToAccountId] = useState<string>(''); // For transfers
    const [categoryId, setCategoryId] = useState('');
    const [userId, setUserId] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [tempCategories, setTempCategories] = useState<{ id: string; name: string }[]>([]);

    const [scannedData, setScannedData] = useState<{
        items: ReceiptItem[];
        merchant: string;
        date: string;
        image: string;
    } | null>(null);
    const supabase = createClient();
    const categories = useLiveQuery(() => db.categories.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());

    useEffect(() => {
        // Get authenticated user
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                // Fetch default account (Cash)
                const defaultAccount = await db.accounts.where({ user_id: user.id, name: 'Cash' }).first();
                if (defaultAccount) {
                    setAccountId(defaultAccount.id);
                }
            } else {
                setUserId('anonymous');
            }
        };
        getUser();
    }, [supabase]);

    const handleAmountSubmit = (value: string, type: 'expense' | 'income' | 'transfer', accId: string, toAccId?: string) => {
        setAmount(value);
        setTransactionType(type);
        setAccountId(accId);
        if (toAccId) setToAccountId(toAccId);

        // If transfer, skip category selection
        if (type === 'transfer') {
            setStep(3); // Go directly to details (for note/date)
        } else {
            setStep(2); // Go to category
        }
    };

    const handleCategorySubmit = (id: string) => {
        setCategoryId(id);
        setStep(3);
    };

    const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>, selectedAccountId?: string) => {
        // ... existing scan logic ...
        const file = e.target.files?.[0];
        if (!file) return;

        if (selectedAccountId) {
            setAccountId(selectedAccountId);
        }

        console.log('Scanning receipt...');

        if (!categories || categories.length === 0) {
            setScanError('Please create at least one category before scanning receipts.');
            return;
        }

        setIsScanning(true);
        setScanError(null);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            try {
                const allSubcategories = await db.subcategories.toArray();
                const res = await fetch('/api/ai/scan-receipt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64, categories, subcategories: allSubcategories }),
                });

                if (!res.ok) throw new Error('Failed to scan receipt');

                const data = await res.json();
                
                if (data.items && Array.isArray(data.items)) {
                    const newTempCategories: { id: string; name: string }[] = [];
                    const processedItems = data.items.map((item: ReceiptItem & { new_category_name?: string }) => {
                        if (item.new_category_name && !item.category_id) {
                            let tempCat = newTempCategories.find(c => c.name === item.new_category_name);
                            if (!tempCat) {
                                tempCat = {
                                    id: uuidv4(),
                                    name: item.new_category_name
                                };
                                newTempCategories.push(tempCat);
                            }
                            return { ...item, category_id: tempCat.id };
                        }
                        return item;
                    });

                    setTempCategories(newTempCategories);
                    setScannedData({
                        items: processedItems,
                        merchant: data.merchant || '',
                        date: new Date().toLocaleDateString('en-CA'),
                        image: base64,
                    });
                    setStep(4);
                    setScanError(null);
                } else if (data.amount) {
                    setAmount(data.amount.toString());
                    if (data.category_id) setCategoryId(data.category_id);
                    setStep(data.category_id ? 3 : 2);
                    setScanError(null);
                }
            } catch (error) {
                console.error('Scan failed', error);
                setScanError('Failed to scan receipt. Please try again.');
            } finally {
                setIsScanning(false);
                reader.abort();
            }
        };
        reader.readAsDataURL(file);
    };

    const handleReceiptSave = async (items: ReceiptItem[], merchant: string, receiptDate: Date, shouldSplit: boolean) => {
        // ... existing save logic ...
        if (!userId) return;
        if (!accountId) {
            alert('Please select an account before saving.');
            return;
        }
        
        const allCategories = [...(categories || []), ...tempCategories];

        if (!allCategories || allCategories.length === 0) {
            alert('Please set up categories before saving expenses.');
            return;
        }
        if (!items || items.length === 0) {
            alert('No items to save.');
            return;
        }

        if (tempCategories.length > 0) {
            const usedTempCatIds = new Set(items.map(i => i.category_id));
            const categoriesToCreate = tempCategories.filter(c => usedTempCatIds.has(c.id)).map(c => ({
                id: c.id,
                user_id: userId,
                name: c.name,
                type: 'expense' as const,
                icon: 'file',
                color: '#808080',
                is_default: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending' as const
            }));

            if (categoriesToCreate.length > 0) {
                await db.categories.bulkAdd(categoriesToCreate);
            }
        }

        const categorySet = new Set(allCategories.map((c) => c.id));
        const normalizedItems = items.map((item) => ({
            ...item,
            description: item.description?.trim() || 'Untitled item',
            amount: Number(item.amount),
        }));

        const invalidItems = normalizedItems.filter(
            (item) =>
                !item.description ||
                Number.isNaN(item.amount) ||
                item.amount <= 0 ||
                !item.category_id ||
                !categorySet.has(item.category_id)
        );

        if (invalidItems.length > 0) {
            alert('Please fix invalid receipt items (description, category, or amount) before saving.');
            return;
        }

        const processedItems = await Promise.all(normalizedItems.map(async (item) => {
            let subcategoryId = undefined;
            if (item.subcategory_name && item.subcategory_name.trim()) {
                const subName = item.subcategory_name.trim();
                const existingSub = await db.subcategories
                    .where({ user_id: userId, category_id: item.category_id })
                    .filter(s => s.name.toLowerCase() === subName.toLowerCase())
                    .first();

                if (existingSub) {
                    subcategoryId = existingSub.id;
                } else {
                    const newSubId = uuidv4();
                    await db.subcategories.add({
                        id: newSubId,
                        user_id: userId,
                        category_id: item.category_id,
                        name: subName,
                        created_at: new Date().toISOString(),
                        sync_status: 'pending',
                    });
                    subcategoryId = newSubId;
                }
            }
            return { ...item, subcategory_id: subcategoryId };
        }));

        const itemsByCategory = new Map<string, typeof processedItems>();
        for (const item of processedItems) {
            const current = itemsByCategory.get(item.category_id) || [];
            current.push(item);
            itemsByCategory.set(item.category_id, current);
        }

        if (shouldSplit) {
            const newExpenses = Array.from(itemsByCategory.entries()).map(([catId, catItems]) => {
                const totalAmount = catItems.reduce((sum, item) => sum + item.amount, 0);
                
                return {
                    id: uuidv4(),
                    user_id: userId,
                    account_id: accountId,
                    category_id: catId,
                    amount: totalAmount,
                    note: merchant,
                    items: catItems.map(i => ({ 
                        description: i.description, 
                        amount: i.amount,
                        category_id: catId,
                        subcategory_id: i.subcategory_id 
                    })),
                    date: receiptDate.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending' as const,
                };
            });
            await db.expenses.bulkAdd(newExpenses);
        } else {
            const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);
            const categoryTotals = new Map<string, number>();
            for (const [catId, catItems] of itemsByCategory.entries()) {
                const total = catItems.reduce((sum, i) => sum + i.amount, 0);
                categoryTotals.set(catId, total);
            }

            let primaryCategoryId = processedItems[0].category_id;
            let maxTotal = 0;
            for (const [catId, total] of categoryTotals.entries()) {
                if (total > maxTotal) {
                    maxTotal = total;
                    primaryCategoryId = catId;
                }
            }

            const newExpense = {
                id: uuidv4(),
                user_id: userId,
                account_id: accountId,
                category_id: primaryCategoryId,
                amount: totalAmount,
                note: merchant,
                items: processedItems.map(i => ({ 
                    description: i.description, 
                    amount: i.amount,
                    category_id: i.category_id,
                    subcategory_id: i.subcategory_id
                })),
                date: receiptDate.toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending' as const,
            };
            await db.expenses.add(newExpense);
        }

        router.push('/');
    };

    const handleDetailsSubmit = async (finalNote: string, finalDate: Date, isRecurring: boolean, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
        if (!userId) return;

        try {
            if (transactionType === 'transfer') {
                // HANDLE TRANSFER
                if (!accountId || !toAccountId) {
                    console.error('Missing account info for transfer');
                    return;
                }

                await db.transfers.add({
                    id: uuidv4(),
                    user_id: userId,
                    from_account_id: accountId,
                    to_account_id: toAccountId,
                    amount: parseFloat(amount),
                    note: finalNote || 'Transfer',
                    date: finalDate.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending',
                });

            } else {
                // HANDLE INCOME/EXPENSE
                await db.expenses.add({
                    id: uuidv4(),
                    user_id: userId,
                    account_id: accountId,
                    category_id: categoryId,
                    amount: parseFloat(amount),
                    note: finalNote,
                    date: finalDate.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending',
                });

                if (isRecurring) {
                    const nextDue = new Date(finalDate);
                    if (frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1);
                    if (frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
                    if (frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
                    if (frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

                    await db.recurring_expenses.add({
                        id: uuidv4(),
                        user_id: userId,
                        category_id: categoryId,
                        amount: parseFloat(amount),
                        description: finalNote,
                        frequency: frequency,
                        next_due_date: nextDue.toISOString(),
                        active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        sync_status: 'pending',
                    });
                }
            }

            router.push('/');
        } catch (error) {
            console.error('Failed to save transaction:', error);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <StepAmount
                        key="step1"
                        onNext={handleAmountSubmit}
                        onScan={handleScanReceipt}
                        isScanning={isScanning}
                        scanError={scanError}
                    />
                )}
                {step === 2 && transactionType !== 'transfer' && (
                    <StepCategory 
                        key="step2" 
                        onNext={handleCategorySubmit} 
                        onBack={() => setStep(1)} 
                        type={transactionType as 'expense' | 'income'}
                    />
                )}
                {step === 3 && (
                    <StepDetails 
                        key="step3" 
                        onSubmit={handleDetailsSubmit} 
                        onBack={() => setStep(transactionType === 'transfer' ? 1 : 2)} 
                    />
                )}
                {step === 4 && scannedData && categories && (
                    <StepReceiptReview
                        key="step4"
                        items={scannedData.items}
                        merchant={scannedData.merchant}
                        date={scannedData.date}
                        imageUrl={scannedData.image}
                        categories={[...categories, ...tempCategories]}
                        accounts={accounts || []}
                        accountId={accountId}
                        onChangeAccount={setAccountId}
                        onSave={handleReceiptSave}
                        onCancel={() => {
                            setScannedData(null);
                            setTempCategories([]);
                            setStep(1);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
]]>
</file>

<file path="components/features/accounts/AccountCard.tsx">
<![CDATA[
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Account } from '@/lib/db/db';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';
import { Wallet, CreditCard, Landmark } from 'lucide-react';

interface AccountCardProps {
    account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
    const currency = getCurrency();

    const currentBalance = useLiveQuery(async () => {
        // 1. Fetch expenses (income and expense) for this account
        const expenses = await db.expenses
            .where('account_id')
            .equals(account.id)
            .filter(e => !e.deleted_at)
            .toArray();
        
        // 2. Fetch transfers where this account is the SENDER
        const transfersOut = await db.transfers
            .where('from_account_id')
            .equals(account.id)
            .filter(t => !t.deleted_at)
            .toArray();

        // 3. Fetch transfers where this account is the RECEIVER
        const transfersIn = await db.transfers
            .where('to_account_id')
            .equals(account.id)
            .filter(t => !t.deleted_at)
            .toArray();

        const categories = await db.categories.toArray();
        
        let balance = account.balance; // Start with initial balance

        // Process expenses/income
        for (const expense of expenses) {
            const category = categories.find(c => c.id === expense.category_id);
            if (category?.type === 'income') {
                balance += expense.amount;
            } else {
                balance -= expense.amount;
            }
        }

        // Process transfers
        for (const t of transfersOut) {
            balance -= t.amount;
        }
        for (const t of transfersIn) {
            balance += t.amount;
        }

        return balance;
    }, [account.id, account.balance]);

    const getIcon = () => {
        switch (account.type) {
            case 'bank': return Landmark;
            case 'credit': return CreditCard;
            default: return Wallet;
        }
    };

    const Icon = getIcon();

    return (
        <div className="p-4 bg-card rounded-2xl border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-medium">{account.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                </div>
            </div>
            <div className="text-right">
                <p className="font-bold">{formatCurrency(currentBalance ?? account.balance, currency)}</p>
            </div>
        </div>
    );
}
]]>
</file>

<file path="TASKS.md">
<![CDATA[
- [x] Fix AI receipt scanning to handle discounts (OPUST/RABAT) by merging them into the item price instead of creating separate items.
- [x] Create test user (dev@dev.dev / a) and seed initial data.
- [x] Fix Recurring Expenses deletion issue (ensure soft-deleted items are filtered out in UI).
- [x] Make Main Index Page Desktop Friendly (SideNav + Grid Layout).
- [x] Implement Account Transfers (DB, Sync, UI, Balances).
]]>
</file>
</modifications>

<commands>
<![CDATA[
# Apply the new migration
supabase db reset
]]>
</commands>