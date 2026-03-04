'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { toast } from '@/app/components/Toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // Show session-expired banner when redirected from middleware
  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      toast('error', 'Your session expired. Please sign in again.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      toast('error', error.message);
      return;
    }

    if (isSignUp) {
      toast('success', 'Check your email to confirm your account.');
      return;
    }

    router.push('/dashboard');
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

          {!isSignUp && (
            <div className="text-right">
              <Link
                href="/reset-password"
                className="text-charcoal font-body text-sm underline"
              >
                Forgot password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-terra text-white py-3 rounded-lg font-body disabled:opacity-50"
          >
            {loading
              ? isSignUp ? 'Creating account...' : 'Signing in...'
              : isSignUp ? 'Sign Up' : 'Sign In'}
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
