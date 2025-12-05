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
    subcategory_name?: string;
    new_category_name?: string;
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
    const [tempCategories, setTempCategories] = useState<{ id: string; name: string }[]>([]);

    const [scannedData, setScannedData] = useState<{
        items: ReceiptItem[];
        merchant: string;
        date: string;
        image: string;
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

    const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>, selectedAccountId?: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (selectedAccountId) {
            setAccountId(selectedAccountId);
        }

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
                // Fetch all subcategories to help AI match existing ones
                const allSubcategories = await db.subcategories.toArray();

                // Fetch categories for AI context
                const res = await fetch('/api/ai/scan-receipt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64, categories, subcategories: allSubcategories }),
                });

                if (!res.ok) {
                    throw new Error('Failed to scan receipt');
                }

                const data = await res.json();
                
                if (data.items && Array.isArray(data.items)) {
                    // Handle new category suggestions
                    const newTempCategories: { id: string; name: string }[] = [];
                    const processedItems = data.items.map((item: ReceiptItem & { new_category_name?: string }) => {
                        if (item.new_category_name && !item.category_id) {
                            // Check if we already created a temp category for this name in this batch
                            let tempCat = newTempCategories.find(c => c.name === item.new_category_name);
                            if (!tempCat) {
                                tempCat = {
                                    id: uuidv4(),
                                    name: item.new_category_name
                                };
                                newTempCategories.push(tempCat);
                            }
                            return {
                                ...item,
                                category_id: tempCat.id
                            };
                        }
                        return item;
                    });

                    setTempCategories(newTempCategories);
                    setScannedData({
                        items: processedItems,
                        merchant: data.merchant || '',
                        date: data.date || new Date().toISOString().split('T')[0],
                        image: base64,
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

    const handleReceiptSave = async (items: ReceiptItem[], merchant: string, receiptDate: Date, shouldSplit: boolean) => {
        if (!userId) return;
        if (!accountId) {
            alert('Please select an account before saving.');
            return;
        }
        
        const allCategories = [...(categories || []), ...tempCategories];

        if (!allCategories || allCategories.length === 0) {
            alert('Please set up categories before saving expenses.');
            return;
        }
        if (!items || items.length === 0) {
            alert('No items to save.');
            return;
        }

        // Save any temporary categories that were used
        if (tempCategories.length > 0) {
            const usedTempCatIds = new Set(items.map(i => i.category_id));
            const categoriesToCreate = tempCategories.filter(c => usedTempCatIds.has(c.id)).map(c => ({
                id: c.id,
                user_id: userId,
                name: c.name,
                type: 'expense' as const,
                icon: 'file',
                color: '#808080',
                is_default: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending' as const
            }));

            if (categoriesToCreate.length > 0) {
                await db.categories.bulkAdd(categoriesToCreate);
            }
        }

        const categorySet = new Set(allCategories.map((c) => c.id));
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

        // Create subcategories if needed and map items
        const processedItems = await Promise.all(normalizedItems.map(async (item) => {
            let subcategoryId = undefined;

            if (item.subcategory_name && item.subcategory_name.trim()) {
                const subName = item.subcategory_name.trim();
                
                // Check if subcategory exists for this category
                const existingSub = await db.subcategories
                    .where({ user_id: userId, category_id: item.category_id })
                    .filter(s => s.name.toLowerCase() === subName.toLowerCase())
                    .first();

                if (existingSub) {
                    subcategoryId = existingSub.id;
                } else {
                    // Create new subcategory
                    const newSubId = uuidv4();
                    await db.subcategories.add({
                        id: newSubId,
                        user_id: userId,
                        category_id: item.category_id,
                        name: subName,
                        created_at: new Date().toISOString(),
                        sync_status: 'pending',
                    });
                    subcategoryId = newSubId;
                }
            }

            return {
                ...item,
                subcategory_id: subcategoryId
            };
        }));

        // Group items by category (using processed items with subcategory_ids)
        const itemsByCategory = new Map<string, typeof processedItems>();
        for (const item of processedItems) {
            const current = itemsByCategory.get(item.category_id) || [];
            current.push(item);
            itemsByCategory.set(item.category_id, current);
        }

        if (shouldSplit) {
            // OPTION 1: Split into multiple expense entries per category
            const newExpenses = Array.from(itemsByCategory.entries()).map(([catId, catItems]) => {
                const totalAmount = catItems.reduce((sum, item) => sum + item.amount, 0);
                
                return {
                    id: uuidv4(),
                    user_id: userId,
                    account_id: accountId,
                    category_id: catId,
                    amount: totalAmount,
                    note: merchant,
                    items: catItems.map(i => ({ 
                        description: i.description, 
                        amount: i.amount,
                        category_id: catId,
                        subcategory_id: i.subcategory_id 
                    })),
                    date: receiptDate.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending' as const,
                };
            });

            await db.expenses.bulkAdd(newExpenses);

        } else {
            // OPTION 2: Single expense with grouped items (Default)
            const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);

            // Determine primary category (highest total)
            const categoryTotals = new Map<string, number>();
            for (const [catId, catItems] of itemsByCategory.entries()) {
                const total = catItems.reduce((sum, i) => sum + i.amount, 0);
                categoryTotals.set(catId, total);
            }

            let primaryCategoryId = processedItems[0].category_id;
            let maxTotal = 0;
            
            for (const [catId, total] of categoryTotals.entries()) {
                if (total > maxTotal) {
                    maxTotal = total;
                    primaryCategoryId = catId;
                }
            }

            const newExpense = {
                id: uuidv4(),
                user_id: userId,
                account_id: accountId,
                category_id: primaryCategoryId,
                amount: totalAmount,
                note: merchant,
                items: processedItems.map(i => ({ 
                    description: i.description, 
                    amount: i.amount,
                    category_id: i.category_id,
                    subcategory_id: i.subcategory_id
                })),
                date: receiptDate.toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending' as const,
            };

            await db.expenses.add(newExpense);
        }

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
                        imageUrl={scannedData.image}
                        categories={[...categories, ...tempCategories]}
                        accounts={accounts || []}
                        accountId={accountId}
                        onChangeAccount={setAccountId}
                        onSave={handleReceiptSave}
                        onCancel={() => {
                            setScannedData(null);
                            setTempCategories([]);
                            setStep(1);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
