'use client';

import { createBrowserClient } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'signin' | 'signup' | 'forgot';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('signin');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'link_expired') {
      setError('Your reset link has expired. Request a new one below.');
      setMode('forgot');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === 'forgot') {
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setInfo('Reset link sent — check your email.');
      }
      return;
    }

    const { error } = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (mode === 'signup') {
      setInfo('Check your email to confirm your account.');
      return;
    }

    // New users go straight to connect; returning users go to dashboard
    const accountsRes = await fetch('/api/accounts');
    const accountsData = accountsRes.ok ? await accountsRes.json() : [];
    router.push(accountsData.length === 0 ? '/connect' : '/dashboard');
    router.refresh();
  };

  const title = mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Sign In';

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="font-heading text-3xl text-charcoal text-center mb-8">{title}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block font-body text-sm text-charcoal/60 mb-1">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-border-subtle rounded-lg bg-white font-body"
              required
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label htmlFor="password" className="block font-body text-sm text-charcoal/60 mb-1">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-border-subtle rounded-lg bg-white font-body"
                required
                minLength={6}
              />
            </div>
          )}

          {error && <p className="text-red-600 text-sm font-body">{error}</p>}
          {info && <p className="text-green-700 text-sm font-body">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-terra text-white py-3 rounded-lg font-body disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? 'Loading...' : mode === 'signup' ? 'Sign Up' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2">
          {mode === 'signin' && (
            <>
              <button onClick={() => { setMode('forgot'); setError(null); setInfo(null); }} className="text-charcoal font-body text-sm underline">
                Forgot password?
              </button>
              <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className="text-charcoal font-body text-sm underline">
                Don&apos;t have an account? Sign up
              </button>
            </>
          )}
          {mode !== 'signin' && (
            <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="text-charcoal font-body text-sm underline">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
