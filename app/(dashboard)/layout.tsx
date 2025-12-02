'use client';

import { BottomNav } from '@/components/features/layout/BottomNav';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import AuthGuard from '@/components/auth/AuthGuard';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isOnline, isSyncing, syncExpenses } = useOfflineSync();

    return (
        <AuthGuard>
            <div className="flex flex-col min-h-screen bg-background pb-20">
                {/* Sync Status Indicator */}
                <div className="fixed top-4 right-4 z-50">
                    {isSyncing ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-full text-sm shadow-lg">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Syncing...</span>
                        </div>
                    ) : !isOnline ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-full text-sm border border-destructive/20">
                            <WifiOff className="w-4 h-4" />
                            <span>Offline</span>
                        </div>
                    ) : null}
                </div>

                <main className="flex-1 overflow-y-auto no-scrollbar">
                    {children}
                </main>
                <BottomNav />
            </div>
        </AuthGuard>
    );
}
