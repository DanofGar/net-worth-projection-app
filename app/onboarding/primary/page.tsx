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
  is_primary_payment: boolean;
}

export default function PrimaryPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
        const allAccounts = await response.json();
        const depositoryAccounts = allAccounts.filter((acc: any) => acc.type === 'depository');
        setAccounts(depositoryAccounts);
        const primary = depositoryAccounts.find((acc: any) => acc.is_primary_payment);
        if (primary) {
          setSelectedId(primary.id);
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndFetchAccounts();
  }, [router, supabase]);

  const handleSelect = async (accountId: string) => {
    // Update state only after database operations succeed
    try {
      // Clear all primary flags
      const { error: clearError } = await supabase
        .from('accounts')
        .update({ is_primary_payment: false })
        .eq('type', 'depository');

      if (clearError) {
        console.error('Failed to clear primary flags:', clearError);
        alert('Failed to update primary account. Please try again.');
        return;
      }

      // Set selected account as primary
      const { error: setError } = await supabase
        .from('accounts')
        .update({ is_primary_payment: true })
        .eq('id', accountId);

      if (setError) {
        console.error('Failed to set primary account:', setError);
        alert('Failed to update primary account. Please try again.');
        return;
      }

      // Only update UI state after successful database operations
      setSelectedId(accountId);
    } catch (error) {
      console.error('Error updating primary account:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleContinue = () => {
    router.push('/dashboard');
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
          Primary Payment Account
        </h1>
        <p className="font-body text-charcoal/70 mb-8">
          Which account do you use for most payments? This will be used for cash flow projections.
        </p>

        <div className="space-y-4 mb-8">
          {accounts.map((account, index) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleSelect(account.id)}
              className={`bg-white border-2 rounded-lg p-6 shadow-sm cursor-pointer transition-all ${
                selectedId === account.id
                  ? 'border-terra bg-terra/5'
                  : 'border-border-subtle hover:border-terra/50'
              }`}
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
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedId === account.id
                      ? 'border-terra bg-terra'
                      : 'border-border-subtle'
                  }`}
                >
                  {selectedId === account.id && (
                    <div className="w-3 h-3 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleContinue}
          disabled={!selectedId}
          className={`w-full px-8 py-3 rounded-lg font-body text-lg ${
            selectedId
              ? 'bg-terra text-white'
              : 'bg-border-subtle text-charcoal/40 cursor-not-allowed'
          }`}
        >
          Complete Setup
        </motion.button>
      </div>
    </div>
  );
}
