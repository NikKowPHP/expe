'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Expense, Transfer, Category, Account } from '@/lib/db/db';
import { useExpenseMutations } from '@/lib/hooks/use-expense-mutations';
import { useTransferMutations } from '@/lib/hooks/use-transfer-mutations';
import { getIconComponent } from '@/lib/utils/icons';
import { Search, Filter, ArrowRightLeft, DollarSign } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';
import { ExpenseDetailsModal } from '@/components/features/expenses/ExpenseDetailsModal';
import { TransferDetailsModal } from '@/components/features/transfers/TransferDetailsModal';
import { AnimatePresence } from 'framer-motion';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { cn } from '@/lib/utils';
import { CSSProperties } from 'react';

type Transaction = (Expense & { type: 'expense' }) | (Transfer & { type: 'transfer' });

interface RowProps {
    transactions: Transaction[];
    categories: Category[];
    accounts: Account[];
    currency: string;
    onClick: (t: Transaction) => void;
}

const Row = ({ index, style, transactions, categories, accounts, currency, onClick }: { index: number; style: CSSProperties } & RowProps) => {
    const item = transactions[index];
    const isTransfer = item.type === 'transfer';

    const getCategoryById = (id: string) => categories.find(c => c.id === id);
    const getAccountById = (id: string) => accounts.find(a => a.id === id);

    let Icon, color, title, subtitle;

    if (isTransfer) {
        Icon = ArrowRightLeft;
        color = 'bg-blue-100 text-blue-600';
        const from = getAccountById((item as Transfer).from_account_id)?.name || 'Unknown';
        const to = getAccountById((item as Transfer).to_account_id)?.name || 'Unknown';
        title = 'Transfer';
        subtitle = `${from} → ${to}`;
    } else {
        const cat = getCategoryById((item as Expense).category_id);
        Icon = cat ? getIconComponent(cat.icon) : DollarSign;
        color = cat?.color || 'bg-primary/10';
        title = cat?.name || 'Expense';
        subtitle = item.note || (cat?.type === 'income' ? 'Income' : 'Expense');
    }

    return (
        <div style={style} className="px-1 pb-2">
            <div 
                onClick={() => onClick(item)}
                className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border cursor-pointer hover:bg-secondary/50 transition-colors h-full"
            >
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", color)}>
                    <Icon className="w-6 h-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <p className="font-semibold truncate pr-2">{title}</p>
                        <span className={cn(
                            "font-bold whitespace-nowrap",
                            isTransfer ? "text-blue-600" : 
                            (item as Expense).category_id && getCategoryById((item as Expense).category_id)?.type === 'income' 
                                ? "text-green-600" 
                                : "text-foreground"
                        )}>
                            {isTransfer ? '' : (getCategoryById((item as Expense).category_id)?.type === 'income' ? '+' : '-')}
                            {formatCurrency(item.amount, currency)}
                        </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1">
                        <p className="text-sm text-muted-foreground truncate max-w-[70%]">
                            {subtitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {format(parseISO(item.date), 'MMM d')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function HistoryPage() {
    // Fetch Data
    const expenses = useLiveQuery(() => db.expenses.filter(e => !e.deleted_at).toArray());
    const transfers = useLiveQuery(() => db.transfers.filter(t => !t.deleted_at).toArray());
    const categories = useLiveQuery(() => db.categories.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());

    const { deleteTransfer } = useTransferMutations();
    
    const currency = getCurrency();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [dateRange, setDateRange] = useState<'all' | 'month' | '3months'>('all');
    
    // Selection state
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

    // Combine and Filter
    const filteredTransactions = useMemo(() => {
        if (!expenses || !transfers) return [];

        let items: Transaction[] = [
            ...expenses.map(e => ({ ...e, type: 'expense' as const })),
            ...transfers.map(t => ({ ...t, type: 'transfer' as const }))
        ];

        // Date range filter
        if (dateRange !== 'all') {
            const now = new Date();
            const start = dateRange === 'month'
                ? startOfMonth(now)
                : subMonths(now, 3);
            const end = endOfMonth(now);

            items = items.filter(item => {
                const date = parseISO(item.date);
                return isWithinInterval(date, { start, end });
            });
        }

        // Category filter
        if (selectedCategory) {
            items = items.filter(item => 
                item.type === 'expense' && item.category_id === selectedCategory
            );
        }

        // Search filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            items = items.filter(item =>
                item.note?.toLowerCase().includes(lowerTerm) ||
                (item.type === 'expense' && item.items?.some(i => i.description.toLowerCase().includes(lowerTerm)))
            );
        }

        // Sort
        if (sortBy === 'amount') {
            items.sort((a, b) => b.amount - a.amount);
        } else {
            items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        return items;
    }, [expenses, transfers, searchTerm, selectedCategory, sortBy, dateRange]);

    const getCategoryById = (id: string) => categories?.find(c => c.id === id);
    const getAccountById = (id: string) => accounts?.find(a => a.id === id);

    const handleTransactionClick = (transaction: Transaction) => {
        if (transaction.type === 'expense') {
            setSelectedExpense(transaction);
        } else {
            setSelectedTransfer(transaction);
        }
    };

    if (!expenses || !categories || !transfers || !accounts) {
        return <div className="p-6 flex justify-center items-center h-full">Loading...</div>;
    }

    return (
        <div className="p-6 space-y-6 h-[calc(100vh-80px)] md:h-screen flex flex-col">
            <div className="shrink-0 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">History</h1>
                    <p className="text-muted-foreground">
                        {filteredTransactions.length} transactions
                    </p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search notes, amounts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as any)}
                        className="px-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">All Time</option>
                        <option value="month">This Month</option>
                        <option value="3months">Last 3 Months</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="date">Sort by Date</option>
                        <option value="amount">Sort by Amount</option>
                    </select>

                    {categories.filter(c => c.type === 'expense').map(cat => {
                        const Icon = getIconComponent(cat.icon);
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                                className={cn(
                                    "px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors flex items-center gap-2 border",
                                    selectedCategory === cat.id
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-card border-border hover:bg-secondary"
                                )}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-transparent rounded-2xl">
                {filteredTransactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Filter className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>No transactions found</p>
                    </div>
                ) : (
                    <AutoSizer
                        renderProp={({ height, width }) => {
                            if (!height || !width) return null;
                            return (
                                <List<RowProps>
                                    style={{ width, height }}
                                    rowCount={filteredTransactions.length}
                                    rowHeight={88}
                                    rowComponent={Row}
                                    rowProps={{
                                        transactions: filteredTransactions,
                                        categories,
                                        accounts,
                                        currency,
                                        onClick: handleTransactionClick
                                    }}
                                    className="no-scrollbar"
                                />
                            );
                        }}
                    />
                )}
            </div>

            <AnimatePresence>
                {selectedExpense && (
                    <ExpenseDetailsModal 
                        expense={selectedExpense} 
                        onClose={() => setSelectedExpense(null)} 
                        getCategoryById={getCategoryById}
                    />
                )}
                {selectedTransfer && (
                    <TransferDetailsModal
                        transfer={selectedTransfer}
                        fromAccount={getAccountById(selectedTransfer.from_account_id)}
                        toAccount={getAccountById(selectedTransfer.to_account_id)}
                        onClose={() => setSelectedTransfer(null)}
                        onDelete={deleteTransfer}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
