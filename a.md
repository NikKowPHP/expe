<reasoning>
I will implement Subcategory Management by creating the necessary hooks, a management UI in Settings, and updating the Add Expense flow.

Plan:
1.  **Hooks**: Create `lib/hooks/use-subcategories.ts` (fetch) and `lib/hooks/use-subcategory-mutations.ts` (CRUD with sync).
2.  **Settings UI**: Create `components/features/categories/SubcategoryManager.tsx` to list and edit subcategories grouped by category. Add this to `app/(dashboard)/settings/page.tsx`.
3.  **Add Expense UI**: Update `components/features/add-expense/StepDetails.tsx` to allow selecting a subcategory if the chosen category has any. Update `AddExpenseWizard` to persist this selection.

</reasoning>

<modifications>
<file path="lib/hooks/use-subcategories.ts">
<![CDATA[
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Subcategory } from '@/lib/db/db';

export function useSubcategories(categoryId?: string) {
    const subcategories = useLiveQuery<Subcategory[]>(
        () => {
            if (categoryId) {
                return db.subcategories.where('category_id').equals(categoryId).toArray();
            }
            return db.subcategories.toArray();
        },
        [categoryId]
    );

    return {
        subcategories: subcategories || [],
        isLoading: subcategories === undefined,
    };
}
]]>
</file>

