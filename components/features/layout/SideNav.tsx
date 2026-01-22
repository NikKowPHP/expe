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
      