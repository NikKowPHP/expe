'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Account } from '@/lib/db/db';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';
import { Wallet, CreditCard, Landmark } from 'lucide-react';
import { calculateAccountBalance } from '@/lib/utils/finance';

interface AccountCardProps {
    account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
    const currency = getCurrency();

    const currentBalance = useLiveQuery(async () => {
        // 1. Fetch expenses (income and expense) for this account
        const expenses = await db.expenses
            .where('account_id')
            .equals(account.id)
            .toArray();
        
        // 2. Fetch transfers where this account is the SENDER
        const transfersOut = await db.transfers
            .where('from_account_id')
            .equals(account.id)
            .toArray();

        // 3. Fetch transfers where this account is the RECEIVER
        const transfersIn = await db.transfers
            .where('to_account_id')
            .equals(account.id)
            .toArray();

        const categories = await db.categories.toArray();
        
        return calculateAccountBalance(account, expenses, transfersIn, transfersOut, categories);
    }, [account.id, account.balance]);

    const getIcon = () => {
        switch (account.type) {
            case 'bank': return Landmark;
            case 'credit': return CreditCard;
            default: return Wallet;
        }
    };

    const Icon = getIcon();

    return (
        <div className="p-4 bg-card rounded-2xl border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-medium">{account.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                </div>
            </div>
            <div className="text-right">
                <p className="font-bold">{formatCurrency(currentBalance ?? account.balance, currency)}</p>
            </div>
        </div>
    );
}
        