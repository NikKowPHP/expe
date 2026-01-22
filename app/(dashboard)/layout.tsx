'use client';

import { BottomNav } from '@/components/features/layout/BottomNav';
import { SideNav } from '@/components/features/layout/SideNav';
import { ManualSyncButton } from '@/components/features/sync/ManualSyncButton';
import AuthGuard from '@/components/auth/AuthGuard';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                {/* Desktop Side Nav */}
                <SideNav />

                <div className="flex-1 flex flex-col md:pl-64 transition-all duration-300 min-w-0">
                    {/* Sync Status Indicator */}
                    <div className="fixed top-4 right-4 z-50">
                        <ManualSyncButton />
                    </div>

                    <main className="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0">
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
        </AuthGuard>
    );
}
      