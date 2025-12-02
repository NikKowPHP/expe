'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepAmountProps {
    onNext: (amount: string) => void;
}

export function StepAmount({ onNext }: StepAmountProps) {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && value) {
            onNext(value);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full p-6 justify-center"
        >
            <h2 className="text-2xl font-bold mb-8 text-center">How much?</h2>

            <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold text-muted-foreground">$</span>
                <input
                    ref={inputRef}
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full text-6xl font-bold bg-transparent border-none outline-none text-center p-4 pl-12"
                    placeholder="0"
                    inputMode="decimal"
                />
            </div>

            <div className="mt-12 flex justify-center">
                <Button
                    size="lg"
                    className="rounded-full w-16 h-16 p-0"
                    onClick={() => value && onNext(value)}
                    disabled={!value}
                >
                    <ArrowRight className="w-8 h-8" />
                </Button>
            </div>
        </motion.div>
    );
}
