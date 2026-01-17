import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, createServerClient } from '@/lib/supabase';
import { tellerFetch } from '@/lib/teller';

export async function POST(req: NextRequest) {
  // Get authenticated user
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accessToken, enrollment } = await req.json();

  // 1. Store enrollment with user_id
  const { data: enrollmentRow, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .upsert({
      teller_enrollment_id: enrollment.id,
      access_token: accessToken,
      institution: enrollment.institution.id,
      institution_name: enrollment.institution.name,
      user_id: user.id,
    }, { onConflict: 'teller_enrollment_id' })
    .select()
    .single();

  if (enrollmentError) {
    return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
  }

  // 2. Fetch accounts from Teller
  const accounts = await tellerFetch('/accounts', accessToken);

  // 3. Store accounts
  for (const acc of accounts) {
    const isLiquid = !['ira', 'roth_ira', '401k', '403b', '529'].includes(acc.subtype);
    
    const { error: upsertError } = await supabaseAdmin.from('accounts').upsert({
      enrollment_id: enrollmentRow.id,
      teller_account_id: acc.id,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      last_four: acc.last_four,
      is_liquid: isLiquid,
    }, { onConflict: 'teller_account_id' });

    if (upsertError) {
      console.error(`Failed to upsert account ${acc.id}:`, upsertError);
      // Continue with other accounts even if one fails
      continue;
    }
  }

  // 4. Fetch initial balances
  for (const acc of accounts) {
    try {
      const balances = await tellerFetch(`/accounts/${acc.id}/balances`, accessToken);
      
      const { data: accountRow, error: accountError } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('teller_account_id', acc.id)
        .maybeSingle();

      if (accountError) {
        console.error(`Failed to find account ${acc.id}:`, accountError);
        continue;
      }

      if (accountRow) {
        const { error: balanceError } = await supabaseAdmin.from('balances').insert({
          account_id: accountRow.id,
          ledger: parseFloat(balances.ledger),
          available: balances.available ? parseFloat(balances.available) : null,
        });

        if (balanceError) {
          console.error(`Failed to insert balance for account ${acc.id}:`, balanceError);
        }
      }
    } catch (error) {
      console.error(`Error fetching balance for account ${acc.id}:`, error);
      // Continue with other accounts even if one fails
    }
  }

  return NextResponse.json({ success: true });
}
