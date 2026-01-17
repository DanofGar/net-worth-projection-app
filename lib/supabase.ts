import { createClient } from '@supabase/supabase-js';
import { createBrowserClient as createBrowserClientSSR, createServerClient as createServerClientSSR } from '@supabase/ssr';

// Environment validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
}
if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not set');
}

// Client-side singleton (for use in Client Components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client component helper (for use in 'use client' components with auth)
export const createBrowserClient = () => createBrowserClientSSR(supabaseUrl, supabaseAnonKey);

// Server component helper (for use in Server Components / Route Handlers)
export const createServerClient = async () => {
  // Lazy import to avoid importing in client components
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  
  return createServerClientSSR(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Components, but may fail in middleware
          }
        },
      },
    }
  );
};

// Admin client (bypasses RLS - use only in server-side code / scheduled functions)
export const supabaseAdmin = (() => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseServiceKey) {
    if (typeof window === 'undefined') {
      throw new Error('SUPABASE_SERVICE_KEY environment variable is not set');
    }
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return createClient(supabaseUrl, supabaseServiceKey);
})();

// Type helper for database schema
export type Database = {
  public: {
    Tables: {
      enrollments: {
        Row: {
          id: string;
          user_id: string;
          teller_enrollment_id: string;
          access_token: string;
          institution: string;
          institution_name: string;
          created_at: string;
          last_polled_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['enrollments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['enrollments']['Insert']>;
      };
      accounts: {
        Row: {
          id: string;
          enrollment_id: string;
          teller_account_id: string;
          name: string;
          type: 'depository' | 'credit';
          subtype: string;
          last_four: string | null;
          is_liquid: boolean;
          is_primary_payment: boolean;
          payment_day_of_month: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>;
      };
      balances: {
        Row: {
          id: string;
          account_id: string;
          ledger: number;
          available: number | null;
          polled_at: string;
        };
        Insert: Omit<Database['public']['Tables']['balances']['Row'], 'id' | 'polled_at'>;
        Update: Partial<Database['public']['Tables']['balances']['Insert']>;
      };
      recurring_rules: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          amount: number;
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'once';
          anchor_date: string;
          end_date: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['recurring_rules']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['recurring_rules']['Insert']>;
      };
    };
  };
};
