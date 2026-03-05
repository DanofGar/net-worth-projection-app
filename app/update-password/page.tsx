'use client';

import { useMemo, useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { toast } from '@/app/components/Toast';

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const exchangeAttempted = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // 1. Supabase redirected with an error (e.g. otp_expired)
    if (error) {
      toast('error', errorDescription?.replace(/\+/g, ' ') || 'Reset link is invalid or expired.');
      router.replace('/reset-password');
      return;
    }

    // 2. PKCE code present — exchange it for a session (once only, ref guards strict mode double-fire)
    if (code) {
      if (exchangeAttempted.current) return;
      exchangeAttempted.current = true;

      supabase.auth.exchangeCodeForSession(code)
        .then(({ error: exchangeError }) => {
          if (exchangeError) {
            console.error('Code exchange failed:', exchangeError);
            toast('error', 'Reset link is invalid or expired. Please request a new one.');
            router.replace('/reset-password');
          } else {
            // Full page reload without the code param so getUser() picks up the fresh session cookies
            window.location.replace('/update-password');
          }
        })
        .catch((err) => {
          console.error('Code exchange threw:', err);
          toast('error', 'Something went wrong. Please try again.');
          router.replace('/reset-password');
        });
      return;
    }

    // 3. No code, no error — we should already have a session from a prior exchange
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setReady(true);
      } else {
        toast('error', 'No active session. Please request a new reset link.');
        router.replace('/reset-password');
      }
    });
  }, [supabase, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      toast('error', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      toast('error', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast('error', error.message);
      return;
    }

    toast('success', 'Password updated successfully.');
    window.location.href = '/dashboard';
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <p className="font-body text-charcoal text-sm">Verifying reset link&hellip;</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="font-heading text-3xl text-charcoal text-center mb-8">
          Set New Password
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-border-subtle rounded-lg bg-white font-body"
            required
            minLength={6}
            autoFocus
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-3 border border-border-subtle rounded-lg bg-white font-body"
            required
            minLength={6}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-terra text-white py-3 rounded-lg font-body disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <p className="font-body text-charcoal text-sm">Loading&hellip;</p>
      </div>
    }>
      <UpdatePasswordForm />
    </Suspense>
  );
}
