import { NextResponse } from 'next/server';
import { supabaseAdmin, createServerClient } from '@/lib/supabase';
import { tellerFetch } from '@/lib/teller';

// POST /api/accounts/refresh
// Fetches latest balances from Teller for all user enrollments and stores them.
export async function POST() {
  const supabase = await createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch user's enrollments
  const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
    .from('enrollments')
    .select('id, access_token, institution_name')
    .eq('user_id', user.id);

  if (enrollmentsError) {
    return NextResponse.json({ error: enrollmentsError.message }, { status: 500 });
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ refreshed: 0, message: 'No accounts to refresh' });
  }

  let refreshed = 0;
  let failed = 0;

  for (const enrollment of enrollments) {
    try {
      const tellerAccounts = await tellerFetch('/accounts', enrollment.access_token);

      for (const tellerAccount of tellerAccounts) {
        const { data: accountRow } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('teller_account_id', tellerAccount.id)
          .maybeSingle();

        if (!accountRow) continue;

        try {
          const balance = await tellerFetch(
            `/accounts/${tellerAccount.id}/balances`,
            enrollment.access_token
          );

          const { error: balanceError } = await supabaseAdmin.from('balances').insert({
            account_id: accountRow.id,
            ledger: parseFloat(balance.ledger),
            available: balance.available ? parseFloat(balance.available) : null,
          });

          if (!balanceError) refreshed++;
          else failed++;
        } catch {
          failed++;
        }
      }

      await supabaseAdmin
        .from('enrollments')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', enrollment.id);
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ refreshed, failed });
}
