'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function HomePage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push('/dashboard');
      } else {
        router.push('/landing');
      }
    }

    checkAuth();
  }, [router, supabase]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <p className="font-body text-charcoal/60">Redirecting...</p>
    </div>
  );
}
