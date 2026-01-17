import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateProjection, ViewMode, Scope } from '@/lib/projection';
import { projectionQuerySchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse query params
  const { searchParams } = new URL(req.url);
  const validation = projectionQuerySchema.safeParse({
    days: searchParams.get('days'),
    viewMode: searchParams.get('viewMode'),
    scope: searchParams.get('scope'),
  });

  if (!validation.success) {
    return NextResponse.json({
      error: 'Invalid parameters',
      details: validation.error.flatten(),
    }, { status: 400 });
  }

  const { days, viewMode, scope } = validation.data;

  try {
    const projection = await generateProjection(
      user.id,
      days,
      viewMode as ViewMode,
      scope as Scope
    );

    return NextResponse.json(projection);
  } catch (err) {
    console.error('Projection error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Projection failed' },
      { status: 500 }
    );
  }
}
