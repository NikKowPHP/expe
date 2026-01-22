'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Calendar, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useSubcategories } from '@/lib/hooks/use-subcategories';

interface StepDetailsProps {
    onSubmit: (note: string, date: Date, isRecurring: boolean, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly', subcategoryId?: string) => void;
    onBack: () => void;
    categoryId?: string; // New prop to filter subcategories
}

export function StepDetails({ onSubmit, onBack, categoryId }: StepDetailsProps) {
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date());
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
    const [subcategoryId, setSubcategoryId] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch subcategories for this category
    const { subcategories } = useSubcategories(categoryId);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSubmit(note, date, isRecurring, frequency, subcategoryId || undefined);
        }
    };

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
                <h2 className="text-2xl font-bold">Details</h2>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Note</label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full p-4 text-lg bg-secondary rounded-xl outline-none"
                        placeholder="What was this for?"
                    />
                </div>

                {/* Subcategory Selection (Only if available) */}
                {subcategories.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Subcategory</label>
                        <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <select
                                value={subcategoryId}
                                onChange={(e) => setSubcategoryId(e.target.value)}
                                className="w-full p-4 pl-12 text-lg bg-secondary rounded-xl outline-none appearance-none"
                            >
                                <option value="">None</option>
                                {subcategories.map(sub => (
                                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Date</label>
                    <div className="flex items-center p-4 bg-secondary rounded-xl">
                        <Calendar className="w-6 h-6 mr-3 text-muted-foreground" />
                        <span className="text-lg">{format(date, 'MMMM d, yyyy')}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                            className="w-5 h-5 mr-3 accent-primary"
                        />
                        <span className="text-lg">Recurring Payment</span>
                    </div>
                </div>

                {isRecurring && (
                    <div className="p-4 bg-secondary rounded-xl animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Frequency</label>
                        <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as any)}
                            className="w-full p-2 bg-background rounded-lg outline-none"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="mt-auto mb-8">
                <Button
                    size="lg"
                    className="w-full h-14 text-lg rounded-xl"
                    onClick={() => onSubmit(note, date, isRecurring, frequency, subcategoryId || undefined)}
                >
                    <Check className="w-6 h-6 mr-2" />
                    Save Expense
                </Button>
            </div>
        </motion.div>
    );
}
