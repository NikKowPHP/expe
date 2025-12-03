'use client';

import { useState } from 'react';
import { useBudgets } from '@/lib/hooks/use-budgets';
import { useBudgetMutations } from '@/lib/hooks/use-budget-mutations';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { Button } from '@/components/ui/button';
import { 
  Plus, Edit2, Trash2, Check, X, 
  Coffee, Bus, ShoppingCart, Home, Zap, Heart, Briefcase, MoreHorizontal,
  DollarSign, TrendingUp, Gift, Music, Book, Car, Plane, Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Icon mapping (same as CategoryManager)
const ICON_MAP: Record<string, any> = {
  'coffee': Coffee,
  'bus': Bus,
  'shopping-cart': ShoppingCart,
  'home': Home,
  'zap': Zap,
  'heart': Heart,
  'briefcase': Briefcase,
  'dollar-sign': DollarSign,
  'trending-up': TrendingUp,
  'gift': Gift,
  'music': Music,
  'book': Book,
  'car': Car,
  'plane': Plane,
  'film': Film,
  'more-horizontal': MoreHorizontal,
};

export function BudgetManager() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  
  const { budgetStatuses, isLoading } = useBudgets(selectedMonth, selectedYear);
  const { createBudget, updateBudget, deleteBudget } = useBudgetMutations();
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray());
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    copyMonths: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        await updateBudget(editingId, {
          amount: parseFloat(formData.amount),
        });
        setEditingId(null);
      } else {
        await createBudget({
          category_id: formData.category_id,
          amount: parseFloat(formData.amount),
          month: selectedMonth,
          year: selectedYear,
          copyToFutureMonths: formData.copyMonths,
        });
        setIsAdding(false);
      }
      
      setFormData({
        category_id: '',
        amount: '',
        copyMonths: 0,
      });
    } catch (error) {
      console.error('Failed to save budget:', error);
      alert(error instanceof Error ? error.message : 'Failed to save budget');
    }
  };

  const handleEdit = (budgetId: string) => {
    const budget = budgetStatuses?.find(b => b.budgetId === budgetId);
    if (budget) {
      setFormData({
        category_id: budget.categoryId,
        amount: budget.budgetAmount.toString(),
        copyMonths: 0,
      });
      setEditingId(budgetId);
      setIsAdding(false);
    }
  };

  const handleDelete = async (budgetId: string) => {
    if (confirm('Are you sure you want to delete this budget?')) {
      try {
        await deleteBudget(budgetId);
      } catch (error) {
        console.error('Failed to delete budget:', error);
        alert(error instanceof Error ? error.message : 'Failed to delete budget');
      }
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      category_id: '',
      amount: '',
      copyMonths: 0,
    });
  };

  const getIconComponent = (iconName: string) => {
    return ICON_MAP[iconName] || MoreHorizontal;
  };

  // Get available categories (not already budgeted for this month)
  const availableCategories = categories?.filter(cat => 
    !budgetStatuses?.some(b => b.categoryId === cat.id)
  ) || [];

  const getProgressColor = (percentUsed: number) => {
    if (percentUsed >= 100) return 'bg-red-500';
    if (percentUsed >= 90) return 'bg-red-400';
    if (percentUsed >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-4">
      {/* Month/Year Selector */}
      <div className="flex gap-2">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          className="flex-1 px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {monthNames.map((name, idx) => (
            <option key={idx} value={idx + 1}>{name}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Budget List */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Loading budgets...</div>
      ) : budgetStatuses.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No budgets set for {monthNames[selectedMonth - 1]} {selectedYear}
        </div>
      ) : (
        <div className="space-y-3">
          {budgetStatuses.map((budget) => {
            const Icon = getIconComponent(budget.categoryIcon || 'more-horizontal');
            const isEditing = editingId === budget.budgetId;
            
            return (
              <motion.div
                key={budget.budgetId}
                layout
                className={cn(
                  'p-4 rounded-2xl transition-all',
                  budget.categoryColor || 'bg-gray-100 text-gray-600',
                  isEditing ? 'ring-2 ring-primary' : ''
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5" />
                  <span className="font-medium text-sm">{budget.categoryName}</span>
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(budget.budgetId)}
                      className="h-7 px-2 text-xs"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(budget.budgetId)}
                      className="h-7 px-2 text-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>${budget.spent.toFixed(2)} / ${budget.budgetAmount.toFixed(2)}</span>
                    <span className={budget.percentUsed >= 90 ? 'font-bold' : ''}>
                      {budget.percentUsed.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className={cn('h-full transition-all', getProgressColor(budget.percentUsed))}
                      style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                    />
                  </div>
                  {budget.remaining < 0 && (
                    <p className="text-xs font-medium text-red-600">
                      Over budget by ${Math.abs(budget.remaining).toFixed(2)}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Form */}
      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="p-4 bg-background rounded-2xl border border-border space-y-4"
          >
            <h3 className="font-semibold">
              {editingId ? 'Edit Budget' : 'Add New Budget'}
            </h3>
            
            {/* Category Selector (only for new budgets) */}
            {!editingId && (
              <div>
                <label className="block text-sm mb-2">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-2 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select a category</option>
                  {availableCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <label className="block text-sm mb-2">Budget Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="500.00"
                required
                autoFocus
              />
            </div>

            {/* Copy to Future Months (only for new budgets) */}
            {!editingId && (
              <div>
                <label className="block text-sm mb-2">Copy to future months</label>
                <select
                  value={formData.copyMonths}
                  onChange={(e) => setFormData({ ...formData, copyMonths: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={0}>This month only</option>
                  <option value={1}>Next 1 month</option>
                  <option value={2}>Next 2 months</option>
                  <option value={3}>Next 3 months</option>
                  <option value={5}>Next 6 months</option>
                  <option value={11}>Next 12 months</option>
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                <Check className="w-4 h-4 mr-2" />
                {editingId ? 'Update' : 'Add'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Add Button */}
      {!isAdding && !editingId && availableCategories.length > 0 && (
        <Button
          onClick={() => setIsAdding(true)}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Budget
        </Button>
      )}
      
      {!isAdding && !editingId && availableCategories.length === 0 && budgetStatuses.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          All categories have budgets for this month
        </p>
      )}
    </div>
  );
}
