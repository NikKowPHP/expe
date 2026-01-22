'use client';

import { motion } from 'framer-motion';
import { X, ArrowRightLeft, Wallet, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Transfer, Account } from '@/lib/db/db';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';

interface TransferDetailsModalProps {
    transfer: Transfer;
    fromAccount?: Account;
    toAccount?: Account;
    onClose: () => void;
    onDelete: (id: string) => void;
}

export function TransferDetailsModal({ 
    transfer, 
    fromAccount, 
    toAccount, 
    onClose, 
    onDelete 
}: TransferDetailsModalProps) {
    const currency = getCurrency();
    
    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this transfer? Account balances will be reverted.')) {
            onDelete(transfer.id);
            onClose();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-background w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Transfer Details</h3>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-secondary rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-8">
                    {/* Amount Header */}
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                            <ArrowRightLeft className="w-8 h-8" />
                        </div>
                        <p className="text-3xl font-bold">
                            {formatCurrency(transfer.amount, currency)}
                        </p>
                        <p className="text-muted-foreground text-sm mt-1">
                            {format(new Date(transfer.date), 'MMMM d, yyyy - h:mm a')}
                        </p>
                    </div>

                    {/* Transfer Flow */}
                    <div className="bg-secondary/30 rounded-2xl p-4 border border-border">
                        <div className="flex items-center justify-between relative">
                            {/* Connector Line */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-0.5 bg-border -z-10" />

                            <div className="flex flex-col items-center gap-2 w-1/3">
                                <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center">
                                    <Wallet className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-muted-foreground">From</p>
                                    <p className="font-medium text-sm truncate w-full">
                                        {fromAccount?.name || 'Unknown'}
                                    </p>
                                </div>
                            </div>

                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center z-10">
                                <ArrowRightLeft className="w-4 h-4" />
                            </div>

                            <div className="flex flex-col items-center gap-2 w-1/3">
                                <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center">
                                    <Wallet className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-muted-foreground">To</p>
                                    <p className="font-medium text-sm truncate w-full">
                                        {toAccount?.name || 'Unknown'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Note */}
                    {transfer.note && (
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Note</label>
                            <p className="text-lg">{transfer.note}</p>
                        </div>
                    )}
                    
                    {/* Actions */}
                    <div className="pt-4">
                        <Button 
                            variant="destructive" 
                            className="w-full h-12 rounded-xl"
                            onClick={handleDelete}
                        >
                            <Trash2 className="w-5 h-5 mr-2" />
                            Delete Transfer
                        </Button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
