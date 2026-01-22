'use client';

import { BottomNav } from '@/components/features/layout/BottomNav';
import { ManualSyncButton } from '@/components/features/sync/ManualSyncButton';
import AuthGuard from '@/components/auth/AuthGuard';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <div className="flex flex-col min-h-screen bg-background pb-20">
                {/* Sync Status Indicator */}
                <div className="fixed top-4 right-4 z-50">
                    <ManualSyncButton />
                </div>

                <main className="flex-1 overflow-y-auto no-scrollbar">
                    {children}
                </main>
                <BottomNav />
            </div>
        </AuthGuard>
    );
}
