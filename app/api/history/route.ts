import { NextResponse } from 'next/server';
import { supabaseAdmin, createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's enrollments
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id);

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json([]);
  }

  const enrollmentIds = enrollments.map(e => e.id);

  // Get all accounts with type and is_liquid
  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id, type, is_liquid')
    .in('enrollment_id', enrollmentIds);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json([]);
  }

  const accountIds = accounts.map(a => a.id);
  const accountMap = new Map(accounts.map(a => [a.id, a]));

  // Fetch all balances
  const { data: balances, error: balancesError } = await supabaseAdmin
    .from('balances')
    .select('account_id, ledger, polled_at')
    .in('account_id', accountIds)
    .order('polled_at', { ascending: true });

  if (balancesError) {
    return NextResponse.json({ error: balancesError.message }, { status: 500 });
  }

  // Group by date, compute net worth and liquid net worth per day
  const dailyMap = new Map<string, { netWorth: number; liquidNetWorth: number; latestByAccount: Map<string, number> }>();

  for (const b of balances || []) {
    const date = b.polled_at.split('T')[0];
    if (!dailyMap.has(date)) {
      // Carry forward previous day's latest balances
      const prevEntries = [...dailyMap.values()];
      const prevLatest = prevEntries.length > 0
        ? new Map(prevEntries[prevEntries.length - 1].latestByAccount)
        : new Map<string, number>();
      dailyMap.set(date, { netWorth: 0, liquidNetWorth: 0, latestByAccount: prevLatest });
    }
    const day = dailyMap.get(date)!;
    day.latestByAccount.set(b.account_id, parseFloat(b.ledger.toString()));
  }

  // Compute totals from latest balances per account for each day
  const result = Array.from(dailyMap.entries()).map(([date, day]) => {
    let netWorth = 0;
    let liquidNetWorth = 0;

    for (const [accountId, balance] of day.latestByAccount) {
      const acc = accountMap.get(accountId);
      if (!acc) continue;

      const value = acc.type === 'credit' ? -balance : balance;
      netWorth += value;
      if (acc.is_liquid) {
        liquidNetWorth += value;
      }
    }

    return {
      date,
      netWorth: Math.round(netWorth * 100) / 100,
      liquidNetWorth: Math.round(liquidNetWorth * 100) / 100,
    };
  });

  return NextResponse.json(result);
}
