'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { toast } from '@/app/components/Toast';

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    setLoading(false);

    if (error) {
      toast('error', error.message);
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="font-heading text-3xl text-charcoal text-center mb-2">
          Reset Password
        </h1>

        {submitted ? (
          <div className="text-center space-y-4">
            <p className="font-body text-charcoal text-sm">
              Check your email for a password reset link. It may take a minute to arrive.
            </p>
            <Link
              href="/login"
              className="block text-charcoal font-body text-sm underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="font-body text-charcoal text-sm text-center mb-8">
              Enter your email and we will send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-border-subtle rounded-lg bg-white font-body"
                required
                autoFocus
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-terra text-white py-3 rounded-lg font-body disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="text-charcoal font-body text-sm underline"
              >
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
