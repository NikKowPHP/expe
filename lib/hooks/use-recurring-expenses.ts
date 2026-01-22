import { useLiveQuery } from 'dexie-react-hooks';
import { db, RecurringExpense } from '@/lib/db/db';
import { v4 as uuidv4 } from 'uuid';

export function useRecurringExpenses() {
    const recurringExpenses = useLiveQuery(() => 
        db.recurring_expenses
            .orderBy('next_due_date')
            .filter(item => !item.deleted_at)
            .toArray()
    );

    const addRecurringExpense = async (
        expense: Omit<RecurringExpense, 'id' | 'created_at' | 'updated_at' | 'sync_status'>
    ) => {
        try {
            await db.recurring_expenses.add({
                ...expense,
                id: uuidv4(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending',
            });
        } catch (error) {
            console.error('Failed to add recurring expense:', error);
            throw error;
        }
    };

    const updateRecurringExpense = async (id: string, updates: Partial<RecurringExpense>) => {
        try {
            await db.recurring_expenses.update(id, {
                ...updates,
                updated_at: new Date().toISOString(),
                sync_status: 'pending',
            });
        } catch (error) {
            console.error('Failed to update recurring expense:', error);
            throw error;
        }
    };

    const deleteRecurringExpense = async (id: string) => {
        try {
            await db.recurring_expenses.update(id, {
                deleted_at: new Date().toISOString(),
                sync_status: 'pending',
                updated_at: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Failed to delete recurring expense:', error);
            throw error;
        }
    };

    const toggleRecurringExpense = async (id: string, active: boolean) => {
        await updateRecurringExpense(id, { active });
    };

    return {
        recurringExpenses,
        addRecurringExpense,
        updateRecurringExpense,
        deleteRecurringExpense,
        toggleRecurringExpense
    };
}
