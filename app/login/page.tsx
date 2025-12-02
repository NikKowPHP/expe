'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const router = useRouter();
    const supabase = createClient();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;
                router.push('/');
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (error) throw error;
                setMessage('Check your email to confirm your account!');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleMagicLink = async () => {
        if (!email) {
            setError('Please enter your email');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/`,
                },
            });

            if (error) throw error;
            setMessage('Check your email for the magic link!');
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Expense Tracker</h1>
                    <p className="text-muted-foreground">
                        {isLogin ? 'Welcome back!' : 'Create your account'}
                    </p>
                </div>

                {/* Auth Card */}
                <div className="bg-card border border-border rounded-3xl p-8 shadow-lg">
                    <form onSubmit={handleAuth} className="space-y-4">
                        {/* Email Input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-destructive/10 text-destructive rounded-xl text-sm">
                                {error}
                            </div>
                        )}

                        {/* Success Message */}
                        {message && (
                            <div className="p-3 bg-primary/10 text-primary rounded-xl text-sm">
                                {message}
                            </div>
                        )}

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full h-12 text-base"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    {isLogin ? 'Signing in...' : 'Creating account...'}
                                </>
                            ) : (
                                isLogin ? 'Sign In' : 'Sign Up'
                            )}
                        </Button>

                        {/* Magic Link Button */}
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full h-12 text-base"
                            onClick={handleMagicLink}
                            disabled={loading}
                        >
                            <Mail className="w-5 h-5 mr-2" />
                            Send Magic Link
                        </Button>
                    </form>

                    {/* Toggle Login/Signup */}
                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                                setMessage('');
                            }}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                            {isLogin ? (
                                <>Don't have an account? <span className="font-semibold">Sign up</span></>
                            ) : (
                                <>Already have an account? <span className="font-semibold">Sign in</span></>
                            )}
                        </button>
                    </div>
                </div>

                {/* Demo Account Info */}
                <div className="mt-6 p-4 bg-muted/50 rounded-2xl text-center">
                    <p className="text-sm text-muted-foreground">
                        💡 <strong>Tip:</strong> Use any email - check your inbox for confirmation
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
