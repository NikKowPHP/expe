<reasoning>
The goal is to make the main index page (dashboard) desktop-friendly.
The current layout is mobile-optimized with a fixed bottom navigation bar and a single-column layout.

Plan:
1.  **Create `SideNav` component**: A vertical navigation sidebar for desktop screens.
2.  **Update `DashboardLayout`**:
    *   Integrate `SideNav` which is visible only on desktop (`md` breakpoint and up).
    *   Hide `BottomNav` on desktop.
    *   Adjust main content padding and margin to accommodate the sidebar.
3.  **Update `DashboardView`**:
    *   Use a responsive grid layout (`md:grid`) to split content into columns on larger screens.
    *   Net Worth and Accounts on the left/main area.
    *   Recent Activity on the right sidebar area.
    *   Adjust `AccountCard` grid to be 2 columns on tablet/desktop.

</reasoning>

<modifications>
    <file path="components/features/layout/SideNav.tsx">
      <![CDATA[
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PieChart, Plus, History, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function SideNav() {
    const pathname = usePathname();

    const links = [
        { href: '/', icon: Home, label: 'Home' },
        { href: '/analytics', icon: PieChart, label: 'Analytics' },
        { href: '/history', icon: History, label: 'History' },
        { href: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="hidden md:flex flex-col w-64 h-screen border-r border-border bg-card p-4 fixed left-0 top-0 z-40">
            <div className="flex items-center gap-2 px-2 mb-8 mt-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                    <Sparkles className="w-5 h-5" />
                </div>
                <span className="font-bold text-xl">Expense</span>
            </div>

            <div className="space-y-1 flex-1">
                <Link href="/add" className="block mb-6">
                    <Button className="w-full justify-start gap-2 shadow-md" size="lg">
                        <Plus className="w-5 h-5" />
                        Add Expense
                    </Button>
                </Link>

                <div className="space-y-1">
                    {links.map((link) => {
                        const isActive = pathname === link.href;
                        const Icon = link.icon;

                        return (
                            <Link key={link.href} href={link.href} className="block">
                                <Button
                                    variant={isActive ? "secondary" : "ghost"}
                                    className={cn(
                                        "w-full justify-start gap-3 mb-1 h-11",
                                        isActive && "bg-secondary font-medium text-primary"
                                    )}
                                >
                                    <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                                    {link.label}
                                </Button>
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="px-2 py-4 text-xs text-muted-foreground text-center border-t border-border mt-auto">
                <p>Expense Tracker v1.0</p>
            </div>
        </div>
    );
}
      ]]>
    </file>

    <file path="app/(dashboard)/layout.tsx">
      <![CDATA[
'use client';

import { BottomNav } from '@/components/features/layout/BottomNav';
import { SideNav } from '@/components/features/layout/SideNav';
import { ManualSyncButton } from '@/components/features/sync/ManualSyncButton';
import AuthGuard from '@/components/auth/AuthGuard';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                {/* Desktop Side Nav */}
                <SideNav />

                <div className="flex-1 flex flex-col md:pl-64 transition-all duration-300 min-w-0">
                    {/* Sync Status Indicator */}
                    <div className="fixed top-4 right-4 z-50">
                        <ManualSyncButton />
                    </div>

                    <main className="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0">
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
        </AuthGuard>
    );
}
      ]]>
    </file>

    <file path="components/features/dashboard/DashboardView.tsx">
      <![CDATA[
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Expense } from '@/lib/db/db';
import { getIconComponent } from '@/lib/utils/icons';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useBudgets } from '@/lib/hooks/use-budgets';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { formatCurrency, getCurrency } from '@/lib/utils/currency';

import { AccountCard } from '@/components/features/accounts/AccountCard';
import { ExpenseDetailsModal } from '@/components/features/expenses/ExpenseDetailsModal';

export function DashboardView() {
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const expenses = useLiveQuery(
        () => db.expenses.orderBy('date').filter(e => !e.deleted_at).reverse().limit(10).toArray()
    );
    
    const categories = useLiveQuery(() => db.categories.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());

    const totalBalance = useLiveQuery(async () => {
        const allAccounts = await db.accounts.toArray();
        const allExpenses = await db.expenses.filter(e => !e.deleted_at).toArray();
        const allCategories = await db.categories.toArray();

        if (!allAccounts || !allExpenses || !allCategories) return 0;

        let balance = 0;
        
        // Initial balances
        balance += allAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

        // Transactions
        for (const expense of allExpenses) {
            const category = allCategories.find(c => c.id === expense.category_id);
            if (category?.type === 'income') {
                balance += expense.amount;
            } else {
                balance -= expense.amount;
            }
        }
        
        return balance;
    });
    
    const getCategoryById = (id: string) => {
        return categories?.find(c => c.id === id);
    };

    const currency = getCurrency();

    return (
        <div className="p-6 space-y-8 md:space-y-0 md:grid md:grid-cols-12 md:gap-8">
            {/* Left Column (Main Info) */}
            <div className="md:col-span-7 lg:col-span-8 space-y-8">
                {/* Header / Net Worth */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-primary text-primary-foreground rounded-3xl p-6 shadow-xl relative overflow-hidden"
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium opacity-80">Net Worth</span>
                            <Wallet className="w-5 h-5 opacity-80" />
                        </div>
                        <h1 className="text-4xl font-bold">
                            {formatCurrency(totalBalance || 0, currency)}
                        </h1>
                        <div className="mt-4 flex space-x-4">
                            <div className="flex items-center text-sm bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                                <ArrowUpRight className="w-4 h-4 mr-1 text-green-300" />
                                <span>Income</span>
                            </div>
                            <div className="flex items-center text-sm bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                                <ArrowDownLeft className="w-4 h-4 mr-1 text-red-300" />
                                <span>Expense</span>
                            </div>
                        </div>
                    </div>
                    {/* Decorative bg elements */}
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/10 to-transparent" />
                </motion.div>

                {/* Accounts */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Accounts</h2>
                        <Link href="/settings" className="text-sm text-primary hover:underline">
                            Manage
                        </Link>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {accounts?.map(account => (
                            <AccountCard key={account.id} account={account} />
                        ))}
                    </div>
                </div>

                {/* Budget Progress (Left column on desktop) */}
                <BudgetProgressSection />
            </div>

            {/* Right Column (Feed/Activity) */}
            <div className="md:col-span-5 lg:col-span-4 space-y-8">
                {/* Recent Transactions */}
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                        <span>Recent Activity</span>
                        <Link href="/history" className="text-sm font-normal text-primary hover:underline md:hidden">
                            View All
                        </Link>
                    </h2>
                    <div className="space-y-3">
                        {expenses?.map((expense) => {
                            const category = getCategoryById(expense.category_id);
                            const CategoryIcon = category ? getIconComponent(category.icon) : DollarSign;
                            
                            return (
                                <motion.div
                                    key={expense.id}
                                    layoutId={expense.id}
                                    onClick={() => setSelectedExpense(expense)}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center justify-between p-4 bg-card rounded-2xl shadow-sm border border-border cursor-pointer hover:bg-secondary/50 transition-colors group"
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${category?.color || 'bg-primary/10'}`}>
                                            <CategoryIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium line-clamp-1">{category?.name || expense.note || 'Expense'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(expense.date), 'MMM d, h:mm a')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="font-bold whitespace-nowrap">-{formatCurrency(expense.amount, currency)}</span>
                                </motion.div>
                            );
                        })}

                        {expenses?.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                No expenses yet. Tap + to add one!
                            </div>
                        )}
                        
                        {/* Desktop View All Link */}
                        <div className="hidden md:block pt-2 text-center">
                            <Link href="/history">
                                <Button variant="outline" className="w-full">
                                    View Full History
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
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

function BudgetProgressSection() {
    const { budgetStatuses } = useBudgets();
    const currency = getCurrency();
    
    // Show top 3 budgets only
    const topBudgets = budgetStatuses.slice(0, 3);
    
    if (topBudgets.length === 0) return null;
    
    const getProgressColor = (percentUsed: number) => {
        if (percentUsed >= 100) return 'bg-red-500';
        if (percentUsed >= 90) return 'bg-red-400';
        if (percentUsed >= 75) return 'bg-yellow-500';
        return 'bg-green-500';
    };
    
    const getTextColor = (percentUsed: number) => {
        if (percentUsed >= 100) return 'text-red-600';
        if (percentUsed >= 90) return 'text-red-500';
        if (percentUsed >= 75) return 'text-yellow-600';
        return 'text-green-600';
    };
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
        >
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Budget Progress
                </h2>
                <Link href="/settings" className="text-sm text-primary hover:underline">
                    View All
                </Link>
            </div>
            
            <div className="space-y-3">
                {topBudgets.map((budget) => (
                    <div key={budget.budgetId} className="p-4 bg-card rounded-2xl border border-border">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-sm">{budget.categoryName}</span>
                            <span className={cn('text-xs font-bold', getTextColor(budget.percentUsed))}>
                                {budget.percentUsed.toFixed(0)}%
                            </span>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{formatCurrency(budget.spent, currency)} spent</span>
                                <span>{formatCurrency(budget.budgetAmount, currency)} budget</span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className={cn('h-full transition-all', getProgressColor(budget.percentUsed))}
                                    style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                                />
                            </div>
                            {budget.remaining < 0 && (
                                <p className="text-xs font-medium text-red-600">
                                    Over by {formatCurrency(Math.abs(budget.remaining), currency)}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
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
      ]]>
    </file>
</modifications>