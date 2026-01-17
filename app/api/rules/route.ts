import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { recurringRuleSchema } from '@/lib/validations';

// GET /api/rules - List all rules for authenticated user
export async function GET() {
  const supabase = await createServerClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/rules - Create a new rule
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = recurringRuleSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ 
      error: 'Validation failed', 
      details: validation.error.flatten() 
    }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('recurring_rules')
    .insert({
      ...validation.data,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
