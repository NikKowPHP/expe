'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { useAccounts } from '@/lib/hooks/use-accounts';
import { Button } from '@/components/ui/button';
import { Wallet, CreditCard, Landmark, Plus, Trash2, Edit } from 'lucide-react';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';

export function AccountManager() {
    const { accounts, addAccount, updateAccount, deleteAccount } = useAccounts();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'cash' as 'cash' | 'bank' | 'credit',
        balance: 0,
        currency: 'USD'
    });

    const allAccounts = useLiveQuery(() => db.accounts.toArray());
    const currency = getCurrency();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const { data: { user } } = await (await import('@/lib/supabase/client')).createClient().auth.getUser();
        if (!user) return;

        if (editingId) {
            await updateAccount(editingId, formData);
            setEditingId(null);
        } else {
            await addAccount({
                user_id: user.id,
                ...formData
            });
            setIsAdding(false);
        }
        
        setFormData({ name: '', type: 'cash', balance: 0, currency: 'USD' });
    };

    const handleEdit = (account: any) => {
        setEditingId(account.id);
        setFormData({
            name: account.name,
            type: account.type,
            balance: account.balance,
            currency: account.currency
        });
        setIsAdding(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this account? This will not delete associated transactions.')) {
            await deleteAccount(id);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'bank': return Landmark;
            case 'credit': return CreditCard;
            default: return Wallet;
        }
    };

    return (
        <div className="space-y-4">
            {/* Account List */}
            <div className="space-y-3">
                {allAccounts?.map(account => {
                    const Icon = getIcon(account.type);
                    return (
                        <div key={account.id} className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-medium">{account.name}</h3>
                                    <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold mr-2">{formatCurrency(account.balance, currency)}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(account)}
                                >
                                    <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(account.id)}
                                    className="text-destructive hover:text-destructive"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add/Edit Form */}
            {isAdding ? (
                <form onSubmit={handleSubmit} className="p-4 bg-background rounded-xl border border-border space-y-4">
                    <h3 className="font-semibold">{editingId ? 'Edit Account' : 'New Account'}</h3>
                    
                    <div>
                        <label className="text-sm font-medium">Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full mt-1 p-2 bg-secondary rounded-lg outline-none"
                            placeholder="e.g., Checking Account"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                            className="w-full mt-1 p-2 bg-secondary rounded-lg outline-none"
                        >
                            <option value="cash">Cash</option>
                            <option value="bank">Bank Account</option>
                            <option value="credit">Credit Card</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Initial Balance</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.balance}
                            onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                            className="w-full mt-1 p-2 bg-secondary rounded-lg outline-none"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button type="submit" className="flex-1">
                            {editingId ? 'Update' : 'Add Account'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsAdding(false);
                                setEditingId(null);
                                setFormData({ name: '', type: 'cash', balance: 0, currency: 'USD' });
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            ) : (
                <Button onClick={() => setIsAdding(true)} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                </Button>
            )}
        </div>
    );
}
