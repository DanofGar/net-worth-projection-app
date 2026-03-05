'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

interface CreditCard {
  id: string;
  name: string;
  last_four: string | null;
  payment_day_of_month: number | null;
}

export default function CreditCardsPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuthAndFetchCreditCards() {
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      // Fetch credit cards
      try {
        const response = await fetch('/api/accounts');
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch accounts');
        }
        const accounts = await response.json() as (CreditCard & { subtype: string })[];
        const creditCardAccounts = accounts.filter((acc) => acc.subtype === 'credit_card');
        setCreditCards(
          creditCardAccounts.map((acc) => ({
            id: acc.id,
            name: acc.name,
            last_four: acc.last_four,
            payment_day_of_month: acc.payment_day_of_month,
          }))
        );
      } catch (error) {
        console.error('Error fetching credit cards:', error);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndFetchCreditCards();
  }, [router, supabase]);

  const handleDayChange = async (cardId: string, day: number) => {
    const response = await fetch(`/api/accounts/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_day_of_month: day }),
    });
    if (response.ok) {
      setCreditCards(prev =>
        prev.map(card =>
          card.id === cardId ? { ...card, payment_day_of_month: day } : card
        )
      );
    }
  };

  const handleContinue = () => {
    router.push('/onboarding/primary');
  };

  const handleSkip = () => {
    router.push('/onboarding/primary');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-body text-charcoal/60">Loading credit cards...</p>
      </div>
    );
  }

  if (creditCards.length === 0) {
    return (
      <div className="min-h-screen bg-cream p-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/onboarding/accounts" className="inline-flex items-center font-body text-charcoal/70 hover:text-charcoal transition-colors mb-8">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="font-heading text-4xl text-charcoal mb-2">
            Credit Card Payments
          </h1>
          <p className="font-body text-charcoal/70 mb-8">
            No credit cards found. You can skip this step.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSkip}
            className="w-full bg-terra text-white px-8 py-3 rounded-lg font-body text-lg"
          >
            Continue
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/onboarding/accounts" className="inline-flex items-center font-body text-charcoal/70 hover:text-charcoal transition-colors mb-8">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <h1 className="font-heading text-4xl text-charcoal mb-2">
          Credit Card Payments
        </h1>
        <p className="font-body text-charcoal/70 mb-8">
          When do your credit cards charge autopay each month?
        </p>

        <div className="space-y-6 mb-8">
          {creditCards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white border border-border-subtle rounded-lg p-6 shadow-sm"
            >
              <h3 className="font-body text-lg text-charcoal font-medium mb-4">
                {card.name} {card.last_four ? `•••• ${card.last_four}` : ''}
              </h3>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <button
                    key={day}
                    onClick={() => handleDayChange(card.id, day)}
                    className={`w-full px-1.5 py-1.5 rounded font-body text-xs transition-colors ${
                      card.payment_day_of_month === day
                        ? 'bg-terra text-white'
                        : 'bg-cream text-charcoal hover:bg-border-subtle'
                    }`}
                  >
                    {day}
                  </button>
                ))}
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
