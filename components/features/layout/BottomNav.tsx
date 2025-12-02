'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PieChart, Plus, History, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function BottomNav() {
    const pathname = usePathname();

    const links = [
        { href: '/', icon: Home, label: 'Home' },
        { href: '/analytics', icon: PieChart, label: 'Analytics' },
        { href: '/add', icon: Plus, label: 'Add', isFab: true },
        { href: '/history', icon: History, label: 'History' },
        { href: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-safe">
            <div className="flex items-center justify-around h-16 px-2">
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = link.icon;

                    if (link.isFab) {
                        return (
                            <div key={link.href} className="relative -top-6">
                                <Link href={link.href}>
                                    <motion.div
                                        whileTap={{ scale: 0.9 }}
                                        className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg"
                                    >
                                        <Icon className="w-8 h-8" />
                                    </motion.div>
                                </Link>
                            </div>
                        );
                    }

                    return (
                        <Link key={link.href} href={link.href} className="flex-1">
                            <motion.div
                                whileTap={{ scale: 0.9 }}
                                className={cn(
                                    "flex flex-col items-center justify-center h-full space-y-1",
                                    isActive ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                <Icon className="w-6 h-6" />
                                <span className="text-[10px] font-medium">{link.label}</span>
                            </motion.div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
