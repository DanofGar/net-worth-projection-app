import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/accounts - List all accounts for authenticated user with latest balances
export async function GET() {
  const supabase = await createServerClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch accounts (RLS will filter by user through enrollments)
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, name, type, subtype, last_four, is_liquid, is_primary_payment, payment_day_of_month')
    .order('created_at', { ascending: true });

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  // Fetch latest balance for each account
  const accountsWithBalances = await Promise.all(
    (accounts || []).map(async (account) => {
      const { data: balanceData, error: balanceError } = await supabase
        .from('balances')
        .select('ledger')
        .eq('account_id', account.id)
        .order('polled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...account,
        latest_balance: balanceData?.ledger ? parseFloat(balanceData.ledger.toString()) : 0,
      };
    })
  );

  return NextResponse.json(accountsWithBalances);
}
