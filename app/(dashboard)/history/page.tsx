'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Expense } from '@/lib/db/db';
import { useExpenseMutations } from '@/lib/hooks/use-expense-mutations';
import { getIconComponent } from '@/lib/utils/icons';
import { Search, Filter, X, Trash2, Calendar, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';

export default function HistoryPage() {
    const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray());
    const categories = useLiveQuery(() => db.categories.toArray());
    const { deleteExpense } = useExpenseMutations();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [dateRange, setDateRange] = useState<'all' | 'month' | '3months'>('all');

    // Filter and sort expenses
    const filteredExpenses = useMemo(() => {
        if (!expenses) return [];

        let filtered = [...expenses];

        // Date range filter
        if (dateRange !== 'all') {
            const now = new Date();
            const start = dateRange === 'month'
                ? startOfMonth(now)
                : subMonths(now, 3);
            const end = endOfMonth(now);

            filtered = filtered.filter(expense => {
                const expenseDate = parseISO(expense.date);
                return isWithinInterval(expenseDate, { start, end });
            });
        }

        // Category filter
        if (selectedCategory) {
            filtered = filtered.filter(e => e.category_id === selectedCategory);
        }

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(e =>
                e.note?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort
        if (sortBy === 'amount') {
            filtered.sort((a, b) => b.amount - a.amount);
        } else {
            filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        return filtered;
    }, [expenses, searchTerm, selectedCategory, sortBy, dateRange]);

    const getCategoryById = (id: string) => {
        return categories?.find(c => c.id === id);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this expense?')) {
            await deleteExpense(id);
        }
    };

    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    if (!expenses || !categories) {
        return <div className="p-6">Loading...</div>;
    }

    return (
        <div className="p-6 space-y-6 pb-24">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-2">History</h1>
                <p className="text-muted-foreground">
                    {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''} · ${totalAmount.toFixed(2)} total
                </p>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search expenses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {/* Date Range */}
                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="px-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="all">All Time</option>
                    <option value="month">This Month</option>
                    <option value="3months">Last 3 Months</option>
                </select>

                {/* Sort */}
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="date">Sort by Date</option>
                    <option value="amount">Sort by Amount</option>
                </select>

                {/* Category Filter */}
                {categories.filter(c => c.type === 'expense').map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                        className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${selectedCategory === cat.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card border border-border'
                            }`}
                    >
                        {cat.icon} {cat.name}
                    </button>
                ))}
            </div>

            {/* Active Filters */}
            {(searchTerm || selectedCategory) && (
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                        >
                            "{searchTerm}" <X className="w-3 h-3" />
                        </button>
                    )}
                    {selectedCategory && (
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                        >
                            {getCategoryById(selectedCategory)?.name} <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}

            {/* Expense List */}
            <div className="space-y-3">
                <AnimatePresence>
                    {filteredExpenses.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12 text-muted-foreground"
                        >
                            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p>No expenses found</p>
                        </motion.div>
                    ) : (
                        filteredExpenses.map((expense, index) => {
                            const category = getCategoryById(expense.category_id);
                            const CategoryIcon = category ? getIconComponent(category.icon) : DollarSign;
                            
                            return (
                                <motion.div
                                    key={expense.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border"
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${category?.color || 'bg-primary/10'}`}>
                                        <CategoryIcon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold">{category?.name || 'Unknown'}</p>
                                        {expense.note && (
                                            <p className="text-sm text-muted-foreground truncate">{expense.note}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            {format(parseISO(expense.date), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-lg">${expense.amount.toFixed(2)}</span>
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
