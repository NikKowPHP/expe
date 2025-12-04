import Dexie, { Table } from 'dexie';

export interface Expense {
    id: string; // UUID
    user_id: string;
    category_id: string;
    amount: number;
    note?: string;
    date: string; // ISO date string
    created_at: string;
    updated_at: string;
    deleted_at?: string | null; // Soft delete timestamp
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
    recurring_expenses!: Table<RecurringExpense>;
    categories!: Table<Category>;
    budgets!: Table<Budget>;

    constructor() {
        super('ExpenseTrackerDB');
        this.version(4).stores({
            expenses: 'id, user_id, category_id, date, sync_status, deleted_at', // id is primary key
            recurring_expenses: 'id, user_id, category_id, next_due_date, sync_status',
            categories: 'id, user_id, type, sync_status',
            budgets: 'id, user_id, category_id, [month+year], sync_status'
        });
    }
}

export const db = new ExpenseDatabase();
