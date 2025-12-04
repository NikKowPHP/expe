'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useBudgets } from '@/lib/hooks/use-budgets';
import { AlertCircle } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AnalyticsPage() {
    const expenses = useLiveQuery(() => db.expenses.filter(e => !e.deleted_at).toArray());
    const categories = useLiveQuery(() => db.categories.toArray());
    const { budgetStatuses } = useBudgets();
    const [insight, setInsight] = useState('');
    const [loadingInsight, setLoadingInsight] = useState(false);

    if (!expenses || !categories) return <div className="p-6">Loading...</div>;

    // Check for exceeded budgets
    const exceededBudgets = budgetStatuses.filter(b => b.remaining < 0);

    // Create a map of category_id to category title
    const categoryMap = categories.reduce((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
    }, {} as Record<string, string>);

    // Group by category
    const byCategory = expenses.reduce((acc, curr) => {
        const categoryName = categoryMap[curr.category_id] || 'Unknown';
        acc[categoryName] = (acc[categoryName] || 0) + curr.amount;
        return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

    const handleAudit = async () => {
        setLoadingInsight(true);
        try {
            const res = await fetch('/api/ai/insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expenses: expenses?.slice(0, 50) }), // Limit to 50 for now
            });
            const data = await res.json();
            setInsight(data.insight);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingInsight(false);
        }
    };

    return (
        <div className="p-6 space-y-8 pb-24">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Analytics</h1>
                <Button onClick={handleAudit} disabled={loadingInsight}>
                    {loadingInsight ? 'Analyzing...' : 'Spending Audit'}
                </Button>
            </div>

            {insight && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/10 p-4 rounded-xl text-primary border border-primary/20"
                >
                    <h3 className="font-bold mb-2">AI Insight</h3>
                    <p>{insight}</p>
                </motion.div>
            )}

            {/* Budget Exceeded Warning */}
            {exceededBudgets.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-950 p-4 rounded-xl text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 flex items-start gap-3"
                >
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 className="font-bold mb-1">Budget Alert</h3>
                        <p>
                            You've exceeded {exceededBudgets.length} budget{exceededBudgets.length > 1 ? 's' : ''} this month:
                            {' '}{exceededBudgets.map(b => b.categoryName).join(', ')}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Budget vs Actual Chart */}
            {budgetStatuses.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-card p-6 rounded-3xl shadow-sm border border-border"
                >
                    <h2 className="text-lg font-semibold mb-4">Budget vs Actual</h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={budgetStatuses.map(b => ({
                                name: b.categoryName,
                                Budget: b.budgetAmount,
                                Actual: b.spent,
                            }))}>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Actual" fill="#8884d8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card p-6 rounded-3xl shadow-sm border border-border"
            >
                <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-card p-6 rounded-3xl shadow-sm border border-border"
            >
                <h2 className="text-lg font-semibold mb-4">Monthly Trends</h2>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pieData}>
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>
        </div>
    );
}
