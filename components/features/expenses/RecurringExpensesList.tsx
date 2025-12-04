'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { useRecurringExpenses } from '@/lib/hooks/use-recurring-expenses';
import { Button } from '@/components/ui/button';
import { Trash, RefreshCw, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export function RecurringExpensesList() {
    const recurringExpenses = useLiveQuery(() => 
        db.recurring_expenses.orderBy('next_due_date').toArray()
    );
    const categories = useLiveQuery(() => db.categories.toArray());
    const { deleteRecurringExpense, toggleRecurringExpense } = useRecurringExpenses();

    if (!recurringExpenses || recurringExpenses.length === 0) {
        return (
            <div className="text-center p-6 text-muted-foreground">
                No recurring expenses set up.
            </div>
        );
    }

    const getCategoryName = (id: string) => {
        return categories?.find(c => c.id === id)?.name || 'Unknown Category';
    };

    return (
        <div className="space-y-4">
            {recurringExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{expense.description || getCategoryName(expense.category_id)}</h3>
                            <span className="text-xs px-2 py-0.5 bg-secondary rounded-full capitalize">
                                {expense.frequency}
                            </span>
                            {!expense.active && (
                                <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                                    Inactive
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">${expense.amount.toFixed(2)}</span>
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Next: {format(new Date(expense.next_due_date), 'MMM d, yyyy')}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleRecurringExpense(expense.id, !expense.active)}
                            title={expense.active ? "Pause" : "Resume"}
                        >
                            <RefreshCw className={`w-4 h-4 ${!expense.active ? 'text-muted-foreground' : 'text-primary'}`} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                if (confirm('Delete this recurring expense?')) {
                                    deleteRecurringExpense(expense.id);
                                }
                            }}
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
