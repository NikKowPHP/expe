'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Coffee, Bus, ShoppingCart, Home, Zap, Heart, Briefcase, MoreHorizontal,
    DollarSign, TrendingUp, Gift, Music, Book, Car, Plane, Film, LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCategories } from '@/lib/hooks/use-categories';

interface StepCategoryProps {
    onNext: (categoryId: string) => void;
    onBack: () => void;
    type: 'expense' | 'income';
}

// Icon mapping for dynamic icon rendering
const ICON_MAP: Record<string, LucideIcon> = {
    'coffee': Coffee,
    'bus': Bus,
    'shopping-cart': ShoppingCart,
    'home': Home,
    'zap': Zap,
    'heart': Heart,
    'briefcase': Briefcase,
    'more-horizontal': MoreHorizontal,
    'dollar-sign': DollarSign,
    'trending-up': TrendingUp,
    'gift': Gift,
    'music': Music,
    'book': Book,
    'car': Car,
    'plane': Plane,
    'film': Film,
};

export function StepCategory({ onNext, onBack, type }: StepCategoryProps) {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { categories, isLoading } = useCategories(type);

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                setSelectedIndex(prev => Math.min(prev + 1, filteredCategories.length - 1));
            } else if (e.key === 'ArrowLeft') {
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'ArrowDown') {
                setSelectedIndex(prev => Math.min(prev + 2, filteredCategories.length - 1)); // Grid of 2 cols
            } else if (e.key === 'ArrowUp') {
                setSelectedIndex(prev => Math.max(prev - 2, 0));
            } else if (e.key === 'Enter') {
                if (filteredCategories[selectedIndex]) {
                    onNext(filteredCategories[selectedIndex].id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredCategories, selectedIndex, onNext]);

    // AI Categorization Debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (search.length > 2 && filteredCategories.length === 0) {
                // If no direct match, ask AI
                try {
                    const res = await fetch('/api/ai/categorize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ note: search, categories }),
                    });
                    const data = await res.json();
                    if (data.category_id) {
                        console.log('AI Suggested:', data.category_id);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [search, filteredCategories.length, categories]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full p-6"
        >
            <div className="flex items-center mb-6">
                <Button variant="ghost" onClick={onBack} className="mr-4">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h2 className="text-2xl font-bold">Category</h2>
            </div>

            <input
                type="text"
                placeholder="Search or describe..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-4 mb-6 text-lg bg-secondary rounded-xl outline-none"
                autoFocus
            />

            <div className="grid grid-cols-2 gap-4 overflow-y-auto pb-20">
                {isLoading ? (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                        Loading categories...
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                        No categories found
                    </div>
                ) : (
                    filteredCategories.map((category, index) => {
                        const Icon = ICON_MAP[category.icon] || MoreHorizontal;
                        const isSelected = index === selectedIndex;

                        return (
                            <motion.button
                                key={category.id}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onNext(category.id)}
                                className={cn(
                                    "flex flex-col items-center justify-center p-6 rounded-2xl transition-all",
                                    category.color,
                                    isSelected ? "ring-4 ring-primary ring-offset-2" : ""
                                )}
                            >
                                <Icon className="w-8 h-8 mb-2" />
                                <span className="font-medium">{category.name}</span>
                            </motion.button>
                        );
                    })
                )}
            </div>
        </motion.div>
    );
}
