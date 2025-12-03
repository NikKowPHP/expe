'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useBudgets } from '@/lib/hooks/use-budgets';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function DashboardView() {
    const expenses = useLiveQuery(
        () => db.expenses.orderBy('date').reverse().limit(10).toArray()
    );

    const totalSpent = useLiveQuery(async () => {
        const all = await db.expenses.toArray();
        return all.reduce((sum, e) => sum + e.amount, 0);
    });

    return (
        <div className="p-6 space-y-8">
            {/* Header / Total Balance */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary text-primary-foreground rounded-3xl p-6 shadow-xl"
            >
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium opacity-80">Total Spent</span>
                    <Wallet className="w-5 h-5 opacity-80" />
                </div>
                <h1 className="text-4xl font-bold">
                    ${totalSpent?.toFixed(2) || '0.00'}
                </h1>
                <div className="mt-4 flex space-x-4">
                    <div className="flex items-center text-sm bg-white/10 px-3 py-1 rounded-full">
                        <ArrowUpRight className="w-4 h-4 mr-1 text-red-300" />
                        <span>+15%</span>
                    </div>
                    <div className="flex items-center text-sm bg-white/10 px-3 py-1 rounded-full">
                        <ArrowDownLeft className="w-4 h-4 mr-1 text-green-300" />
                        <span>-5%</span>
                    </div>
                </div>
            </motion.div>

            {/* Budget Progress */}
            <BudgetProgressSection />

            {/* Recent Transactions */}
            <div>
                <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
                <div className="space-y-4">
                    {expenses?.map((expense) => (
                        <motion.div
                            key={expense.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between p-4 bg-card rounded-2xl shadow-sm border border-border"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                    {/* Icon placeholder - in real app, map category_id to icon */}
                                    <div className="w-4 h-4 bg-primary/20 rounded-full" />
                                </div>
                                <div>
                                    <p className="font-medium">{expense.note || 'Expense'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(expense.date), 'MMM d, h:mm a')}
                                    </p>
                                </div>
                            </div>
                            <span className="font-bold">-${expense.amount.toFixed(2)}</span>
                        </motion.div>
                    ))}

                    {expenses?.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                            No expenses yet. Tap + to add one!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function BudgetProgressSection() {
    const { budgetStatuses } = useBudgets();
    
    // Show top 3 budgets only
    const topBudgets = budgetStatuses.slice(0, 3);
    
    if (topBudgets.length === 0) return null;
    
    const getProgressColor = (percentUsed: number) => {
        if (percentUsed >= 100) return 'bg-red-500';
        if (percentUsed >= 90) return 'bg-red-400';
        if (percentUsed >= 75) return 'bg-yellow-500';
        return 'bg-green-500';
    };
    
    const getTextColor = (percentUsed: number) => {
        if (percentUsed >= 100) return 'text-red-600';
        if (percentUsed >= 90) return 'text-red-500';
        if (percentUsed >= 75) return 'text-yellow-600';
        return 'text-green-600';
    };
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
        >
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Budget Progress
                </h2>
                <Link href="/settings" className="text-sm text-primary hover:underline">
                    View All
                </Link>
            </div>
            
            <div className="space-y-3">
                {topBudgets.map((budget) => (
                    <div key={budget.budgetId} className="p-4 bg-card rounded-2xl border border-border">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-sm">{budget.categoryName}</span>
                            <span className={cn('text-xs font-bold', getTextColor(budget.percentUsed))}>
                                {budget.percentUsed.toFixed(0)}%
                            </span>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>${budget.spent.toFixed(2)} spent</span>
                                <span>${budget.budgetAmount.toFixed(2)} budget</span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className={cn('h-full transition-all', getProgressColor(budget.percentUsed))}
                                    style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                                />
                            </div>
                            {budget.remaining < 0 && (
                                <p className="text-xs font-medium text-red-600">
                                    Over by ${Math.abs(budget.remaining).toFixed(2)}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
