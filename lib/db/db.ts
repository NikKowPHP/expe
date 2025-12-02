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

export class ExpenseDatabase extends Dexie {
    expenses!: Table<Expense>;
    categories!: Table<Category>;

    constructor() {
        super('ExpenseTrackerDB');
        this.version(1).stores({
            expenses: 'id, user_id, category_id, date, sync_status', // id is primary key
            categories: 'id, user_id, type, sync_status'
        });
    }
}

export const db = new ExpenseDatabase();
