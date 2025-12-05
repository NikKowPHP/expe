'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { Moon, Sun, Database, Download, Trash, Info, DollarSign, Bell, LogOut, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CategoryManager } from '@/components/features/categories/CategoryManager';
import { BudgetManager } from '@/components/features/budgets/BudgetManager';
import { RecurringExpensesList } from '@/components/features/expenses/RecurringExpensesList';
import { AccountManager } from '@/components/features/accounts/AccountManager';
import { CsvImport } from '@/components/features/settings/CsvImport';
import { RefreshCw, Wallet, Cloud } from 'lucide-react';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const [currency, setCurrency] = useState('USD');
    const [notifications, setNotifications] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();
    const { isOnline, isSyncing, syncExpenses } = useOfflineSync();

    const expenses = useLiveQuery(() => db.expenses.filter(e => !e.deleted_at).toArray());
    const categories = useLiveQuery(() => db.categories.toArray());

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || null);
            }
        };
        getUser();

        // Load currency preference from localStorage
        const savedCurrency = localStorage.getItem('currency');
        if (savedCurrency) {
            setCurrency(savedCurrency);
        }
    }, []);

    const handleLogout = async () => {
        if (confirm('Are you sure you want to log out?')) {
            await supabase.auth.signOut();
            router.push('/login');
        }
    };

    const handleExportData = async () => {
        if (!expenses || !categories) return;

        const data = {
            expenses,
            categories,
            exportedAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expense-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClearData = async () => {
        if (confirm('Are you sure you want to delete ALL expenses? This cannot be undone.')) {
            if (confirm('This will permanently delete all your expense data. Are you absolutely sure?')) {
                await db.expenses.clear();
            }
        }
    };

    const handleClearCategories = async () => {
        if (confirm('Delete all custom categories? Default categories will remain.')) {
            const customCategories = categories?.filter(c => !c.is_default) || [];
            for (const cat of customCategories) {
                await db.categories.delete(cat.id);
            }
        }
    };

    const SettingSection = ({ icon: Icon, title, description, children }: any) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card p-6 rounded-3xl border border-border space-y-4"
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h2 className="font-semibold text-lg">{title}</h2>
                    {description && <p className="text-sm text-muted-foreground">{description}</p>}
                </div>
            </div>
            {children}
        </motion.div>
    );

    return (
        <div className="p-6 space-y-6 pb-24">
            <div>
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-muted-foreground">Manage your app preferences</p>
            </div>

            {/* Account */}
            <SettingSection
                icon={User}
                title="Account"
                description="Manage your account"
            >
                <div className="space-y-3">
                    {userEmail && (
                        <div className="p-4 bg-background rounded-xl">
                            <p className="text-sm text-muted-foreground">Signed in as</p>
                            <p className="font-medium">{userEmail}</p>
                        </div>
                    )}
                    <Button
                        onClick={handleLogout}
                        variant="outline"
                        className="w-full"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Log Out
                    </Button>
                </div>
            </SettingSection>

            </SettingSection>

            {/* Cloud Sync */}
            <SettingSection
                icon={Cloud}
                title="Cloud Sync"
                description="Manage data synchronization"
            >
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                        <div>
                            <p className="font-medium">Sync Status</p>
                            <p className="text-sm text-muted-foreground">
                                {isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}
                            </p>
                        </div>
                        <Button
                            onClick={() => syncExpenses()}
                            disabled={isSyncing || !isOnline}
                            variant="outline"
                            size="sm"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                    </div>
                </div>
            </SettingSection>

            {/* Appearance */}
            <SettingSection
                icon={theme === 'dark' ? Moon : Sun}
                title="Appearance"
                description="Customize how the app looks"
            >
                <div className="space-y-3">
                    <label className="flex items-center justify-between">
                        <span>Theme</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTheme('light')}
                                className={`px-4 py-2 rounded-xl transition-colors ${theme === 'light'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                    }`}
                            >
                                <Sun className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`px-4 py-2 rounded-xl transition-colors ${theme === 'dark'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                    }`}
                            >
                                <Moon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`px-4 py-2 rounded-xl transition-colors ${theme === 'system'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                    }`}
                            >
                                Auto
                            </button>
                        </div>
                    </label>
                </div>
            </SettingSection>

            {/* Currency */}
            <SettingSection
                icon={DollarSign}
                title="Currency"
                description="Set your preferred currency"
            >
                <select
                    value={currency}
                    onChange={(e) => {
                        const newCurrency = e.target.value;
                        setCurrency(newCurrency);
                        localStorage.setItem('currency', newCurrency);
                    }}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="USD">🇺🇸 USD - US Dollar</option>
                    <option value="PLN">🇵🇱 PLN - Polish Złoty</option>
                    <option value="EUR">🇪🇺 EUR - Euro</option>
                    <option value="GBP">🇬🇧 GBP - British Pound</option>
                    <option value="JPY">🇯🇵 JPY - Japanese Yen</option>
                    <option value="CAD">🇨🇦 CAD - Canadian Dollar</option>
                    <option value="AUD">🇦🇺 AUD - Australian Dollar</option>
                </select>
            </SettingSection>

            {/* Notifications */}
            <SettingSection
                icon={Bell}
                title="Notifications"
                description="Manage notification preferences"
            >
                <label className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Enable Notifications</p>
                        <p className="text-sm text-muted-foreground">Get reminders and updates</p>
                    </div>
                    <button
                        onClick={() => setNotifications(!notifications)}
                        className={`relative w-14 h-8 rounded-full transition-colors ${notifications ? 'bg-primary' : 'bg-muted'
                            }`}
                    >
                        <motion.div
                            animate={{ x: notifications ? 24 : 2 }}
                            className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                        />
                    </button>
                </label>
            </SettingSection>

            {/* Data Management */}
            <SettingSection
                icon={Database}
                title="Data Management"
                description="Export or clear your data"
            >
                <div className="space-y-3">
                    {/* CSV Import */}
                    <div className="pb-3 border-b border-border">
                        <p className="text-sm font-medium mb-2">Import Data (CSV)</p>
                        <CsvImport />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                        <div>
                            <p className="font-medium">Total Expenses</p>
                            <p className="text-sm text-muted-foreground">{expenses?.length || 0} entries</p>
                        </div>
                        <Button onClick={handleExportData} variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                        <div>
                            <p className="font-medium">Categories</p>
                            <p className="text-sm text-muted-foreground">{categories?.length || 0} total</p>
                        </div>
                        <Button onClick={handleClearCategories} variant="outline" size="sm">
                            <Trash className="w-4 h-4 mr-2" />
                            Clear Custom
                        </Button>
                    </div>

                    <div className="border-t border-border pt-3">
                        <Button
                            onClick={handleClearData}
                            variant="destructive"
                            className="w-full"
                        >
                            <Trash className="w-4 h-4 mr-2" />
                            Delete All Expenses
                        </Button>
                    </div>
                </div>
            </SettingSection>

            {/* Category Management */}
            <SettingSection
                icon={Database}
                title="Categories"
                description="Manage your expense categories"
            >
                <CategoryManager />
            </SettingSection>

            {/* Account Management */}
            <SettingSection
                icon={Wallet}
                title="Accounts & Wallets"
                description="Manage your cash, bank accounts, and credit cards"
            >
                <AccountManager />
            </SettingSection>

            {/* Budget Management */}
            <SettingSection
                icon={DollarSign}
                title="Budgets"
                description="Set monthly spending limits for categories"
            >
                <BudgetManager />
            </SettingSection>

            {/* Recurring Expenses */}
            <SettingSection
                icon={RefreshCw}
                title="Recurring Expenses"
                description="Manage your subscriptions and recurring costs"
            >
                <RecurringExpensesList />
            </SettingSection>

            {/* About */}
            <SettingSection
                icon={Info}
                title="About"
                description="App information"
            >
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-medium">1.0.0</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Database</span>
                        <span className="font-medium">IndexedDB (Dexie)</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Framework</span>
                        <span className="font-medium">Next.js 15</span>
                    </div>
                </div>
            </SettingSection>
        </div>
    );
}
