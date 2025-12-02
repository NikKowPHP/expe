'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface StepDetailsProps {
    onSubmit: (note: string, date: Date) => void;
    onBack: () => void;
}

export function StepDetails({ onSubmit, onBack }: StepDetailsProps) {
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSubmit(note, date);
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

                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Date</label>
                    <div className="flex items-center p-4 bg-secondary rounded-xl">
                        <Calendar className="w-6 h-6 mr-3 text-muted-foreground" />
                        <span className="text-lg">{format(date, 'MMMM d, yyyy')}</span>
                        {/* Date picker could go here, keeping it simple for now */}
                    </div>
                </div>
            </div>

            <div className="mt-auto mb-8">
                <Button
                    size="lg"
                    className="w-full h-14 text-lg rounded-xl"
                    onClick={() => onSubmit(note, date)}
                >
                    <Check className="w-6 h-6 mr-2" />
                    Save Expense
                </Button>
            </div>
        </motion.div>
    );
}
