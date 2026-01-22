import { Account, Expense, Transfer, Category } from '@/lib/db/db';

/**
 * Calculates the current balance of an account based on initial balance,
 * expenses (income/expense), and transfers.
 */
export function calculateAccountBalance(
    account: Account,
    expenses: Expense[],
    transfersIn: Transfer[],
    transfersOut: Transfer[],
    categories: Category[]
): number {
    let balance = account.balance;

    // Process Expenses & Income
    for (const expense of expenses) {
        // Skip if deleted
        if (expense.deleted_at) continue;
        
        // Skip if not for this account
        if (expense.account_id !== account.id) continue;

        const category = categories.find(c => c.id === expense.category_id);
        
        // If category is income (or implicit income type), add amount
        // Note: Database schema might just rely on category type. 
        // We assume 'income' type adds, 'expense' type subtracts.
        if (category?.type === 'income') {
            balance += expense.amount;
        } else {
            // Default to expense
            balance -= expense.amount;
        }
    }

    // Process Transfers OUT (Subtract)
    for (const t of transfersOut) {
        if (t.deleted_at) continue;
        if (t.from_account_id === account.id) {
            balance -= t.amount;
        }
    }

    // Process Transfers IN (Add)
    for (const t of transfersIn) {
        if (t.deleted_at) continue;
        if (t.to_account_id === account.id) {
            balance += t.amount;
        }
    }

    return balance;
}
        