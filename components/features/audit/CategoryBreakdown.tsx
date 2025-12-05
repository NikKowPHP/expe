'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Category, Subcategory, Expense } from '@/lib/db/db';

interface CategoryBreakdownProps {
    category: Category;
    expenses: Expense[];
    subcategories: Subcategory[];
    total: number;
}

export function CategoryBreakdown({ category, expenses, subcategories, total }: CategoryBreakdownProps) {
    const [expanded, setExpanded] = useState(false);

    const categoryExpenses = expenses.filter(e => e.category_id === category.id);
    const categoryTotal = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
    const percentage = ((categoryTotal / total) * 100).toFixed(1);

    // Group by subcategory
    const subcategoryMap = subcategories.reduce((acc, sub) => {
        acc[sub.id] = sub.name;
        return acc;
    }, {} as Record<string, string>);

    const bySubcategory = categoryExpenses.reduce((acc, curr) => {
        let subId = 'Uncategorized';
        // Check items first (if split expense)
        if (curr.items && curr.items.length > 0) {
            curr.items.forEach(item => {
                const sId = item.subcategory_id || 'Uncategorized';
                const sName = subcategoryMap[sId] || 'Uncategorized';
                acc[sName] = (acc[sName] || 0) + item.amount;
            });
            return acc; 
        }
        
        // No items, currently existing schema doesn't seemingly have top-level subcategory_id on Expense based on interface, 
        // but let's double check logic. 
        // The DB interface showed: items?: { ... subcategory_id? }[]
        // But the user request implies we should have subcategory data.
        // If an expense doesn't have items, it might just be the category.
        
        // Wait, looking at DB schema in `lib/db/db.ts`:
        // expenses: 'id ...'
        // It does NOT have a top-level subcategory_id.
        // So subcategories only exist within items? Or maybe I missed something.
        // Re-reading `lib/db/db.ts`...
        // `items?: { description: string; amount: number; category_id?: string; subcategory_id?: string }[];`
        
        // If there are no items, it's just a general expense for that category.
        acc['General'] = (acc['General'] || 0) + curr.amount;

        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden mb-3">
            <button 
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
                aria-expanded={expanded}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">
                        {category.icon}
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold">{category.name}</h3>
                        <p className="text-sm text-muted-foreground">{Object.keys(bySubcategory).length} sub-groups</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-bold">${categoryTotal.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{percentage}% of total</div>
                </div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 bg-accent/20 border-t border-border/50">
                            <div className="space-y-2 mt-3">
                                {Object.entries(bySubcategory)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([name, amount]) => (
                                    <div key={name} className="flex justify-between text-sm items-center">
                                        <span className="text-muted-foreground">{name}</span>
                                        <span className="font-medium">${amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
