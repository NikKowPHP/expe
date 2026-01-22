'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Calendar, DollarSign } from 'lucide-react';
import { db, Expense } from '@/lib/db/db';
import { format } from 'date-fns';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';
import { ExpenseDetailsModal } from '@/components/features/expenses/ExpenseDetailsModal';
import { getIconComponent } from '@/lib/utils/icons';

export function GlobalSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Expense[]>([]);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const currency = getCurrency();

    useEffect(() => {
        // Load categories for displaying icons/names
        db.categories.toArray().then(setCategories);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const search = async () => {
            const lowerQuery = query.toLowerCase();
            // Perform search across expenses
            // Note: Dexie `filter` is full scan, but acceptable for client-side valid datasets (thousands)
            // For large datasets, a dedicated search index (e.g. FlexSearch) would be better, but this suffices for "Polish".
            const matches = await db.expenses
                .filter(e => !e.deleted_at && (
                    (e.note && e.note.toLowerCase().includes(lowerQuery)) ||
                    (e.amount.toString().includes(lowerQuery)) ||
                    (e.items && e.items.some(i => i.description.toLowerCase().includes(lowerQuery)))
                ))
                .limit(20)
                .toArray();
            
            setResults(matches);
        };

        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const getCategory = (id: string) => categories.find(c => c.id === id);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm p-4 flex items-start justify-center pt-20"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[70vh]"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-border flex items-center gap-3">
                        <Search className="w-5 h-5 text-muted-foreground" />
                        <input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search expenses, amounts, or items..."
                            className="flex-1 bg-transparent outline-none text-lg placeholder:text-muted-foreground"
                        />
                        <button onClick={onClose} className="p-1 hover:bg-secondary rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="overflow-y-auto p-2">
                        {results.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                {query ? 'No results found.' : 'Type to search...'}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {results.map(expense => {
                                    const cat = getCategory(expense.category_id);
                                    const Icon = cat ? getIconComponent(cat.icon) : DollarSign;
                                    
                                    return (
                                        <button
                                            key={expense.id}
                                            onClick={() => setSelectedExpense(expense)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                                        >
                                            <div className={`p-2 rounded-lg ${cat?.color || 'bg-primary/10'}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{expense.note || cat?.name || 'Expense'}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {format(new Date(expense.date), 'MMM d, yyyy')}
                                                    </span>
                                                    {expense.items && expense.items.length > 0 && (
                                                        <span>• {expense.items.length} items</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="font-bold">
                                                {formatCurrency(expense.amount, currency)}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>

            {selectedExpense && (
                <ExpenseDetailsModal
                    expense={selectedExpense}
                    onClose={() => setSelectedExpense(null)}
                    getCategoryById={(id) => categories.find(c => c.id === id)}
                />
            )}
        </AnimatePresence>
    );
}
        