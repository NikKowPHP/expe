import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Wallet, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';

interface StepAmountProps {
    onNext: (amount: string, type: 'expense' | 'income', accountId: string) => void;
    onScan: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function StepAmount({ onNext, onScan }: StepAmountProps) {
    const [value, setValue] = useState('');
    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [accountId, setAccountId] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const accounts = useLiveQuery(() => db.accounts.toArray());

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (accounts && accounts.length > 0 && !accountId) {
            // Default to Cash or first account
            const defaultAcc = accounts.find(a => a.name === 'Cash') || accounts[0];
            setAccountId(defaultAcc.id);
        }
    }, [accounts, accountId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && value && accountId) {
            onNext(value, type, accountId);
        }
    };

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
                        value={accountId}
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
                <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full w-16 h-16 p-0 border-2"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Camera className="w-6 h-6" />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={onScan}
                    />
                </Button>

                <Button
                    size="lg"
                    className={`rounded-full w-16 h-16 p-0 ${type === 'income' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                    onClick={() => value && accountId && onNext(value, type, accountId)}
                    disabled={!value || !accountId}
                >
                    <ArrowRight className="w-8 h-8" />
                </Button>
            </div>
        </motion.div>
    );
}
