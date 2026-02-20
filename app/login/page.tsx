'use client';

import { createBrowserClient } from '@/lib/supabase';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (isSignUp) {
      setError('Check your email to confirm your account.');
      return;
    }

    // New users go straight to connect; returning users go to dashboard
    const accountsRes = await fetch('/api/accounts');
    const accountsData = accountsRes.ok ? await accountsRes.json() : [];
    router.push(accountsData.length === 0 ? '/connect' : '/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="font-heading text-3xl text-charcoal text-center mb-8">
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-border-subtle rounded-lg bg-white font-body"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-border-subtle rounded-lg bg-white font-body"
            required
            minLength={6}
          />

          {error && (
            <p className="text-red-600 text-sm font-body">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-terra text-white py-3 rounded-lg font-body disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full mt-4 text-charcoal font-body text-sm underline"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
