import { describe, it, expect } from 'vitest';
import { calculateAccountBalance } from './finance';
import { Account, Expense, Transfer, Category } from '@/lib/db/db';

describe('calculateAccountBalance', () => {
    // Mock Data Helpers
    const mockAccount: Account = {
        id: 'acc1',
        user_id: 'u1',
        name: 'Test Bank',
        type: 'bank',
        balance: 1000, // Initial
        currency: 'USD',
        created_at: '',
        updated_at: '',
        sync_status: 'synced'
    };

    const mockCategoryExpense: Category = {
        id: 'cat_exp',
        user_id: 'u1',
        name: 'Food',
        icon: 'food',
        type: 'expense',
        is_default: false,
        sync_status: 'synced'
    };

    const mockCategoryIncome: Category = {
        id: 'cat_inc',
        user_id: 'u1',
        name: 'Salary',
        icon: 'money',
        type: 'income',
        is_default: false,
        sync_status: 'synced'
    };

    it('should return initial balance if no transactions', () => {
        const balance = calculateAccountBalance(mockAccount, [], [], [], [mockCategoryExpense]);
        expect(balance).toBe(1000);
    });

    it('should subtract expenses', () => {
        const expenses: Expense[] = [
            { id: 'e1', user_id: 'u1', account_id: 'acc1', category_id: 'cat_exp', amount: 50, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        const balance = calculateAccountBalance(mockAccount, expenses, [], [], [mockCategoryExpense]);
        expect(balance).toBe(950);
    });

    it('should add income', () => {
        const expenses: Expense[] = [
            { id: 'e2', user_id: 'u1', account_id: 'acc1', category_id: 'cat_inc', amount: 200, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        const balance = calculateAccountBalance(mockAccount, expenses, [], [], [mockCategoryIncome]);
        expect(balance).toBe(1200);
    });

    it('should ignore deleted expenses', () => {
        const expenses: Expense[] = [
            { id: 'e3', user_id: 'u1', account_id: 'acc1', category_id: 'cat_exp', amount: 100, date: '', created_at: '', updated_at: '', sync_status: 'synced', deleted_at: '2023-01-01' }
        ];
        const balance = calculateAccountBalance(mockAccount, expenses, [], [], [mockCategoryExpense]);
        expect(balance).toBe(1000);
    });

    it('should handle transfers out', () => {
        const transfersOut: Transfer[] = [
            { id: 't1', user_id: 'u1', from_account_id: 'acc1', to_account_id: 'acc2', amount: 300, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        const balance = calculateAccountBalance(mockAccount, [], [], transfersOut, []);
        expect(balance).toBe(700);
    });

    it('should handle transfers in', () => {
        const transfersIn: Transfer[] = [
            { id: 't2', user_id: 'u1', from_account_id: 'acc2', to_account_id: 'acc1', amount: 150, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        const balance = calculateAccountBalance(mockAccount, [], transfersIn, [], []);
        expect(balance).toBe(1150);
    });

    it('should calculate mixed transactions correctly', () => {
        // Initial: 1000
        // - 50 Expense
        // + 200 Income
        // - 300 Transfer Out
        // + 150 Transfer In
        // Total should be: 1000 - 50 + 200 - 300 + 150 = 1000
        
        const expenses: Expense[] = [
            { id: 'e1', user_id: 'u1', account_id: 'acc1', category_id: 'cat_exp', amount: 50, date: '', created_at: '', updated_at: '', sync_status: 'synced' },
            { id: 'e2', user_id: 'u1', account_id: 'acc1', category_id: 'cat_inc', amount: 200, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        
        const transfersOut: Transfer[] = [
            { id: 't1', user_id: 'u1', from_account_id: 'acc1', to_account_id: 'acc2', amount: 300, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];

        const transfersIn: Transfer[] = [
            { id: 't2', user_id: 'u1', from_account_id: 'acc2', to_account_id: 'acc1', amount: 150, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];

        const balance = calculateAccountBalance(mockAccount, expenses, transfersIn, transfersOut, [mockCategoryExpense, mockCategoryIncome]);
        expect(balance).toBe(1000);
    });
});
        