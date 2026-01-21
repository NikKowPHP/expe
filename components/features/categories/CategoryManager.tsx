'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { useCategoryMutations } from '@/lib/hooks/use-category-mutations';
import { Button } from '@/components/ui/button';
import {
  Plus, Edit2, Trash2, Check, X,
  Coffee, Bus, ShoppingCart, Home, Zap, Heart, Briefcase, MoreHorizontal,
  DollarSign, TrendingUp, Gift, Music, Book, Car, Plane, Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Available icons for category selection
const AVAILABLE_ICONS = [
  { name: 'coffee', icon: Coffee, label: 'Food' },
  { name: 'bus', icon: Bus, label: 'Transport' },
  { name: 'shopping-cart', icon: ShoppingCart, label: 'Shopping' },
  { name: 'home', icon: Home, label: 'Home' },
  { name: 'zap', icon: Zap, label: 'Utilities' },
  { name: 'heart', icon: Heart, label: 'Health' },
  { name: 'briefcase', icon: Briefcase, label: 'Work' },
  { name: 'dollar-sign', icon: DollarSign, label: 'Money' },
  { name: 'trending-up', icon: TrendingUp, label: 'Investment' },
  { name: 'gift', icon: Gift, label: 'Gifts' },
  { name: 'music', icon: Music, label: 'Entertainment' },
  { name: 'book', icon: Book, label: 'Education' },
  { name: 'car', icon: Car, label: 'Vehicle' },
  { name: 'plane', icon: Plane, label: 'Travel' },
  { name: 'film', icon: Film, label: 'Movies' },
  { name: 'more-horizontal', icon: MoreHorizontal, label: 'Other' },
];

// Color options for categories
const COLOR_OPTIONS = [
  'bg-orange-100 text-orange-600',
  'bg-blue-100 text-blue-600',
  'bg-purple-100 text-purple-600',
  'bg-green-100 text-green-600',
  'bg-yellow-100 text-yellow-600',
  'bg-red-100 text-red-600',
  'bg-slate-100 text-slate-600',
  'bg-gray-100 text-gray-600',
  'bg-pink-100 text-pink-600',
  'bg-indigo-100 text-indigo-600',
  'bg-teal-100 text-teal-600',
  'bg-cyan-100 text-cyan-600',
];

export function CategoryManager() {
  const categories = useLiveQuery(() => db.categories.toArray());
  const { createCategory, updateCategory, deleteCategory } = useCategoryMutations();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: 'more-horizontal',
    color: 'bg-gray-100 text-gray-600',
    type: 'expense' as 'income' | 'expense',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        await updateCategory(editingId, formData);
        setEditingId(null);
      } else {
        await createCategory(formData);
        setIsAdding(false);
      }

      setFormData({
        name: '',
        icon: 'more-horizontal',
        color: 'bg-gray-100 text-gray-600',
        type: 'expense',
      });
    } catch (error) {
      console.error('Failed to save category:', error);
      alert(error instanceof Error ? error.message : 'Failed to save category');
    }
  };

  const handleEdit = (categoryId: string) => {
    const category = categories?.find(c => c.id === categoryId);
    if (category) {
      setFormData({
        name: category.name,
        icon: category.icon,
        color: category.color || 'bg-gray-100 text-gray-600',
        type: category.type,
      });
      setEditingId(categoryId);
      setIsAdding(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    const category = categories?.find(c => c.id === categoryId);
    if (category?.is_default) {
      alert('Cannot delete default categories');
      return;
    }

    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteCategory(categoryId);
      } catch (error) {
        console.error('Failed to delete category:', error);
        alert(error instanceof Error ? error.message : 'Failed to delete category');
      }
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      icon: 'more-horizontal',
      color: 'bg-gray-100 text-gray-600',
      type: 'expense',
    });
  };

  const getIconComponent = (iconName: string) => {
    const iconObj = AVAILABLE_ICONS.find(i => i.name === iconName);
    return iconObj?.icon || MoreHorizontal;
  };

  return (
    <div className="space-y-4">
      {/* Category List */}
      <div className="grid grid-cols-2 gap-3">
        {categories?.map((category) => {
          const Icon = getIconComponent(category.icon);
          const isEditing = editingId === category.id;

          return (
            <motion.div
              key={category.id}
              layout
              className={cn(
                'relative p-4 rounded-2xl transition-all',
                category.color,
                isEditing ? 'ring-2 ring-primary' : ''
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm">{category.name}</span>
                {category.sync_status === 'pending' && (
                  <span className="ml-auto w-2 h-2 bg-yellow-500 rounded-full" title="Pending sync" />
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(category.id)}
                  className="h-7 px-2 text-xs"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                {!category.is_default && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(category.id)}
                    className="h-7 px-2 text-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

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
              {editingId ? 'Edit Category' : 'Add New Category'}
            </h3>

            {/* Type Selection */}
            <div className="flex p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
                  formData.type === 'expense'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
                  formData.type === 'income'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Income
              </button>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-sm mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Category name"
                required
                autoFocus
              />
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-sm mb-2">Icon</label>
              <div className="grid grid-cols-8 gap-2">
                {AVAILABLE_ICONS.map(({ name, icon: IconComponent }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: name })}
                    className={cn(
                      'p-2 rounded-lg transition-all',
                      formData.icon === name
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm mb-2">Color</label>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      'p-3 rounded-lg transition-all',
                      color,
                      formData.color === color ? 'ring-2 ring-primary ring-offset-2' : ''
                    )}
                  >
                    {formData.color === color && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>

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
      {!isAdding && !editingId && (
        <Button
          onClick={() => setIsAdding(true)}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Category
        </Button>
      )}
    </div>
  );
}
