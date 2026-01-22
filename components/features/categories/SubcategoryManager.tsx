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
  const categories = useLiveQuery(async () => {
    const all = await db.categories.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name));
  });
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
