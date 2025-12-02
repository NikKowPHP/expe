'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

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
