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
    const subcategories = useLiveQuery(() => db.subcategories.toArray());
    const [insight, setInsight] = useState('');
    const [loadingInsight, setLoadingInsight] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<{ id: string, name: string } | null>(null);

    // Date filtering state
    const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [customRange, setCustomRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    if (!expenses || !categories || !subcategories) return <div className="p-6">Loading...</div>;

    // Filter expenses based on date selection
    const filteredExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);

        if (filterMode === 'month') {
            const [year, month] = selectedMonth.split('-').map(Number);
            return expenseDate.getFullYear() === year && expenseDate.getMonth() === month - 1;
        } else {
            const start = new Date(customRange.start);
            const end = new Date(customRange.end);
            // Set end date to end of day to include expenses on that day
            end.setHours(23, 59, 59, 999);
            return expenseDate >= start && expenseDate <= end;
        }
    });

    // Check for exceeded budgets (using filtered expenses for accurate monthly view)
    // Note: Budgets are typically monthly, so comparing against a custom range might be tricky.
    // usage logic in useBudgets might not respect this local filter, so we might need to recalculate
    // 'spent' based on 'filteredExpenses' if we want it to be dynamic. 
    // For now, let's recalculate the 'spent' part for the alerts based on the current view.

    // Recalculate spending per category based on filtered data
    const spendingByCategory = filteredExpenses.reduce((acc, curr) => {
        const catId = curr.category_id;
        acc[catId] = (acc[catId] || 0) + curr.amount;
        return acc;
    }, {} as Record<string, number>);

    // Re-map budgets to include current view's spending
    const currentViewBudgetStatuses = budgetStatuses.map(b => ({
        ...b,
        spent: spendingByCategory[b.categoryId] || 0,
        remaining: b.budgetAmount - (spendingByCategory[b.categoryId] || 0)
    }));

    const exceededBudgets = currentViewBudgetStatuses.filter(b => b.remaining < 0);

    // Create a map of category_id to category name
    const categoryMap = categories.reduce((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
    }, {} as Record<string, string>);

    // Group by category (keep ID) using FILTERED expenses
    const byCategory = filteredExpenses.reduce((acc, curr) => {
        const catId = curr.category_id;
        acc[catId] = (acc[catId] || 0) + curr.amount;
        return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(byCategory).map(([id, value]) => ({
        id,
        name: categoryMap[id] || 'Unknown',
        value
    }));

    // Aggregate by Subcategory using FILTERED expenses
    const subcategoryMap = subcategories?.reduce((acc, sub) => {
        acc[sub.id] = sub.name;
        return acc;
    }, {} as Record<string, string>) || {};

    const bySubcategory = filteredExpenses.reduce((acc, curr) => {
        // Filter by selected category if set
        if (selectedCategory && curr.category_id !== selectedCategory.id) return acc;

        if (curr.items && curr.items.length > 0) {
            curr.items.forEach(item => {
                if (item.subcategory_id) {
                    const subName = subcategoryMap[item.subcategory_id] || 'Unknown';
                    acc[subName] = (acc[subName] || 0) + item.amount;
                }
            });
        }
        return acc;
    }, {} as Record<string, number>);

    const subcategoryData = Object.entries(bySubcategory)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Top 10 subcategories


    const handleAudit = async () => {
        setLoadingInsight(true);
        try {
            const res = await fetch('/api/ai/insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expenses: filteredExpenses?.slice(0, 50) }), // Use filtered expenses
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground text-sm">
                        {filterMode === 'month'
                            ? `Showing data for ${new Date(selectedMonth).toLocaleDateString('default', { month: 'long', year: 'numeric' })}`
                            : 'Showing data for selected range'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-card p-2 rounded-xl border border-border shadow-sm">
                    <div className="flex bg-muted rounded-lg p-1">
                        <button
                            onClick={() => setFilterMode('month')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterMode === 'month' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setFilterMode('range')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterMode === 'range' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Range
                        </button>
                    </div>

                    {filterMode === 'month' ? (
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customRange.start}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="date"
                                value={customRange.end}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    )}

                    <Button onClick={handleAudit} disabled={loadingInsight} size="sm">
                        {loadingInsight ? 'Analyzing...' : 'Audit View'}
                    </Button>
                </div>
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
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
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
                <h2 className="text-lg font-semibold mb-4">Spending by Category <span className="text-sm font-normal text-muted-foreground ml-2">(Tap slice to filter details)</span></h2>
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
                                onClick={(data) => {
                                    if (selectedCategory?.id === data.id) {
                                        setSelectedCategory(null); // Deselect
                                    } else {
                                        setSelectedCategory({ id: data.id, name: data.name });
                                    }
                                }}
                                className="cursor-pointer focus:outline-none"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        stroke={selectedCategory?.id === entry.id ? '#000' : 'none'}
                                        strokeWidth={2}
                                    />
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
                <h2 className="text-lg font-semibold mb-4">
                    {selectedCategory ? `Top Subcategories in ${selectedCategory.name}` : 'Top Spending by Subcategory (All)'}
                </h2>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={subcategoryData} layout="vertical">
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(value: number | undefined) => (value || 0).toFixed(2)} />
                            <Bar dataKey="value" fill="#82ca9d" radius={[0, 4, 4, 0]} label={{ position: 'right' }} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
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
