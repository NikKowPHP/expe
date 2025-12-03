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
    categories!: Table<Category>;
    budgets!: Table<Budget>;

    constructor() {
        super('ExpenseTrackerDB');
        this.version(3).stores({
            expenses: 'id, user_id, category_id, date, sync_status', // id is primary key
            categories: 'id, user_id, type, sync_status',
            budgets: 'id, user_id, category_id, [month+year], sync_status'
        });
    }
}

export const db = new ExpenseDatabase();
