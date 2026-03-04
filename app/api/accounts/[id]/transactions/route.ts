import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, createServerClient } from '@/lib/supabase';
import { tellerFetchTransactions } from '@/lib/teller';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const count = parseInt(searchParams.get('count') || '50', 10);
  const from_id = searchParams.get('from_id') || undefined;

  // Verify account belongs to user and get teller IDs
  const { data: account, error: accountError } = await supabaseAdmin
    .from('accounts')
    .select('teller_account_id, enrollment_id, enrollments!inner(user_id, access_token)')
    .eq('id', id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const enrollment = (account as any).enrollments;
  if (enrollment.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const transactions = await tellerFetchTransactions(
      account.teller_account_id,
      enrollment.access_token,
      { count, from_id }
    );
    return NextResponse.json(transactions);
  } catch (err) {
    if (err instanceof Error && err.message.includes('401')) {
      return NextResponse.json(
        { error: 'Bank connection expired. Reconnect your account.' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
