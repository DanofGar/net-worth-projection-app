'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string;
  last_four: string | null;
  is_liquid: boolean;
}

export default function AccountsPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuthAndFetchAccounts() {
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Fetch accounts
      try {
        const response = await fetch('/api/accounts');
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch accounts');
        }
        const data = await response.json();
        setAccounts(data || []);
      } catch (error) {
        console.error('Error fetching accounts:', error);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndFetchAccounts();
  }, [router, supabase]);

  const handleContinue = () => {
    router.push('/onboarding/credit-cards');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-body text-charcoal">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-4xl text-charcoal mb-2">
          Your Accounts
        </h1>
        <p className="font-body text-charcoal/70 mb-8">
          We found {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected to your bank.
        </p>

        <div className="space-y-4 mb-8">
          {accounts.map((account, index) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white border border-border-subtle rounded-lg p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-body text-lg text-charcoal font-medium">
                    {account.name}
                  </h3>
                  <p className="font-body text-sm text-charcoal/60">
                    {account.subtype} {account.last_four ? `•••• ${account.last_four}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-body text-sm text-charcoal/60">
                    {account.is_liquid ? 'Liquid' : 'Retirement'}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleContinue}
          className="w-full bg-terra text-white px-8 py-3 rounded-lg font-body text-lg"
        >
          Continue
        </motion.button>
      </div>
    </div>
  );
}
