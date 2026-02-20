'use client';

import { createBrowserClient } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    // Session was established server-side by /auth/callback before redirect here.
    // Just verify a session exists.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        setError('Reset link is invalid or has expired. Request a new one.');
      }
    });
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  if (!ready && !error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <p className="font-body text-charcoal">Verifying reset link...</p>
      </div>
    );
  }

  if (error && !ready) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-red-600 font-body">{error}</p>
          <a href="/login" className="text-charcoal font-body text-sm underline block">Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="font-heading text-3xl text-charcoal text-center mb-8">Set New Password</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block font-body text-sm text-charcoal/60 mb-1">New password</label>
            <input
              id="new-password"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-border-subtle rounded-lg bg-white font-body"
              required
              minLength={6}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block font-body text-sm text-charcoal/60 mb-1">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              placeholder="••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 border border-border-subtle rounded-lg bg-white font-body"
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-red-600 text-sm font-body">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-terra text-white py-3 rounded-lg font-body disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
