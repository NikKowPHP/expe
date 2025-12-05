'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { Expense, Category } from '@/lib/db/db';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';
import { getIconComponent } from '@/lib/utils/icons';

interface ExpenseDetailsModalProps {
    expense: Expense;
    onClose: () => void;
    getCategoryById: (id: string) => Category | undefined;
}

export function ExpenseDetailsModal({ expense, onClose, getCategoryById }: ExpenseDetailsModalProps) {
    const currency = getCurrency();
    const category = getCategoryById(expense.category_id);
    const CategoryIcon = useMemo(() => category ? getIconComponent(category.icon) : DollarSign, [category]);
    
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-background w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Transaction Details</h3>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-secondary rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${category?.color || 'bg-primary/10'}`}>
                            <CategoryIcon className="w-8 h-8" />
                        </div>
                        <p className="text-2xl font-bold">
                            -{formatCurrency(expense.amount, currency)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            {format(new Date(expense.date), 'MMMM d, yyyy - h:mm a')}
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Note / Merchant</label>
                        <p className="text-lg">{expense.note || 'No note provided'}</p>
                    </div>

                    {expense.items && expense.items.length > 0 && (
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">Items</label>
                            <div className="bg-secondary/30 rounded-xl overflow-hidden">
                                {expense.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 border-b border-border last:border-0">
                                        <span className="font-medium">{item.description}</span>
                                        <span>{formatCurrency(item.amount, currency)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="pt-4">
                            <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Category</span>
                            <span className="font-medium text-foreground">
                                {getCategoryById(expense.category_id)?.name || 'Uncategorized'}
                            </span>
                            </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
