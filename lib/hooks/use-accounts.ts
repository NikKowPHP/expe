import { useLiveQuery } from 'dexie-react-hooks';
import { db, Account } from '@/lib/db/db';
import { v4 as uuidv4 } from 'uuid';

export function useAccounts() {
    const accounts = useLiveQuery(() => db.accounts.toArray());
    const expenses = useLiveQuery(() => db.expenses.filter(e => !e.deleted_at).toArray());

    const getAccountBalance = (accountId: string) => {
        const account = accounts?.find(a => a.id === accountId);
        if (!account) return 0;

        const accountExpenses = expenses?.filter(e => e.account_id === accountId) || [];
        
        // Calculate balance: Initial Balance + Income - Expense
        // We need to know if an expense is income or expense.
        // This requires joining with categories.
        // Since we can't easily join in this helper without fetching categories,
        // we might need a more robust way.
        // For now, let's assume we can fetch categories or pass them in.
        // Actually, let's calculate this in a separate effect or memo in the component,
        // or fetch categories here.
        return account.balance; // Placeholder for now, will enhance
    };

    const addAccount = async (account: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'sync_status'>) => {
        try {
            await db.accounts.add({
                ...account,
                id: uuidv4(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending',
            });
        } catch (error) {
            console.error('Failed to add account:', error);
            throw error;
        }
    };

    const updateAccount = async (id: string, updates: Partial<Account>) => {
        try {
            await db.accounts.update(id, {
                ...updates,
                updated_at: new Date().toISOString(),
                sync_status: 'pending',
            });
        } catch (error) {
            console.error('Failed to update account:', error);
            throw error;
        }
    };

    const deleteAccount = async (id: string) => {
        try {
            await db.accounts.delete(id);
            // Ideally soft delete here too if we want sync deletion
        } catch (error) {
            console.error('Failed to delete account:', error);
            throw error;
        }
    };

    return {
        accounts,
        addAccount,
        updateAccount,
        deleteAccount,
        getAccountBalance
    };
}
