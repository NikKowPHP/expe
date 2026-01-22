<reasoning>
I will implement Phase 4: Polish & Performance.

1.  **Refactor & Test Critical Logic**:
    *   Extract the account balance calculation logic (which now involves expenses, income, and transfers) into a pure function `calculateAccountBalance` in `lib/utils/finance.ts`.
    *   Create a unit test file `lib/utils/finance.test.ts` to verify this logic handles all cases correctly.
    *   Add `vitest` to run the tests.

2.  **Global Search**:
    *   Create a `GlobalSearch` component (`components/features/search/GlobalSearch.tsx`) that acts as a command palette (triggered by Cmd+K or a button).
    *   It will query Dexie for expenses matching the search term (note, amount, or receipt items).
    *   Integrate this component into the `DashboardLayout`.

3.  **Optimization (Virtualization)**:
    *   Install `react-window` and `react-virtualized-auto-sizer` to handle long lists efficiently.
    *   Refactor `app/(dashboard)/history/page.tsx` to use `VariableSizeList` for rendering the expense list. This ensures the app remains performant even with thousands of transactions.

4.  **Update Task List**: Mark Phase 4 tasks as complete.
</reasoning>

<commands>
<![CDATA[
npm install -D vitest
npm install react-window react-virtualized-auto-sizer @types/react-window @types/react-virtualized-auto-sizer
]]>
</commands>

