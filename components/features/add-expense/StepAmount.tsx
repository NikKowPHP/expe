import { useState, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Wallet, Camera, Loader2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';

interface StepAmountProps {
    onNext: (amount: string, type: 'expense' | 'income' | 'transfer', accountId: string, toAccountId?: string) => void;
    onScan: (e: React.ChangeEvent<HTMLInputElement>, accountId: string) => void;
    isScanning?: boolean;
    scanError?: string | null;
}

export function StepAmount({ onNext, onScan, isScanning = false, scanError = null }: StepAmountProps) {
    const [value, setValue] = useState('');
    const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
    
    // accountId is "From Account" for transfers, or the main account for income/expense
    const [accountId, setAccountId] = useState('');
    // toAccountId is only for transfers
    const [toAccountId, setToAccountId] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const accounts = useLiveQuery(() => db.accounts.toArray());

    const defaultAccountId = useMemo(() => {
        if (!accounts || accounts.length === 0) return '';
        const defaultAcc = accounts.find(a => a.name === 'Cash') || accounts[0];
        return defaultAcc.id;
    }, [accounts]);

    useEffect(() => {
        if (defaultAccountId && !accountId) {
            setAccountId(defaultAccountId);
        }
    }, [defaultAccountId, accountId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    const handleSubmit = () => {
        if (!value) return;
        const selectedAccountId = accountId || defaultAccountId;
        
        if (type === 'transfer') {
            if (selectedAccountId && toAccountId && selectedAccountId !== toAccountId) {
                onNext(value, type, selectedAccountId, toAccountId);
            }
        } else {
             if (selectedAccountId) {
                onNext(value, type, selectedAccountId);
            }
        }
    };

    const resolvedAccountId = accountId || defaultAccountId;
    const isTransfer = type === 'transfer';
    const canSubmit = value && resolvedAccountId && (!isTransfer || (toAccountId && toAccountId !== resolvedAccountId));

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full p-6 justify-center"
        >
            {/* Type Toggle */}
            <div className="flex justify-center mb-8">
                <div className="bg-secondary p-1 rounded-full flex gap-1">
                    <button
                        onClick={() => setType('expense')}
                        className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all ${
                            type === 'expense' 
                                ? 'bg-background shadow-sm text-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Expense
                    </button>
                    <button
                        onClick={() => setType('income')}
                        className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all ${
                            type === 'income' 
                                ? 'bg-background shadow-sm text-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Income
                    </button>
                    <button
                        onClick={() => setType('transfer')}
                        className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all ${
                            type === 'transfer' 
                                ? 'bg-background shadow-sm text-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Transfer
                    </button>
                </div>
            </div>

            <h2 className="text-2xl font-bold mb-8 text-center">
                {type === 'expense' ? 'How much?' : type === 'income' ? 'Income Amount' : 'Transfer Amount'}
            </h2>

            <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold ${
                    type === 'income' ? 'text-green-500' : type === 'transfer' ? 'text-blue-500' : 'text-muted-foreground'
                }`}>$</span>
                <input
                    ref={inputRef}
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={`w-full text-6xl font-bold bg-transparent border-none outline-none text-center p-4 pl-12 ${
                        type === 'income' ? 'text-green-500' : type === 'transfer' ? 'text-blue-500' : ''
                    }`}
                    placeholder="0"
                    inputMode="decimal"
                />
            </div>

            {/* Account Selection */}
            <div className="mt-8 flex flex-col gap-4 items-center">
                
                {/* From Account */}
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-xl w-full max-w-xs justify-between">
                    <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{isTransfer ? 'From:' : 'Account:'}</span>
                    </div>
                    <select
                        value={resolvedAccountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-medium text-right"
                    >
                        {accounts?.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                </div>

                {/* To Account (Transfer Only) */}
                {isTransfer && (
                    <>
                        <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
                        <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-xl w-full max-w-xs justify-between">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">To:</span>
                            </div>
                            <select
                                value={toAccountId}
                                onChange={(e) => setToAccountId(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm font-medium text-right"
                            >
                                <option value="">Select Account</option>
                                {accounts?.filter(a => a.id !== resolvedAccountId).map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}
            </div>

            <div className="mt-12 flex justify-center gap-4">
                {/* Scan Button (Hidden for Transfer) */}
                {!isTransfer && (
                    <div className="flex flex-col items-center">
                        <Button
                            size="lg"
                            variant="outline"
                            className="rounded-full w-16 h-16 p-0 border-2"
                            onClick={() => !isScanning && fileInputRef.current?.click()}
                            disabled={isScanning}
                        >
                            {isScanning ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => onScan(e, resolvedAccountId)}
                                disabled={isScanning}
                            />
                        </Button>
                        {isScanning && <span className="mt-2 text-xs text-muted-foreground">Scanning receipt...</span>}
                        {scanError && !isScanning && <span className="mt-2 text-xs text-destructive text-center max-w-[120px]">{scanError}</span>}
                    </div>
                )}

                <Button
                    size="lg"
                    className={`rounded-full w-16 h-16 p-0 ${
                        type === 'income' ? 'bg-green-500 hover:bg-green-600' : 
                        type === 'transfer' ? 'bg-blue-500 hover:bg-blue-600' : ''
                    }`}
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                >
                    <ArrowRight className="w-8 h-8" />
                </Button>
            </div>
        </motion.div>
    );
}
