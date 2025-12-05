'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { StepAmount } from './StepAmount';
import { StepCategory } from './StepCategory';
import { StepDetails } from './StepDetails';
import { StepReceiptReview } from './StepReceiptReview';
import { db } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';

interface ReceiptItem {
    description: string;
    amount: number;
    category_id: string;
}

export function AddExpenseWizard() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState('');
    const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
    const [accountId, setAccountId] = useState<string>(''); // Default to empty, will select default account
    const [categoryId, setCategoryId] = useState('');
    const [userId, setUserId] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);

    const [scannedData, setScannedData] = useState<{
        items: ReceiptItem[];
        merchant: string;
        date: string;
    } | null>(null);
    const supabase = createClient();
    const categories = useLiveQuery(() => db.categories.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());

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
    }, [supabase]);

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

        if (!categories || categories.length === 0) {
            setScanError('Please create at least one category before scanning receipts.');
            return;
        }

        setIsScanning(true);
        setScanError(null);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            
            try {
                // Fetch categories for AI context
                const res = await fetch('/api/ai/scan-receipt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64, categories }),
                });

                if (!res.ok) {
                    throw new Error('Failed to scan receipt');
                }

                const data = await res.json();
                
                if (data.items && Array.isArray(data.items)) {
                    setScannedData({
                        items: data.items,
                        merchant: data.merchant || '',
                        date: data.date || new Date().toISOString().split('T')[0],
                    });
                    setStep(4);
                    setScanError(null);
                } else if (data.amount) {
                    setAmount(data.amount.toString());
                    if (data.category_id) setCategoryId(data.category_id);
                    setStep(data.category_id ? 3 : 2);
                    setScanError(null);
                }
            } catch (error) {
                console.error('Scan failed', error);
                setScanError('Failed to scan receipt. Please try again.');
            } finally {
                setIsScanning(false);
                reader.abort();
            }
        };
        reader.readAsDataURL(file);
    };

    const handleReceiptSave = async (items: ReceiptItem[], merchant: string, receiptDate: Date) => {
        if (!userId) return;
        if (!accountId) {
            alert('Please select an account before saving.');
            return;
        }
        if (!categories || categories.length === 0) {
            alert('Please set up categories before saving expenses.');
            return;
        }
        if (!items || items.length === 0) {
            alert('No items to save.');
            return;
        }

        const categorySet = new Set(categories.map((c) => c.id));
        const normalizedItems = items.map((item) => ({
            ...item,
            description: item.description?.trim() || 'Untitled item',
            amount: Number(item.amount),
        }));

        const invalidItems = normalizedItems.filter(
            (item) =>
                !item.description ||
                Number.isNaN(item.amount) ||
                item.amount <= 0 ||
                !item.category_id ||
                !categorySet.has(item.category_id)
        );

        if (invalidItems.length > 0) {
            alert('Please fix invalid receipt items (description, category, or amount) before saving.');
            return;
        }

        // Group items by category
        const itemsByCategory = new Map<string, ReceiptItem[]>();
        
        for (const item of normalizedItems) {
            const current = itemsByCategory.get(item.category_id) || [];
            current.push(item);
            itemsByCategory.set(item.category_id, current);
        }

        const newExpenses = Array.from(itemsByCategory.entries()).map(([catId, catItems]) => {
            const totalAmount = catItems.reduce((sum, item) => sum + item.amount, 0);
            
            return {
                id: uuidv4(),
                user_id: userId,
                account_id: accountId,
                category_id: catId,
                amount: totalAmount,
                note: merchant,
                items: catItems.map(i => ({ description: i.description, amount: i.amount })),
                date: receiptDate.toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending' as const,
            };
        });

        await db.expenses.bulkAdd(newExpenses);
        router.push('/');
    };

    const handleDetailsSubmit = async (finalNote: string, finalDate: Date, isRecurring: boolean, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
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
                    <StepAmount
                        key="step1"
                        onNext={handleAmountSubmit}
                        onScan={handleScanReceipt}
                        isScanning={isScanning}
                        scanError={scanError}
                    />
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
                {step === 4 && scannedData && categories && (
                    <StepReceiptReview
                        key="step4"
                        items={scannedData.items}
                        merchant={scannedData.merchant}
                        date={scannedData.date}
                        categories={categories}
                        accounts={accounts || []}
                        accountId={accountId}
                        onChangeAccount={setAccountId}
                        onSave={handleReceiptSave}
                        onCancel={() => {
                            setScannedData(null);
                            setStep(1);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