<file path="lib/hooks/use-subcategory-mutations.ts">
<![CDATA[
'use client';

import { db, Subcategory } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';

export function useSubcategoryMutations() {
  const supabase = createClient();

  const createSubcategory = async (input: {
    name: string;
    category_id: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const newSubcategory: Subcategory = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name: input.name,
      category_id: input.category_id,
      created_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    // Local
    await db.subcategories.add(newSubcategory);

    // Sync
    if (navigator.onLine) {
      try {
        const { error } = await supabase.from('subcategories').insert({
            id: newSubcategory.id,
            user_id: user.id,
            name: newSubcategory.name,
            category_id: newSubcategory.category_id,
            created_at: newSubcategory.created_at
        });
        
        if (!error) {
          await db.subcategories.update(newSubcategory.id, { sync_status: 'synced' });
        }
      } catch (error) {
        console.error('Failed to sync subcategory:', error);
      }
    }

    return newSubcategory;
  };

  const updateSubcategory = async (id: string, updates: Partial<Subcategory>) => {
    await db.subcategories.update(id, {
      ...updates,
      sync_status: 'pending',
    });

    if (navigator.onLine) {
      try {
        const { error } = await supabase.from('subcategories').update(updates).eq('id', id);
        if (!error) {
          await db.subcategories.update(id, { sync_status: 'synced' });
        }
      } catch (error) {
        console.error('Failed to sync subcategory update:', error);
      }
    }
  };

  const deleteSubcategory = async (id: string) => {
    if (navigator.onLine) {
      try {
        await supabase.from('subcategories').delete().eq('id', id);
      } catch (error) {
        console.error('Failed to delete subcategory from server:', error);
      }
    }
    await db.subcategories.delete(id);
  };

  return {
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
  };
}
]]>
</file>

<file path="components/features/categories/SubcategoryManager.tsx">
<![CDATA[
'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { useSubcategoryMutations } from '@/lib/hooks/use-subcategory-mutations';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Check, X, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getIconComponent } from '@/lib/utils/icons';

export function SubcategoryManager() {
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray());
  const subcategories = useLiveQuery(() => db.subcategories.toArray());
  const { createSubcategory, updateSubcategory, deleteSubcategory } = useSubcategoryMutations();

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '' });

  const handleExpand = (categoryId: string) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
      setIsAdding(false);
      setEditingId(null);
    } else {
      setExpandedCategory(categoryId);
      setIsAdding(false);
      setEditingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedCategory) return;

    try {
      if (editingId) {
        await updateSubcategory(editingId, { name: formData.name });
        setEditingId(null);
      } else {
        await createSubcategory({
          name: formData.name,
          category_id: expandedCategory,
        });
        setIsAdding(false);
      }
      setFormData({ name: '' });
    } catch (error) {
      console.error('Failed to save subcategory:', error);
    }
  };

  const startEdit = (subId: string, name: string) => {
    setEditingId(subId);
    setFormData({ name });
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this subcategory?')) {
      await deleteSubcategory(id);
    }
  };

  return (
    <div className="space-y-2">
      {categories?.map((category) => {
        const categorySubs = subcategories?.filter(s => s.category_id === category.id) || [];
        const isExpanded = expandedCategory === category.id;
        const Icon = getIconComponent(category.icon);

        return (
          <div key={category.id} className="border border-border rounded-xl overflow-hidden bg-background">
            <button
              onClick={() => handleExpand(category.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${category.color || 'bg-primary/10'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="font-medium">{category.name}</span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {categorySubs.length}
                </span>
              </div>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0 bg-secondary/20">
                    <div className="space-y-2 mt-2">
                      {categorySubs.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                          {editingId === sub.id ? (
                            <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
                              <input
                                value={formData.name}
                                onChange={(e) => setFormData({ name: e.target.value })}
                                className="flex-1 px-2 py-1 text-sm bg-secondary rounded outline-none"
                                autoFocus
                              />
                              <Button type="submit" size="sm" className="h-7 w-7 p-0">
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </form>
                          ) : (
                            <>
                              <span className="text-sm pl-2">{sub.name}</span>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(sub.id, sub.name)}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(sub.id)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {isAdding ? (
                        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border border-dashed">
                          <input
                            value={formData.name}
                            onChange={(e) => setFormData({ name: e.target.value })}
                            placeholder="New subcategory name"
                            className="flex-1 px-2 py-1 text-sm bg-transparent outline-none"
                            autoFocus
                          />
                          <Button type="submit" size="sm" className="h-7 w-7 p-0">
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsAdding(false)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </form>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setIsAdding(true);
                            setFormData({ name: '' });
                            setEditingId(null);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-2" />
                          Add Subcategory
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
]]>
</file>

<file path="app/(dashboard)/settings/page.tsx">
<![CDATA[
'use client';

import { useState, useEffect, type ReactNode, type ElementType } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { Moon, Sun, Database, Download, Trash, Info, DollarSign, Bell, LogOut, User, RefreshCw, Wallet, Cloud, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CategoryManager } from '@/components/features/categories/CategoryManager';
import { SubcategoryManager } from '@/components/features/categories/SubcategoryManager';
import { BudgetManager } from '@/components/features/budgets/BudgetManager';
import { RecurringExpensesList } from '@/components/features/expenses/RecurringExpensesList';
import { AccountManager } from '@/components/features/accounts/AccountManager';
import { CsvImport } from '@/components/features/settings/CsvImport';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';


interface SettingSectionProps {
    icon: ElementType;
    title: string;
    description?: string;
    children: ReactNode;
}

const SettingSection = ({ icon: Icon, title, description, children }: SettingSectionProps) => (
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
    }, [supabase.auth]);

    useEffect(() => {
        // Load currency preference from localStorage
        const savedCurrency = localStorage.getItem('currency');
        if (savedCurrency) {
            setTimeout(() => setCurrency(savedCurrency), 0);
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

            {/* Subcategory Management */}
            <SettingSection
                icon={Layers}
                title="Subcategories"
                description="Manage specific sub-groups within categories"
            >
                <SubcategoryManager />
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
]]>
</file>

<file path="components/features/add-expense/StepDetails.tsx">
<![CDATA[
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Calendar, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useSubcategories } from '@/lib/hooks/use-subcategories';

interface StepDetailsProps {
    onSubmit: (note: string, date: Date, isRecurring: boolean, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly', subcategoryId?: string) => void;
    onBack: () => void;
    categoryId?: string; // New prop to filter subcategories
}

export function StepDetails({ onSubmit, onBack, categoryId }: StepDetailsProps) {
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date());
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
    const [subcategoryId, setSubcategoryId] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch subcategories for this category
    const { subcategories } = useSubcategories(categoryId);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSubmit(note, date, isRecurring, frequency, subcategoryId || undefined);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full p-6"
        >
            <div className="flex items-center mb-6">
                <Button variant="ghost" onClick={onBack} className="mr-4">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h2 className="text-2xl font-bold">Details</h2>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Note</label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full p-4 text-lg bg-secondary rounded-xl outline-none"
                        placeholder="What was this for?"
                    />
                </div>

                {/* Subcategory Selection (Only if available) */}
                {subcategories.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Subcategory</label>
                        <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <select
                                value={subcategoryId}
                                onChange={(e) => setSubcategoryId(e.target.value)}
                                className="w-full p-4 pl-12 text-lg bg-secondary rounded-xl outline-none appearance-none"
                            >
                                <option value="">None</option>
                                {subcategories.map(sub => (
                                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Date</label>
                    <div className="flex items-center p-4 bg-secondary rounded-xl">
                        <Calendar className="w-6 h-6 mr-3 text-muted-foreground" />
                        <span className="text-lg">{format(date, 'MMMM d, yyyy')}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                            className="w-5 h-5 mr-3 accent-primary"
                        />
                        <span className="text-lg">Recurring Payment</span>
                    </div>
                </div>

                {isRecurring && (
                    <div className="p-4 bg-secondary rounded-xl animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Frequency</label>
                        <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as any)}
                            className="w-full p-2 bg-background rounded-lg outline-none"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="mt-auto mb-8">
                <Button
                    size="lg"
                    className="w-full h-14 text-lg rounded-xl"
                    onClick={() => onSubmit(note, date, isRecurring, frequency, subcategoryId || undefined)}
                >
                    <Check className="w-6 h-6 mr-2" />
                    Save Expense
                </Button>
            </div>
        </motion.div>
    );
}
]]>
</file>

<file path="components/features/add-expense/AddExpenseWizard.tsx">
<![CDATA[
'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { StepAmount } from './StepAmount';
import { StepCategory } from './StepCategory';
import { StepDetails } from './StepDetails';
import { StepReceiptReview } from './StepReceiptReview';
import { db } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';

interface ReceiptItem {
    description: string;
    amount: number;
    category_id: string;
    subcategory_name?: string;
    new_category_name?: string;
}

export function AddExpenseWizard() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState('');
    const [transactionType, setTransactionType] = useState<'expense' | 'income' | 'transfer'>('expense');
    const [accountId, setAccountId] = useState<string>(''); 
    const [toAccountId, setToAccountId] = useState<string>(''); // For transfers
    const [categoryId, setCategoryId] = useState('');
    const [userId, setUserId] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [tempCategories, setTempCategories] = useState<{ id: string; name: string }[]>([]);

    const [scannedData, setScannedData] = useState<{
        items: ReceiptItem[];
        merchant: string;
        date: string;
        image: string;
    } | null>(null);
    const supabase = createClient();
    const categories = useLiveQuery(() => db.categories.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());

    useEffect(() => {
        // Get authenticated user
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                // Fetch default account (Cash)
                const defaultAccount = await db.accounts.where({ user_id: user.id, name: 'Cash' }).first();
                if (defaultAccount) {
                    setAccountId(defaultAccount.id);
                }
            } else {
                setUserId('anonymous');
            }
        };
        getUser();
    }, [supabase]);

    const handleAmountSubmit = (value: string, type: 'expense' | 'income' | 'transfer', accId: string, toAccId?: string) => {
        setAmount(value);
        setTransactionType(type);
        setAccountId(accId);
        if (toAccId) setToAccountId(toAccId);

        // If transfer, skip category selection
        if (type === 'transfer') {
            setStep(3); // Go directly to details (for note/date)
        } else {
            setStep(2); // Go to category
        }
    };

    const handleCategorySubmit = (id: string) => {
        setCategoryId(id);
        setStep(3);
    };

    const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>, selectedAccountId?: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (selectedAccountId) {
            setAccountId(selectedAccountId);
        }

        console.log('Scanning receipt...');

        if (!categories || categories.length === 0) {
            setScanError('Please create at least one category before scanning receipts.');
            return;
        }

        setIsScanning(true);
        setScanError(null);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            try {
                const allSubcategories = await db.subcategories.toArray();
                const res = await fetch('/api/ai/scan-receipt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64, categories, subcategories: allSubcategories }),
                });

                if (!res.ok) throw new Error('Failed to scan receipt');

                const data = await res.json();
                
                if (data.items && Array.isArray(data.items)) {
                    const newTempCategories: { id: string; name: string }[] = [];
                    const processedItems = data.items.map((item: ReceiptItem & { new_category_name?: string }) => {
                        if (item.new_category_name && !item.category_id) {
                            let tempCat = newTempCategories.find(c => c.name === item.new_category_name);
                            if (!tempCat) {
                                tempCat = {
                                    id: uuidv4(),
                                    name: item.new_category_name
                                };
                                newTempCategories.push(tempCat);
                            }
                            return { ...item, category_id: tempCat.id };
                        }
                        return item;
                    });

                    setTempCategories(newTempCategories);
                    setScannedData({
                        items: processedItems,
                        merchant: data.merchant || '',
                        date: new Date().toLocaleDateString('en-CA'),
                        image: base64,
                    });
                    setStep(4);
                    setScanError(null);
                } else if (data.amount) {
                    setAmount(data.amount.toString());
                    if (data.category_id) setCategoryId(data.category_id);
                    setStep(data.category_id ? 3 : 2);
                    setScanError(null);
                }
            } catch (error) {
                console.error('Scan failed', error);
                setScanError('Failed to scan receipt. Please try again.');
            } finally {
                setIsScanning(false);
                reader.abort();
            }
        };
        reader.readAsDataURL(file);
    };

    const handleReceiptSave = async (items: ReceiptItem[], merchant: string, receiptDate: Date, shouldSplit: boolean) => {
        if (!userId) return;
        if (!accountId) {
            alert('Please select an account before saving.');
            return;
        }
        
        const allCategories = [...(categories || []), ...tempCategories];

        if (!allCategories || allCategories.length === 0) {
            alert('Please set up categories before saving expenses.');
            return;
        }
        if (!items || items.length === 0) {
            alert('No items to save.');
            return;
        }

        if (tempCategories.length > 0) {
            const usedTempCatIds = new Set(items.map(i => i.category_id));
            const categoriesToCreate = tempCategories.filter(c => usedTempCatIds.has(c.id)).map(c => ({
                id: c.id,
                user_id: userId,
                name: c.name,
                type: 'expense' as const,
                icon: 'file',
                color: '#808080',
                is_default: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending' as const
            }));

            if (categoriesToCreate.length > 0) {
                await db.categories.bulkAdd(categoriesToCreate);
            }
        }

        const categorySet = new Set(allCategories.map((c) => c.id));
        const normalizedItems = items.map((item) => ({
            ...item,
            description: item.description?.trim() || 'Untitled item',
            amount: Number(item.amount),
        }));

        const invalidItems = normalizedItems.filter(
            (item) =>
                !item.description ||
                Number.isNaN(item.amount) ||
                item.amount <= 0 ||
                !item.category_id ||
                !categorySet.has(item.category_id)
        );

        if (invalidItems.length > 0) {
            alert('Please fix invalid receipt items (description, category, or amount) before saving.');
            return;
        }

        const processedItems = await Promise.all(normalizedItems.map(async (item) => {
            let subcategoryId = undefined;
            if (item.subcategory_name && item.subcategory_name.trim()) {
                const subName = item.subcategory_name.trim();
                const existingSub = await db.subcategories
                    .where({ user_id: userId, category_id: item.category_id })
                    .filter(s => s.name.toLowerCase() === subName.toLowerCase())
                    .first();

                if (existingSub) {
                    subcategoryId = existingSub.id;
                } else {
                    const newSubId = uuidv4();
                    await db.subcategories.add({
                        id: newSubId,
                        user_id: userId,
                        category_id: item.category_id,
                        name: subName,
                        created_at: new Date().toISOString(),
                        sync_status: 'pending',
                    });
                    subcategoryId = newSubId;
                }
            }
            return { ...item, subcategory_id: subcategoryId };
        }));

        const itemsByCategory = new Map<string, typeof processedItems>();
        for (const item of processedItems) {
            const current = itemsByCategory.get(item.category_id) || [];
            current.push(item);
            itemsByCategory.set(item.category_id, current);
        }

        if (shouldSplit) {
            const newExpenses = Array.from(itemsByCategory.entries()).map(([catId, catItems]) => {
                const totalAmount = catItems.reduce((sum, item) => sum + item.amount, 0);
                
                return {
                    id: uuidv4(),
                    user_id: userId,
                    account_id: accountId,
                    category_id: catId,
                    amount: totalAmount,
                    note: merchant,
                    items: catItems.map(i => ({ 
                        description: i.description, 
                        amount: i.amount,
                        category_id: catId,
                        subcategory_id: i.subcategory_id 
                    })),
                    date: receiptDate.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending' as const,
                };
            });
            await db.expenses.bulkAdd(newExpenses);
        } else {
            const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);
            const categoryTotals = new Map<string, number>();
            for (const [catId, catItems] of itemsByCategory.entries()) {
                const total = catItems.reduce((sum, i) => sum + i.amount, 0);
                categoryTotals.set(catId, total);
            }

            let primaryCategoryId = processedItems[0].category_id;
            let maxTotal = 0;
            for (const [catId, total] of categoryTotals.entries()) {
                if (total > maxTotal) {
                    maxTotal = total;
                    primaryCategoryId = catId;
                }
            }

            const newExpense = {
                id: uuidv4(),
                user_id: userId,
                account_id: accountId,
                category_id: primaryCategoryId,
                amount: totalAmount,
                note: merchant,
                items: processedItems.map(i => ({ 
                    description: i.description, 
                    amount: i.amount,
                    category_id: i.category_id,
                    subcategory_id: i.subcategory_id
                })),
                date: receiptDate.toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending' as const,
            };
            await db.expenses.add(newExpense);
        }

        router.push('/');
    };

    const handleDetailsSubmit = async (
        finalNote: string, 
        finalDate: Date, 
        isRecurring: boolean, 
        frequency: 'daily' | 'weekly' | 'monthly' | 'yearly', 
        subcategoryId?: string
    ) => {
        if (!userId) return;

        try {
            if (transactionType === 'transfer') {
                if (!accountId || !toAccountId) {
                    console.error('Missing account info for transfer');
                    return;
                }

                await db.transfers.add({
                    id: uuidv4(),
                    user_id: userId,
                    from_account_id: accountId,
                    to_account_id: toAccountId,
                    amount: parseFloat(amount),
                    note: finalNote || 'Transfer',
                    date: finalDate.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending',
                });

            } else {
                // Build Items Array if subcategory is present
                const items = subcategoryId ? [{
                    description: finalNote,
                    amount: parseFloat(amount),
                    category_id: categoryId,
                    subcategory_id: subcategoryId
                }] : undefined;

                await db.expenses.add({
                    id: uuidv4(),
                    user_id: userId,
                    account_id: accountId,
                    category_id: categoryId,
                    amount: parseFloat(amount),
                    note: finalNote,
                    items: items, // Attach subcategory info here
                    date: finalDate.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending',
                });

                if (isRecurring) {
                    const nextDue = new Date(finalDate);
                    if (frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1);
                    if (frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
                    if (frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
                    if (frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

                    await db.recurring_expenses.add({
                        id: uuidv4(),
                        user_id: userId,
                        category_id: categoryId,
                        amount: parseFloat(amount),
                        description: finalNote,
                        frequency: frequency,
                        next_due_date: nextDue.toISOString(),
                        active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        sync_status: 'pending',
                    });
                }
            }

            router.push('/');
        } catch (error) {
            console.error('Failed to save transaction:', error);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <StepAmount
                        key="step1"
                        onNext={handleAmountSubmit}
                        onScan={handleScanReceipt}
                        isScanning={isScanning}
                        scanError={scanError}
                    />
                )}
                {step === 2 && transactionType !== 'transfer' && (
                    <StepCategory 
                        key="step2" 
                        onNext={handleCategorySubmit} 
                        onBack={() => setStep(1)} 
                        type={transactionType as 'expense' | 'income'}
                    />
                )}
                {step === 3 && (
                    <StepDetails 
                        key="step3" 
                        onSubmit={handleDetailsSubmit} 
                        onBack={() => setStep(transactionType === 'transfer' ? 1 : 2)} 
                        categoryId={categoryId}
                    />
                )}
                {step === 4 && scannedData && categories && (
                    <StepReceiptReview
                        key="step4"
                        items={scannedData.items}
                        merchant={scannedData.merchant}
                        date={scannedData.date}
                        imageUrl={scannedData.image}
                        categories={[...categories, ...tempCategories]}
                        accounts={accounts || []}
                        accountId={accountId}
                        onChangeAccount={setAccountId}
                        onSave={handleReceiptSave}
                        onCancel={() => {
                            setScannedData(null);
                            setTempCategories([]);
                            setStep(1);
                        }}
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
]]>
</file>
</modifications>