<modifications>
    <file path="package.json">
        <![CDATA[
{
  "name": "expense",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack",
    "start": "next start",
    "ts-check": "npx tsc --noEmit --skipLibCheck",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@ducanh2912/next-pwa": "^10.2.9",
    "@radix-ui/react-slot": "^1.2.4",
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.91.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "dexie": "^4.2.1",
    "dexie-react-hooks": "^4.2.0",
    "framer-motion": "^12.27.5",
    "lucide-react": "^0.562.0",
    "next": "16.1.4",
    "next-themes": "^0.4.6",
    "papaparse": "^5.5.3",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-virtualized-auto-sizer": "^1.0.25",
    "react-window": "^1.8.11",
    "recharts": "^3.6.0",
    "tailwind-merge": "^3.4.0",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^25",
    "@types/papaparse": "^5.5.2",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/react-window": "^1.8.8",
    "@types/react-virtualized-auto-sizer": "^1.0.4",
    "@types/uuid": "^11.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.1.4",
    "tailwindcss": "^4",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5",
    "vitest": "^3.0.0"
  }
}
        ]]>
    </file>

    <file path="lib/utils/finance.ts">
        <![CDATA[
import { Account, Expense, Transfer, Category } from '@/lib/db/db';

/**
 * Calculates the current balance of an account based on initial balance,
 * expenses (income/expense), and transfers.
 */
export function calculateAccountBalance(
    account: Account,
    expenses: Expense[],
    transfersIn: Transfer[],
    transfersOut: Transfer[],
    categories: Category[]
): number {
    let balance = account.balance;

    // Process Expenses & Income
    for (const expense of expenses) {
        // Skip if deleted
        if (expense.deleted_at) continue;
        
        // Skip if not for this account
        if (expense.account_id !== account.id) continue;

        const category = categories.find(c => c.id === expense.category_id);
        
        // If category is income (or implicit income type), add amount
        // Note: Database schema might just rely on category type. 
        // We assume 'income' type adds, 'expense' type subtracts.
        if (category?.type === 'income') {
            balance += expense.amount;
        } else {
            // Default to expense
            balance -= expense.amount;
        }
    }

    // Process Transfers OUT (Subtract)
    for (const t of transfersOut) {
        if (t.deleted_at) continue;
        if (t.from_account_id === account.id) {
            balance -= t.amount;
        }
    }

    // Process Transfers IN (Add)
    for (const t of transfersIn) {
        if (t.deleted_at) continue;
        if (t.to_account_id === account.id) {
            balance += t.amount;
        }
    }

    return balance;
}
        ]]>
    </file>

    <file path="lib/utils/finance.test.ts">
        <![CDATA[
import { describe, it, expect } from 'vitest';
import { calculateAccountBalance } from './finance';
import { Account, Expense, Transfer, Category } from '@/lib/db/db';

describe('calculateAccountBalance', () => {
    // Mock Data Helpers
    const mockAccount: Account = {
        id: 'acc1',
        user_id: 'u1',
        name: 'Test Bank',
        type: 'bank',
        balance: 1000, // Initial
        currency: 'USD',
        created_at: '',
        updated_at: '',
        sync_status: 'synced'
    };

    const mockCategoryExpense: Category = {
        id: 'cat_exp',
        user_id: 'u1',
        name: 'Food',
        icon: 'food',
        type: 'expense',
        is_default: false,
        sync_status: 'synced'
    };

    const mockCategoryIncome: Category = {
        id: 'cat_inc',
        user_id: 'u1',
        name: 'Salary',
        icon: 'money',
        type: 'income',
        is_default: false,
        sync_status: 'synced'
    };

    it('should return initial balance if no transactions', () => {
        const balance = calculateAccountBalance(mockAccount, [], [], [], [mockCategoryExpense]);
        expect(balance).toBe(1000);
    });

    it('should subtract expenses', () => {
        const expenses: Expense[] = [
            { id: 'e1', user_id: 'u1', account_id: 'acc1', category_id: 'cat_exp', amount: 50, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        const balance = calculateAccountBalance(mockAccount, expenses, [], [], [mockCategoryExpense]);
        expect(balance).toBe(950);
    });

    it('should add income', () => {
        const expenses: Expense[] = [
            { id: 'e2', user_id: 'u1', account_id: 'acc1', category_id: 'cat_inc', amount: 200, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        const balance = calculateAccountBalance(mockAccount, expenses, [], [], [mockCategoryIncome]);
        expect(balance).toBe(1200);
    });

    it('should ignore deleted expenses', () => {
        const expenses: Expense[] = [
            { id: 'e3', user_id: 'u1', account_id: 'acc1', category_id: 'cat_exp', amount: 100, date: '', created_at: '', updated_at: '', sync_status: 'synced', deleted_at: '2023-01-01' }
        ];
        const balance = calculateAccountBalance(mockAccount, expenses, [], [], [mockCategoryExpense]);
        expect(balance).toBe(1000);
    });

    it('should handle transfers out', () => {
        const transfersOut: Transfer[] = [
            { id: 't1', user_id: 'u1', from_account_id: 'acc1', to_account_id: 'acc2', amount: 300, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        const balance = calculateAccountBalance(mockAccount, [], [], transfersOut, []);
        expect(balance).toBe(700);
    });

    it('should handle transfers in', () => {
        const transfersIn: Transfer[] = [
            { id: 't2', user_id: 'u1', from_account_id: 'acc2', to_account_id: 'acc1', amount: 150, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        const balance = calculateAccountBalance(mockAccount, [], transfersIn, [], []);
        expect(balance).toBe(1150);
    });

    it('should calculate mixed transactions correctly', () => {
        // Initial: 1000
        // - 50 Expense
        // + 200 Income
        // - 300 Transfer Out
        // + 150 Transfer In
        // Total should be: 1000 - 50 + 200 - 300 + 150 = 1000
        
        const expenses: Expense[] = [
            { id: 'e1', user_id: 'u1', account_id: 'acc1', category_id: 'cat_exp', amount: 50, date: '', created_at: '', updated_at: '', sync_status: 'synced' },
            { id: 'e2', user_id: 'u1', account_id: 'acc1', category_id: 'cat_inc', amount: 200, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];
        
        const transfersOut: Transfer[] = [
            { id: 't1', user_id: 'u1', from_account_id: 'acc1', to_account_id: 'acc2', amount: 300, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];

        const transfersIn: Transfer[] = [
            { id: 't2', user_id: 'u1', from_account_id: 'acc2', to_account_id: 'acc1', amount: 150, date: '', created_at: '', updated_at: '', sync_status: 'synced' }
        ];

        const balance = calculateAccountBalance(mockAccount, expenses, transfersIn, transfersOut, [mockCategoryExpense, mockCategoryIncome]);
        expect(balance).toBe(1000);
    });
});
        ]]>
    </file>

    <file path="components/features/accounts/AccountCard.tsx">
        <![CDATA[
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
        ]]>
    </file>

    <file path="components/features/search/GlobalSearch.tsx">
        <![CDATA[
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Calendar, DollarSign } from 'lucide-react';
import { db, Expense } from '@/lib/db/db';
import { format } from 'date-fns';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';
import { ExpenseDetailsModal } from '@/components/features/expenses/ExpenseDetailsModal';
import { getIconComponent } from '@/lib/utils/icons';

export function GlobalSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Expense[]>([]);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const currency = getCurrency();

    useEffect(() => {
        // Load categories for displaying icons/names
        db.categories.toArray().then(setCategories);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const search = async () => {
            const lowerQuery = query.toLowerCase();
            // Perform search across expenses
            // Note: Dexie `filter` is full scan, but acceptable for client-side valid datasets (thousands)
            // For large datasets, a dedicated search index (e.g. FlexSearch) would be better, but this suffices for "Polish".
            const matches = await db.expenses
                .filter(e => !e.deleted_at && (
                    (e.note && e.note.toLowerCase().includes(lowerQuery)) ||
                    (e.amount.toString().includes(lowerQuery)) ||
                    (e.items && e.items.some(i => i.description.toLowerCase().includes(lowerQuery)))
                ))
                .limit(20)
                .toArray();
            
            setResults(matches);
        };

        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const getCategory = (id: string) => categories.find(c => c.id === id);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm p-4 flex items-start justify-center pt-20"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[70vh]"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-border flex items-center gap-3">
                        <Search className="w-5 h-5 text-muted-foreground" />
                        <input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search expenses, amounts, or items..."
                            className="flex-1 bg-transparent outline-none text-lg placeholder:text-muted-foreground"
                        />
                        <button onClick={onClose} className="p-1 hover:bg-secondary rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="overflow-y-auto p-2">
                        {results.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                {query ? 'No results found.' : 'Type to search...'}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {results.map(expense => {
                                    const cat = getCategory(expense.category_id);
                                    const Icon = cat ? getIconComponent(cat.icon) : DollarSign;
                                    
                                    return (
                                        <button
                                            key={expense.id}
                                            onClick={() => setSelectedExpense(expense)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                                        >
                                            <div className={`p-2 rounded-lg ${cat?.color || 'bg-primary/10'}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{expense.note || cat?.name || 'Expense'}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {format(new Date(expense.date), 'MMM d, yyyy')}
                                                    </span>
                                                    {expense.items && expense.items.length > 0 && (
                                                        <span>• {expense.items.length} items</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="font-bold">
                                                {formatCurrency(expense.amount, currency)}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>

            {selectedExpense && (
                <ExpenseDetailsModal
                    expense={selectedExpense}
                    onClose={() => setSelectedExpense(null)}
                    getCategoryById={(id) => categories.find(c => c.id === id)}
                />
            )}
        </AnimatePresence>
    );
}
        ]]>
    </file>

    <file path="app/(dashboard)/layout.tsx">
        <![CDATA[
'use client';

import { useState, useEffect } from 'react';
import { BottomNav } from '@/components/features/layout/BottomNav';
import { SideNav } from '@/components/features/layout/SideNav';
import { ManualSyncButton } from '@/components/features/sync/ManualSyncButton';
import AuthGuard from '@/components/auth/AuthGuard';
import { GlobalSearch } from '@/components/features/search/GlobalSearch';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                {/* Desktop Side Nav */}
                <SideNav />

                <div className="flex-1 flex flex-col md:pl-64 transition-all duration-300 min-w-0">
                    {/* Header Bar */}
                    <div className="fixed top-0 right-0 left-0 md:left-64 z-40 p-4 flex justify-end gap-2 pointer-events-none">
                        <div className="pointer-events-auto flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 gap-2 bg-background/80 backdrop-blur-md hidden sm:flex"
                                onClick={() => setIsSearchOpen(true)}
                            >
                                <Search className="w-3.5 h-3.5" />
                                <span className="text-muted-foreground">Search...</span>
                                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                    <span className="text-xs">⌘</span>K
                                </kbd>
                            </Button>
                            
                            {/* Mobile Search Icon */}
                            <Button 
                                variant="secondary" 
                                size="icon" 
                                className="h-8 w-8 rounded-full sm:hidden pointer-events-auto shadow-md"
                                onClick={() => setIsSearchOpen(true)}
                            >
                                <Search className="w-4 h-4" />
                            </Button>

                            <ManualSyncButton />
                        </div>
                    </div>

                    <main className="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0 pt-16 md:pt-0">
                        {/* Wrapper to constrain width on ultra-wide screens */}
                        <div className="max-w-7xl mx-auto w-full">
                            {children}
                        </div>
                    </main>

                    {/* Mobile Bottom Nav */}
                    <div className="md:hidden">
                        <BottomNav />
                    </div>
                </div>
            </div>
            
            <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </AuthGuard>
    );
}
        ]]>
    </file>

    <file path="app/(dashboard)/history/page.tsx">
        <![CDATA[
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Expense } from '@/lib/db/db';
import { useExpenseMutations } from '@/lib/hooks/use-expense-mutations';
import { getIconComponent } from '@/lib/utils/icons';
import { Search, X, Trash2, Calendar, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';
import { ExpenseDetailsModal } from '@/components/features/expenses/ExpenseDetailsModal';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

export default function HistoryPage() {
    const expenses = useLiveQuery(() => db.expenses.orderBy('date').filter(e => !e.deleted_at).reverse().toArray());
    const categories = useLiveQuery(() => db.categories.toArray());
    const { deleteExpense } = useExpenseMutations();
    const currency = getCurrency();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [dateRange, setDateRange] = useState<'all' | 'month' | '3months'>('all');
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

    // Filter and sort expenses
    const filteredExpenses = useMemo(() => {
        if (!expenses) return [];

        let filtered = [...expenses];

        // Date range filter
        if (dateRange !== 'all') {
            const now = new Date();
            const start = dateRange === 'month'
                ? startOfMonth(now)
                : subMonths(now, 3);
            const end = endOfMonth(now);

            filtered = filtered.filter(expense => {
                const expenseDate = parseISO(expense.date);
                return isWithinInterval(expenseDate, { start, end });
            });
        }

        // Category filter
        if (selectedCategory) {
            filtered = filtered.filter(e => e.category_id === selectedCategory);
        }

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(e =>
                e.note?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort
        if (sortBy === 'amount') {
            filtered.sort((a, b) => b.amount - a.amount);
        } else {
            filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        return filtered;
    }, [expenses, searchTerm, selectedCategory, sortBy, dateRange]);

    const getCategoryById = (id: string) => {
        return categories?.find(c => c.id === id);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this expense?')) {
            await deleteExpense(id);
        }
    };

    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Row component for react-window
    const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
        const expense = filteredExpenses[index];
        const category = getCategoryById(expense.category_id);
        const CategoryIcon = category ? getIconComponent(category.icon) : DollarSign;

        return (
            <div style={style} className="px-1 pb-2">
                <div className="relative overflow-hidden rounded-2xl h-full">
                    {/* Delete action background (simplified for virtual list - drag is tricky, so simplified to click for now or we rely on modal) */}
                    <div 
                        onClick={() => setSelectedExpense(expense)}
                        className="relative flex items-center gap-4 p-4 bg-card rounded-2xl border border-border z-10 cursor-pointer hover:bg-secondary/50 transition-colors h-full"
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${category?.color || 'bg-primary/10'}`}>
                            <CategoryIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold">{category?.name || 'Unknown'}</p>
                            {expense.note && (
                                <p className="text-sm text-muted-foreground truncate">{expense.note}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {format(parseISO(expense.date), 'MMM d, yyyy')}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">{formatCurrency(expense.amount, currency)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!expenses || !categories) {
        return <div className="p-6">Loading...</div>;
    }

    return (
        <div className="p-6 space-y-6 h-[calc(100vh-80px)] md:h-screen flex flex-col">
            {/* Header - Fixed height */}
            <div className="shrink-0 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">History</h1>
                    <p className="text-muted-foreground">
                        {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''} · {formatCurrency(totalAmount, currency)} total
                    </p>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search expenses..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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

                    {categories.filter(c => c.type === 'expense').map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                            className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${selectedCategory === cat.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-card border border-border'
                                }`}
                        >
                            {cat.icon} {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Expense List - Flexible height */}
            <div className="flex-1 min-h-0 bg-transparent rounded-2xl">
                {filteredExpenses.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>No expenses found</p>
                    </div>
                ) : (
                    <AutoSizer>
                        {({ height, width }) => (
                            <List
                                height={height}
                                itemCount={filteredExpenses.length}
                                itemSize={() => 90} // Fixed height estimate for row
                                width={width}
                                className="no-scrollbar"
                            >
                                {Row}
                            </List>
                        )}
                    </AutoSizer>
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
            </AnimatePresence>
        </div>
    );
}
        ]]>
    </file>

    <file path="TASKS.md">
        <![CDATA[
- [x] Fix AI receipt scanning to handle discounts (OPUST/RABAT) by merging them into the item price instead of creating separate items.
- [x] Create test user (dev@dev.dev / a) and seed initial data.
- [x] Fix Recurring Expenses deletion issue (ensure soft-deleted items are filtered out in UI).
- [x] Make Main Index Page Desktop Friendly (SideNav + Grid Layout).
- [x] Implement Account Transfers (DB, Sync, UI, Balances).
- [x] Refine Analytics (Split Income/Expense, Savings Rate).
- [x] Implement Subcategory Management (Settings UI + Manual Selection in Add Expense).
- [x] Implement Global Search (Command Palette).
- [x] Optimize History Page (Virtualization).
- [x] Add Unit Tests for Financial Logic.
        ]]>
    </file>
</modifications>