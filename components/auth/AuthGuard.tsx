'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db/db';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Security Check: Verify that the local data belongs to this user
                // We check one table (e.g. categories) to see if there are records with a DIFFERENT user_id
                const otherUserCategory = await db.categories
                    .where('user_id')
                    .notEqual(user.id)
                    .first();

                if (otherUserCategory) {
                    console.warn('AuthGuard: Detected data from another user. Clearing local database.');
                    await Promise.all([
                        db.expenses.clear(),
                        db.categories.clear(),
                        db.subcategories.clear(),
                        db.accounts.clear(),
                        db.budgets.clear(),
                        db.recurring_expenses.clear()
                    ]);
                    // Clear sync timestamp
                    localStorage.removeItem('last_expense_sync');
                }

                setAuthenticated(true);
            } else {
                router.push('/login');
            }

            setLoading(false);
        };

        checkAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                router.push('/login');
            } else if (event === 'SIGNED_IN') {
                // We could re-run checkAuth here, but usually page reload handles it
                setAuthenticated(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!authenticated) {
        return null;
    }

    return <>{children}</>;
}
