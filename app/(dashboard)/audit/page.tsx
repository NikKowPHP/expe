'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, TrendingUp, History } from 'lucide-react';
import Link from 'next/link';
import { OptimizationCard } from '@/components/features/audit/OptimizationCard';
import { CategoryBreakdown } from '@/components/features/audit/CategoryBreakdown';

export default function AuditPage() {
    const expenses = useLiveQuery(() => db.expenses.filter(e => !e.deleted_at).toArray());
    const categories = useLiveQuery(() => db.categories.toArray());
    const subcategories = useLiveQuery(() => db.subcategories.toArray());

    const [loading, setLoading] = useState(false);
    const [auditResult, setAuditResult] = useState<{
        optimizations: any[];
        overall_score: number;
        summary: string;
    } | null>(null);

    if (!expenses || !categories || !subcategories) {
        return <div className="p-6 flex items-center justify-center h-screen">Loading financial data...</div>;
    }

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

    const handleRunAudit = async () => {
        setLoading(true);
        try {
            // Prepare payload
            const payload = {
                expenses: expenses.map(e => ({
                    date: e.date,
                    amount: e.amount,
                    category: categories.find(c => c.id === e.category_id)?.name || 'Unknown',
                    items: e.items // Includes subcategory info if available
                })),
                categories,
                subcategories
            };

            const res = await fetch('/api/ai/audit', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            setAuditResult(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Subscriptions detection (Client-side logic as per plan)
    // Simple heuristic: Same amount, +/- 10%, approx same day of month? 
    // Or just let AI do it? The plan said "Implement Subscription Detection Logic" separately or as part of AI.
    // Let's rely on AI for the "Audit" button for now to keep it simpler, 
    // or we can add a "Potential Subscriptions" section if we want purely algorithmic.
    // For this version, we will stick to the AI result as the primary "Optimization" source.

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Header */}
            <div className="p-6 pt-8 sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b border-border">
                <div className="flex items-center gap-4 mb-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Spending Audit</h1>
                </div>
                
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">Total Analyzed</p>
                        <p className="text-3xl font-black text-primary">${totalSpent.toFixed(2)}</p>
                    </div>
                    <Button 
                        onClick={handleRunAudit} 
                        disabled={loading}
                        className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/20"
                    >
                        {loading ? <span className="animate-pulse">Analyzing...</span> : <><Sparkles className="w-4 h-4 mr-2" /> Run AI Audit</>}
                    </Button>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* AI Results Section */}
                {auditResult && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Score Card */}
                        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />
                            
                            <div className="z-10">
                                <h2 className="text-lg font-semibold mb-1">Financial Health</h2>
                                <p className="text-sm text-muted-foreground max-w-[200px]">{auditResult.summary}</p>
                            </div>
                            <div className="z-10 flex flex-col items-center justify-center p-4 bg-background rounded-2xl border border-border shadow-sm">
                                <span className={`text-3xl font-black ${
                                    auditResult.overall_score >= 80 ? 'text-green-500' : 
                                    auditResult.overall_score >= 50 ? 'text-yellow-500' : 'text-red-500'
                                }`}>
                                    {auditResult.overall_score}
                                </span>
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Score</span>
                            </div>
                        </div>

                        {/* Optimizations */}
                        <div>
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-500" />
                                Recommended Optimizations
                            </h3>
                            {auditResult.optimizations.map((opt, i) => (
                                <OptimizationCard key={i} optimization={opt} index={i} />
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Detailed Breakdown */}
                <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <History className="w-5 h-5 text-indigo-500" />
                        Category Breakdown
                    </h3>
                    <div className="space-y-1">
                        {categories.map(cat => (
                           <CategoryBreakdown 
                                key={cat.id} 
                                category={cat} 
                                expenses={expenses} 
                                subcategories={subcategories}
                                total={totalSpent}
                           /> 
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
