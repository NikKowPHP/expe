'use client';

import { motion } from 'framer-motion';
import { Lightbulb, TrendingDown, AlertTriangle } from 'lucide-react';

interface Optimization {
    title: string;
    description: string;
    impact: 'High' | 'Medium' | 'Low';
}

export function OptimizationCard({ optimization, index }: { optimization: Optimization, index: number }) {
    const getIcon = () => {
        switch (optimization.impact) {
            case 'High': return <AlertTriangle className="w-5 h-5 text-red-500" />;
            case 'Medium': return <TrendingDown className="w-5 h-5 text-orange-500" />;
            default: return <Lightbulb className="w-5 h-5 text-yellow-500" />;
        }
    };

    const getBorderColor = () => {
        switch (optimization.impact) {
            case 'High': return 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30';
            case 'Medium': return 'border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30';
            default: return 'border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-4 rounded-xl border ${getBorderColor()} mb-3`}
        >
            <div className="flex items-start gap-3">
                <div className="mt-1">{getIcon()}</div>
                <div>
                    <h4 className="font-semibold text-sm">{optimization.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{optimization.description}</p>
                    <span className="inline-block mt-2 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20">
                        {optimization.impact} Impact
                    </span>
                </div>
            </div>
        </motion.div>
    );
}
