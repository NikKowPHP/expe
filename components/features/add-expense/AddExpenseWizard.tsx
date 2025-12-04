'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { StepAmount } from './StepAmount';
import { StepCategory } from './StepCategory';
import { StepDetails } from './StepDetails';
import { db } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export function AddExpenseWizard() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date());
    const [userId, setUserId] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        // Get authenticated user
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            } else {
                // If no user, use a temporary ID (for demo purposes)
                setUserId('anonymous');
            }
        };
        getUser();
    }, []);

    const handleAmountSubmit = (value: string) => {
        setAmount(value);
        setStep(2);
    };

    const handleCategorySubmit = (id: string) => {
        setCategoryId(id);
        setStep(3);
    };

    const handleDetailsSubmit = async (finalNote: string, finalDate: Date, isRecurring: boolean, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
        setNote(finalNote);
        setDate(finalDate);

        if (!userId) {
            console.error('No user ID available');
            return;
        }

        try {
            // 1. Save the immediate expense
            await db.expenses.add({
                id: uuidv4(),
                user_id: userId,
                category_id: categoryId,
                amount: parseFloat(amount),
                note: finalNote,
                date: finalDate.toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending',
            });

            // 2. If recurring, save the recurring schedule
            if (isRecurring) {
                // Calculate next due date
                const nextDue = new Date(finalDate);
                if (frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1);
                if (frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
                if (frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
                if (frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

                await db.recurring_expenses.add({
                    id: uuidv4(),
                    user_id: userId,
                    category_id: categoryId,
                    amount: parseFloat(amount),
                    description: finalNote,
                    frequency: frequency,
                    next_due_date: nextDue.toISOString(),
                    active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending',
                });
            }

            // Navigate back to home - sync will happen automatically via useOfflineSync
            router.push('/');
        } catch (error) {
            console.error('Failed to save expense:', error);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <StepAmount key="step1" onNext={handleAmountSubmit} />
                )}
                {step === 2 && (
                    <StepCategory key="step2" onNext={handleCategorySubmit} onBack={() => setStep(1)} />
                )}
                {step === 3 && (
                    <StepDetails key="step3" onSubmit={handleDetailsSubmit} onBack={() => setStep(2)} />
                )}
            </AnimatePresence>
        </div>
    );
}
