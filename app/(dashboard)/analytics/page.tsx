'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useBudgets } from '@/lib/hooks/use-budgets';
import { AlertCircle, TrendingUp, TrendingDown, PiggyBank, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff6b6b', '#4ecdc4'];

export default function AnalyticsPage() {
    const expenses = useLiveQuery(() => db.expenses.filter(e => !e.deleted_at).toArray());
    const categories = useLiveQuery(() => db.categories.toArray());
    const { budgetStatuses } = useBudgets();
    const subcategories = useLiveQuery(() => db.subcategories.toArray());
    const [insight, setInsight] = useState('');
    const [loadingInsight, setLoadingInsight] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<{ id: string, name: string } | null>(null);
    const currency = getCurrency();

    // View state
    const [viewType, setViewType] = useState<'expense' | 'income'>('expense');

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

    // 1. Filter expenses based on date selection
    const filteredTransactions = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);

        if (filterMode === 'month') {
            const [year, month] = selectedMonth.split('-').map(Number);
            return expenseDate.getFullYear() === year && expenseDate.getMonth() === month - 1;
        } else {
            const start = new Date(customRange.start);
            const end = new Date(customRange.end);
            end.setHours(23, 59, 59, 999);
            return expenseDate >= start && expenseDate <= end;
        }
    });

    // 2. Separate Income and Expenses
    const incomeTransactions = filteredTransactions.filter(t => {
        const cat = categories.find(c => c.id === t.category_id);
        return cat?.type === 'income';
    });

    const expenseTransactions = filteredTransactions.filter(t => {
        const cat = categories.find(c => c.id === t.category_id);
        // Default to expense if type is missing or explicitly expense
        return !cat || cat.type === 'expense';
    });

    // 3. Calculate Totals
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // 4. Select data for charts based on viewType
    const currentTransactions = viewType === 'expense' ? expenseTransactions : incomeTransactions;

    // Budget Calculations (Only relevant for expenses)
    const spendingByCategory = expenseTransactions.reduce((acc, curr) => {
        const catId = curr.category_id;
        acc[catId] = (acc[catId] || 0) + curr.amount;
        return acc;
    }, {} as Record<string, number>);

    const currentViewBudgetStatuses = budgetStatuses.map(b => ({
        ...b,
        spent: spendingByCategory[b.categoryId] || 0,
        remaining: b.budgetAmount - (spendingByCategory[b.categoryId] || 0)
    }));

    const exceededBudgets = currentViewBudgetStatuses.filter(b => b.remaining < 0);

    // Map categories
    const categoryMap = categories.reduce((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
    }, {} as Record<string, string>);

    // Group by category for Pie Chart
    const byCategory = currentTransactions.reduce((acc, curr) => {
        const catId = curr.category_id;
        acc[catId] = (acc[catId] || 0) + curr.amount;
        return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(byCategory)
        .map(([id, value]) => ({
            id,
            name: categoryMap[id] || 'Unknown',
            value
        }))
        .sort((a, b) => b.value - a.value);

    // Group by Subcategory for Bar Chart
    const subcategoryMap = subcategories?.reduce((acc, sub) => {
        acc[sub.id] = sub.name;
        return acc;
    }, {} as Record<string, string>) || {};

    const bySubcategory = currentTransactions.reduce((acc, curr) => {
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
        .slice(0, 10);

    const handleAudit = async () => {
        setLoadingInsight(true);
        try {
            const res = await fetch('/api/ai/insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expenses: expenseTransactions?.slice(0, 50) }),
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
            {/* Header Controls */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground text-sm">
                        {filterMode === 'month'
                            ? `Report for ${new Date(selectedMonth).toLocaleDateString('default', { month: 'long', year: 'numeric' })}`
                            : 'Report for selected range'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-card p-2 rounded-xl border border-border shadow-sm">
                    {/* Date Filter Toggle */}
                    <div className="flex bg-muted rounded-lg p-1">
                        <button
                            onClick={() => setFilterMode('month')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterMode === 'month' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setFilterMode('range')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterMode === 'range' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
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

                    <div className="w-px h-6 bg-border mx-1" />

                    <Button onClick={handleAudit} disabled={loadingInsight} size="sm" variant="outline">
                        {loadingInsight ? 'Analyzing...' : 'AI Audit'}
                    </Button>
                </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 bg-card rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3 text-muted-foreground mb-1">
                        <div className="p-2 bg-green-500/10 rounded-lg text-green-500"><ArrowUpRight className="w-4 h-4" /></div>
                        <span className="text-sm font-medium">Total Income</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(totalIncome, currency)}</p>
                </motion.div>
                
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-5 bg-card rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3 text-muted-foreground mb-1">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><ArrowDownLeft className="w-4 h-4" /></div>
                        <span className="text-sm font-medium">Total Expenses</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(totalExpense, currency)}</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-5 bg-card rounded-2xl border border-border shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 text-muted-foreground mb-1">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><PiggyBank className="w-4 h-4" /></div>
                            <span className="text-sm font-medium">Savings Rate</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <p className={`text-2xl font-bold ${savingsRate >= 20 ? 'text-green-500' : savingsRate > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                {savingsRate.toFixed(1)}%
                            </p>
                            <p className="text-sm text-muted-foreground mb-1">({formatCurrency(netSavings, currency)})</p>
                        </div>
                    </div>
                    {/* Progress Ring Background Concept */}
                    <svg className="absolute -right-4 -bottom-4 w-24 h-24 text-primary/5 transform -rotate-90" viewBox="0 0 36 36">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${Math.max(0, Math.min(100, savingsRate))}, 100`} />
                    </svg>
                </motion.div>
            </div>

            {/* AI Insight */}
            {insight && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/10 p-4 rounded-xl text-primary border border-primary/20 flex gap-3"
                >
                    <TrendingUp className="w-5 h-5 mt-1 shrink-0" />
                    <div>
                        <h3 className="font-bold mb-1">AI Insight</h3>
                        <p className="text-sm">{insight}</p>
                    </div>
                </motion.div>
            )}

            {/* Budget Exceeded Warning (Only visible when viewing Expenses) */}
            {viewType === 'expense' && exceededBudgets.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-950 p-4 rounded-xl text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 flex items-start gap-3"
                >
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="font-bold mb-1">Budget Alert</h3>
                        <p className="text-sm">
                            You've exceeded {exceededBudgets.length} budget{exceededBudgets.length > 1 ? 's' : ''}:
                            {' '}{exceededBudgets.map(b => b.categoryName).join(', ')}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Main Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Category Breakdown (Pie) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-card p-6 rounded-3xl shadow-sm border border-border flex flex-col"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold">Breakdown</h2>
                        {/* Toggle for Chart */}
                        <div className="flex bg-secondary rounded-lg p-1">
                            <button
                                onClick={() => { setViewType('expense'); setSelectedCategory(null); }}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewType === 'expense' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Expenses
                            </button>
                            <button
                                onClick={() => { setViewType('income'); setSelectedCategory(null); }}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewType === 'income' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Income
                            </button>
                        </div>
                    </div>

                    <div className="h-64 relative">
                        {pieData.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                                No {viewType} data for this period
                            </div>
                        ) : (
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
                                                setSelectedCategory(null);
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
                                                stroke={selectedCategory?.id === entry.id ? 'var(--foreground)' : 'none'}
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value: any) => formatCurrency(Number(value) || 0, currency)} 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                        {/* Center Text */}
                        {pieData.length > 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">{viewType}</span>
                                <span className="text-xl font-bold">
                                    {formatCurrency(viewType === 'expense' ? totalExpense : totalIncome, currency)}
                                </span>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Subcategory / Drilldown Chart */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card p-6 rounded-3xl shadow-sm border border-border"
                >
                    <h2 className="text-lg font-semibold mb-6">
                        {selectedCategory ? `${selectedCategory.name} Details` : `Top ${viewType === 'expense' ? 'Spending' : 'Sources'} Details`}
                    </h2>
                    <div className="h-64">
                        {subcategoryData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                No subcategory data available
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={subcategoryData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        width={100} 
                                        tick={{ fontSize: 12 }} 
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip 
                                        formatter={(value: any) => formatCurrency(Number(value) || 0, currency)}
                                        cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar 
                                        dataKey="value" 
                                        fill={viewType === 'expense' ? '#8884d8' : '#00C49F'} 
                                        radius={[0, 4, 4, 0]} 
                                        barSize={20}
                                        label={{ 
                                            position: 'right', 
                                            formatter: (val: any) => formatCurrency(Number(val), currency), 
                                            fontSize: 12, 
                                            fill: 'var(--muted-foreground)' 
                                        }} 
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Budget Comparison (Only if Expenses) */}
                {viewType === 'expense' && budgetStatuses.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-card p-6 rounded-3xl shadow-sm border border-border lg:col-span-2"
                    >
                        <h2 className="text-lg font-semibold mb-4">Budget vs Actual</h2>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={budgetStatuses.map(b => ({
                                    name: b.categoryName,
                                    Budget: b.budgetAmount,
                                    Actual: b.spent,
                                }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                                    <YAxis tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        formatter={(value: any) => formatCurrency(Number(value) || 0, currency)}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="Budget" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Actual" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
