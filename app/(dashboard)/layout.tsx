'use client';

import { useState, useEffect } from 'react';
import { BottomNav } from '@/components/features/layout/BottomNav';
import { SideNav } from '@/components/features/layout/SideNav';
import { ManualSyncButton } from '@/components/features/sync/ManualSyncButton';
import AuthGuard from '@/components/auth/AuthGuard';
import { GlobalSearch } from '@/components/features/search/GlobalSearch';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                {/* Desktop Side Nav */}
                <SideNav />

                <div className="flex-1 flex flex-col md:pl-64 transition-all duration-300 min-w-0">
                    {/* Header Bar */}
                    <div className="fixed top-0 right-0 left-0 md:left-64 z-40 p-4 flex justify-end gap-2 pointer-events-none">
                        <div className="pointer-events-auto flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 gap-2 bg-background/80 backdrop-blur-md hidden sm:flex"
                                onClick={() => setIsSearchOpen(true)}
                            >
                                <Search className="w-3.5 h-3.5" />
                                <span className="text-muted-foreground">Search...</span>
                                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                    <span className="text-xs">⌘</span>K
                                </kbd>
                            </Button>
                            
                            {/* Mobile Search Icon */}
                            <Button 
                                variant="secondary" 
                                size="icon" 
                                className="h-8 w-8 rounded-full sm:hidden pointer-events-auto shadow-md"
                                onClick={() => setIsSearchOpen(true)}
                            >
                                <Search className="w-4 h-4" />
                            </Button>

                            <ManualSyncButton />
                        </div>
                    </div>

                    <main className="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0 pt-16 md:pt-0">
                        {/* Wrapper to constrain width on ultra-wide screens */}
                        <div className="max-w-7xl mx-auto w-full">
                            {children}
                        </div>
                    </main>

                    {/* Mobile Bottom Nav */}
                    <div className="md:hidden">
                        <BottomNav />
                    </div>
                </div>
            </div>
            
            <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </AuthGuard>
    );
}
        