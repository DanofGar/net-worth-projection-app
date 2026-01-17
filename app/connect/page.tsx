'use client';

import { TellerConnect } from 'teller-connect-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function ConnectPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [accountCount, setAccountCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Check authentication and fetch account count
  useEffect(() => {
    async function checkAuthAndAccounts() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Not authenticated - redirect to login
        router.push('/login');
        return;
      }

      setIsAuthenticated(true);

      // Fetch account count
      try {
        const response = await fetch('/api/accounts');
        if (response.ok) {
          const accounts = await response.json();
          setAccountCount(accounts.length || 0);
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndAccounts();
  }, [router, supabase]);

  const handleSuccess = async (authorization: any) => {
    try {
      // Send to API to store enrollment + fetch accounts
      const response = await fetch('/api/teller/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authorization),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error('Failed to connect account');
      }
      
      router.push('/onboarding/accounts');
    } catch (error) {
      console.error('Error connecting account:', error);
      alert(`Failed to connect account: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't redirect on error - let user try again
    }
  };

  // Show loading state while checking auth
  if (loading || isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-body text-charcoal/60">Loading...</p>
      </div>
    );
  }

  // Determine back link and messaging based on auth state
  const backLink = isAuthenticated ? '/dashboard' : '/landing';
  const heading = accountCount === 0 
    ? 'Connect your first account'
    : 'Connect another account';
  const description = accountCount === 0
    ? 'Securely link your bank account to start tracking your financial projections.'
    : 'Add another bank account to get a complete view of your finances.';

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-8">
      <div className="text-center max-w-2xl w-full">
        {/* Back Button */}
        <div className="mb-8 text-left">
          <Link
            href={backLink}
            className="inline-flex items-center font-body text-charcoal/70 hover:text-charcoal transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isAuthenticated ? 'Back to dashboard' : 'Back to home'}
          </Link>
        </div>

        <h1 className="font-heading text-4xl md:text-5xl text-charcoal mb-4">
          {heading}
        </h1>
        <p className="font-body text-lg text-charcoal/70 mb-8">
          {description}
        </p>
        
        <div className="inline-block mb-6">
          <TellerConnect
            applicationId={process.env.NEXT_PUBLIC_TELLER_APP_ID!}
            environment={process.env.NEXT_PUBLIC_TELLER_ENV as any}
            products={['balance', 'verify']}
            onSuccess={handleSuccess}
            onError={(error) => {
              console.error('TellerConnect error:', error);
            }}
            onExit={() => {
              console.log('User exited');
            }}
          >
            <span className="bg-terra text-white px-10 py-4 rounded-lg font-body text-lg font-medium inline-block cursor-pointer hover:opacity-90 transition-opacity shadow-lg">
              Connect Bank Account
            </span>
          </TellerConnect>
        </div>
        
        <p className="font-body text-sm text-charcoal/60 max-w-md mx-auto">
          Can't find your bank? You can also connect using routing and account numbers through the verification flow.
        </p>
      </div>
    </div>
  );
}
