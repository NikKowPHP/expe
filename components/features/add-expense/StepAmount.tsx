import { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Wallet, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';

interface StepAmountProps {
    onNext: (amount: string, type: 'expense' | 'income', accountId: string) => void;
    onScan: (e: React.ChangeEvent<HTMLInputElement>, accountId: string) => void;
    isScanning?: boolean;
    scanError?: string | null;
}

export function StepAmount({ onNext, onScan, isScanning = false, scanError = null }: StepAmountProps) {
    const [value, setValue] = useState('');
    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [accountId, setAccountId] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const accounts = useLiveQuery(() => db.accounts.toArray());

    const defaultAccountId = useMemo(() => {
        if (!accounts || accounts.length === 0) return '';
        const defaultAcc = accounts.find(a => a.name === 'Cash') || accounts[0];
        return defaultAcc.id;
    }, [accounts]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const selectedAccountId = accountId || defaultAccountId;
        if (e.key === 'Enter' && value && selectedAccountId) {
            onNext(value, type, selectedAccountId);
        }
    };

    const resolvedAccountId = accountId || defaultAccountId;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full p-6 justify-center"
        >
            {/* Type Toggle */}
            <div className="flex justify-center mb-8">
                <div className="bg-secondary p-1 rounded-full flex">
                    <button
                        onClick={() => setType('expense')}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                            type === 'expense' 
                                ? 'bg-background shadow-sm text-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Expense
                    </button>
                    <button
                        onClick={() => setType('income')}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                            type === 'income' 
                                ? 'bg-background shadow-sm text-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Income
                    </button>
                </div>
            </div>

            <h2 className="text-2xl font-bold mb-8 text-center">
                {type === 'expense' ? 'How much?' : 'Income Amount'}
            </h2>

            <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold ${type === 'income' ? 'text-green-500' : 'text-muted-foreground'}`}>$</span>
                <input
                    ref={inputRef}
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={`w-full text-6xl font-bold bg-transparent border-none outline-none text-center p-4 pl-12 ${type === 'income' ? 'text-green-500' : ''}`}
                    placeholder="0"
                    inputMode="decimal"
                />
            </div>

            {/* Account Selection */}
            <div className="mt-8 flex justify-center">
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-xl">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    <select
                        value={resolvedAccountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-medium"
                    >
                        {accounts?.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mt-12 flex justify-center gap-4">
                {/* Scan Button */}
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

                <Button
                    size="lg"
                    className={`rounded-full w-16 h-16 p-0 ${type === 'income' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                    onClick={() => value && resolvedAccountId && onNext(value, type, resolvedAccountId)}
                    disabled={!value || !resolvedAccountId}
                >
                    <ArrowRight className="w-8 h-8" />
                </Button>
            </div>
        </motion.div>
    );
}
