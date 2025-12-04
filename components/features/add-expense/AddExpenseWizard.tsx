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
    const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
    const [accountId, setAccountId] = useState<string>(''); // Default to empty, will select default account
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
                // Fetch default account (Cash)
                const defaultAccount = await db.accounts.where({ user_id: user.id, name: 'Cash' }).first();
                if (defaultAccount) {
                    setAccountId(defaultAccount.id);
                }
            } else {
                // If no user, use a temporary ID (for demo purposes)
                setUserId('anonymous');
            }
        };
        getUser();
    }, []);

    const handleAmountSubmit = (value: string, type: 'expense' | 'income', accId: string) => {
        setAmount(value);
        setTransactionType(type);
        setAccountId(accId);
        setStep(2);
    };

    const handleCategorySubmit = (id: string) => {
        setCategoryId(id);
        setStep(3);
    };

    const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show loading state (could add a global loading state or pass to StepAmount)
        // For now, let's just log
        console.log('Scanning receipt...');

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            
            try {
                // Fetch categories for AI context
                const categories = await db.categories.toArray();

                const res = await fetch('/api/ai/scan-receipt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64, categories }),
                });

                const data = await res.json();
                
                if (data.amount) setAmount(data.amount.toString());
                if (data.date) setDate(new Date(data.date));
                if (data.note) setNote(data.note);
                if (data.category_id) setCategoryId(data.category_id);

                // If we got everything, maybe jump to details?
                // Or just fill the amount and let user verify.
                // Let's fill amount and move to next step if valid
                if (data.amount) {
                    setStep(2); // Move to Category
                    // If category is also found, maybe move to Details?
                    // But StepCategory expects user input. 
                    // Let's just set the state. The user will see the amount pre-filled if they go back?
                    // Actually, StepAmount is currently active. If we update amount, it should reflect.
                    // But we want to auto-advance if successful.
                    
                    // Better UX:
                    // 1. Upload
                    // 2. Show spinner
                    // 3. Populate fields
                    // 4. If category found, skip to Details?
                    if (data.category_id) {
                        setStep(3);
                    } else {
                        setStep(2);
                    }
                }
            } catch (error) {
                console.error('Scan failed', error);
                alert('Failed to scan receipt');
            }
        };
        reader.readAsDataURL(file);
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
                account_id: accountId,
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
                    <StepAmount key="step1" onNext={handleAmountSubmit} onScan={handleScanReceipt} />
                )}
                {step === 2 && (
                    <StepCategory 
                        key="step2" 
                        onNext={handleCategorySubmit} 
                        onBack={() => setStep(1)} 
                        type={transactionType}
                    />
                )}
                {step === 3 && (
                    <StepDetails key="step3" onSubmit={handleDetailsSubmit} onBack={() => setStep(2)} />
                )}
            </AnimatePresence>
        </div>
    );
}
