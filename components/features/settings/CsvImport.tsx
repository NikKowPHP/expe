'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Upload, Check, Loader2, FileSpreadsheet, Wand2 } from 'lucide-react'; // Added Wand2
import { db } from '@/lib/db/db';
import { v4 as uuidv4 } from 'uuid';
import { useCategories } from '@/lib/hooks/use-categories';
import { motion, AnimatePresence } from 'framer-motion';

export function CsvImport() {
    const [isImporting, setIsImporting] = useState(false);
    const [isCategorizing, setIsCategorizing] = useState(false); // New state for AI loading
    const [preview, setPreview] = useState<any[]>([]); // This holds our CSV data
    const [file, setFile] = useState<File | null>(null);
    const [stats, setStats] = useState({ success: 0, skipped: 0 });
    const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const { categories } = useCategories();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const parseFile = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    // Map raw CSV to a cleaner internal format initially
                    const mappedData = results.data.map((row: any) => ({
                        raw: row, // Keep original data
                        // Try to find columns case-insensitively
                        description: row.description || row.Description || row.note || row.Note || row.memo || row.Memo || row.title || '',
                        amount: row.amount || row.Amount || row.price || row.Price || row.cost || '0',
                        date: row.date || row.Date || row.time || new Date().toISOString(),
                        categoryId: '', // Empty initially
                        categoryName: 'Uncategorized' // Display name
                    }));
                    setPreview(mappedData);
                    setStep('preview');
                } else {
                    alert('No data found in CSV');
                }
            }
        });
    };

    // --- THE NEW AI FUNCTION ---
    const runAiCategorization = async () => {
        if (preview.length === 0) return;
        setIsCategorizing(true);

        try {
            // 1. Get unique descriptions to save tokens/time
            const uniqueDescriptions = Array.from(new Set(
                preview
                    .map(row => row.description)
                    .filter(d => d && d.length > 2) // Filter out empty/short
            ));

            // 2. Batch process (chunking by 20 items to be safe with timeouts)
            const chunkSize = 20;
            const descriptionMap: Record<string, string> = {};

            for (let i = 0; i < uniqueDescriptions.length; i += chunkSize) {
                const chunk = uniqueDescriptions.slice(i, i + chunkSize);
                
                const res = await fetch('/api/ai/categorize-batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        descriptions: chunk, 
                        categories: categories 
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    Object.assign(descriptionMap, data.mapping);
                }
            }

            // 3. Apply mappings back to preview data
            const updatedPreview = preview.map(row => {
                const aiCatId = descriptionMap[row.description];
                if (aiCatId) {
                    const catObj = categories.find(c => c.id === aiCatId);
                    return {
                        ...row,
                        categoryId: aiCatId,
                        categoryName: catObj ? catObj.name : 'Unknown'
                    };
                }
                return row;
            });

            setPreview(updatedPreview);

        } catch (error) {
            console.error('AI error', error);
            alert('AI categorization failed partially or completely.');
        } finally {
            setIsCategorizing(false);
        }
    };
    // ---------------------------

    const processImport = async () => {
        setIsImporting(true);
        try {
            const { data: { user } } = await (await import('@/lib/supabase/client')).createClient().auth.getUser();
            const userId = user?.id || 'anonymous';
            const defaultAccount = await db.accounts.where('name').equals('Cash').first();
            
            // Default "Other" category as fallback
            const otherCategory = categories.find(c => c.name === 'Other')?.id || categories[0]?.id;

            const newExpenses = preview.map(row => {
                const amount = parseFloat(row.amount);
                if (isNaN(amount)) return null;

                return {
                    id: uuidv4(),
                    user_id: userId,
                    account_id: defaultAccount?.id,
                    // Use AI category, or fallback to 'Other'
                    category_id: row.categoryId || otherCategory, 
                    amount: Math.abs(amount),
                    note: row.description,
                    date: new Date(row.date).toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    sync_status: 'pending' as const,
                };
            }).filter(Boolean); // Remove nulls

            if (newExpenses.length > 0) {
                await db.expenses.bulkAdd(newExpenses as any);
            }

            setStats({ success: newExpenses.length, skipped: preview.length - newExpenses.length });
            setStep('result');
        } catch (e) {
            console.error(e);
            alert('Import failed');
        } finally {
            setIsImporting(false);
        }
    };

    const reset = () => {
        setFile(null);
        setPreview([]);
        setStep('upload');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-4">
            <AnimatePresence mode="wait">
                {step === 'upload' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-secondary/50 transition-colors"
                        >
                            <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                            <p className="font-medium">Click to select CSV</p>
                            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                        </div>
                    </motion.div>
                )}

                {step === 'preview' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Review Data</h3>
                            
                            {/* AI MAGIC BUTTON */}
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={runAiCategorization} 
                                disabled={isCategorizing || isImporting}
                                className="bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300"
                            >
                                {isCategorizing ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Wand2 className="w-4 h-4 mr-2" />
                                )}
                                {isCategorizing ? 'AI is thinking...' : 'Auto-Categorize'}
                            </Button>
                        </div>

                        <div className="bg-secondary/30 rounded-xl p-0 overflow-hidden border border-border">
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-secondary text-muted-foreground sticky top-0">
                                        <tr>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Description</th>
                                            <th className="p-3">Amount</th>
                                            <th className="p-3">Category</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {preview.map((row, i) => (
                                            <tr key={i} className="hover:bg-secondary/50">
                                                <td className="p-3 whitespace-nowrap">{row.date.split('T')[0]}</td>
                                                <td className="p-3 max-w-[150px] truncate" title={row.description}>{row.description}</td>
                                                <td className="p-3">{row.amount}</td>
                                                <td className="p-3">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                                                        row.categoryId 
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}>
                                                        {row.categoryName}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button onClick={processImport} disabled={isImporting || isCategorizing} className="flex-1">
                                {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Upload className="w-4 h-4 mr-2"/>}
                                Import {preview.length} Rows
                            </Button>
                            <Button variant="outline" onClick={reset} disabled={isImporting}>
                                Cancel
                            </Button>
                        </div>
                    </motion.div>
                )}
                
                {step === 'result' && (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center p-6 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-900">
                         <Check className="w-12 h-12 mx-auto text-green-600 mb-2" />
                         <h3 className="text-lg font-bold">Success!</h3>
                         <p className="text-muted-foreground mb-4">Imported {stats.success} expenses.</p>
                         <Button onClick={reset} variant="outline">Done</Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
