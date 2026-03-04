import { NextResponse } from 'next/server';
import { supabaseAdmin, createServerClient } from '@/lib/supabase';
import { tellerFetch } from '@/lib/teller';

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's enrollments
  const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
    .from('enrollments')
    .select('id, access_token, institution_name')
    .eq('user_id', user.id);

  if (enrollmentsError) {
    return NextResponse.json({ error: enrollmentsError.message }, { status: 500 });
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ error: 'No enrollments found' }, { status: 404 });
  }

  let successCount = 0;
  let errorCount = 0;

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

          if (balanceError) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch {
          errorCount++;
        }
      }

      await supabaseAdmin
        .from('enrollments')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', enrollment.id);
    } catch (err) {
      errorCount++;
      if (err instanceof Error && err.message.includes('401')) {
        return NextResponse.json(
          { error: 'Bank connection expired. Please reconnect.' },
          { status: 401 }
        );
      }
    }
  }

  return NextResponse.json({ success: successCount, errors: errorCount });
}
