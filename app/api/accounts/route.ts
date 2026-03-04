import { NextResponse } from 'next/server';
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

  // Batch fetch latest balances for all accounts
  const accountIds = (accounts || []).map(a => a.id);
  const { data: balancesData, error: balancesError } = await supabase
    .from('balances')
    .select('account_id, ledger, polled_at')
    .in('account_id', accountIds)
    .order('polled_at', { ascending: false });

  if (balancesError) {
    return NextResponse.json({ error: balancesError.message }, { status: 500 });
  }

  // Deduplicate: keep only the latest balance per account
  const latestBalances = new Map<string, number>();
  for (const balance of balancesData || []) {
    if (!latestBalances.has(balance.account_id)) {
      latestBalances.set(balance.account_id, parseFloat(balance.ledger.toString()));
    }
  }

  const accountsWithBalances = (accounts || []).map(account => ({
    ...account,
    latest_balance: latestBalances.get(account.id) ?? 0,
  }));

  return NextResponse.json(accountsWithBalances);
}
