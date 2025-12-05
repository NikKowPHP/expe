'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Check, ArrowLeft, Calendar, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReceiptItem {
    description: string;
    amount: number;
    category_id: string;
}

interface StepReceiptReviewProps {
    items: ReceiptItem[];
    merchant: string;
    date: string;
    categories: { id: string; name: string }[];
    onSave: (items: ReceiptItem[], merchant: string, date: Date) => void;
    onCancel: () => void;
}

export function StepReceiptReview({
    items: initialItems,
    merchant,
    date,
    categories,
    onSave,
    onCancel,
}: StepReceiptReviewProps) {
    const [items, setItems] = useState(initialItems);
    const [receiptDate, setReceiptDate] = useState(date);
    const [storeName, setStoreName] = useState(merchant);

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateCategory = (index: number, newCatId: string) => {
        const newItems = [...items];
        newItems[index].category_id = newCatId;
        setItems(newItems);
    };

    const total = items.reduce((sum, item) => sum + item.amount, 0);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col h-full p-4 pb-24 overflow-y-auto"
        >
            <div className="flex items-center mb-6">
                <Button variant="ghost" onClick={onCancel} className="mr-2">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h2 className="text-xl font-bold">Review Receipt</h2>
            </div>

            <div className="bg-secondary/50 p-4 rounded-xl mb-6 space-y-3">
                <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-muted-foreground" />
                    <input
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        className="bg-transparent font-semibold w-full outline-none"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <input
                        type="date"
                        value={receiptDate}
                        onChange={(e) => setReceiptDate(e.target.value)}
                        className="bg-transparent text-sm w-full outline-none"
                    />
                </div>
            </div>

            <div className="space-y-3">
                {items.map((item, idx) => (
                    <div key={idx} className="bg-card border border-border p-3 rounded-xl flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                            <input
                                value={item.description}
                                onChange={(e) => {
                                    const newItems = [...items];
                                    newItems[idx].description = e.target.value;
                                    setItems(newItems);
                                }}
                                className="font-medium bg-transparent outline-none w-full"
                            />
                            <button onClick={() => removeItem(idx)} className="text-destructive p-1">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex justify-between items-center mt-1">
                            <select
                                value={item.category_id}
                                onChange={(e) => updateCategory(idx, e.target.value)}
                                className="text-xs bg-secondary px-2 py-1 rounded-lg outline-none max-w-[150px]"
                            >
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>

                            <span className="font-bold">${item.amount.toFixed(2)}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border z-10">
                <div className="flex justify-between items-center mb-4 px-2">
                    <span className="text-muted-foreground">Total items: {items.length}</span>
                    <span className="text-xl font-bold">${total.toFixed(2)}</span>
                </div>
                <Button
                    className="w-full h-12 text-lg rounded-xl"
                    onClick={() => onSave(items, storeName, new Date(receiptDate))}
                    disabled={items.length === 0}
                >
                    <Check className="w-5 h-5 mr-2" />
                    Save All
                </Button>
            </div>
        </motion.div>
    );
}
