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
