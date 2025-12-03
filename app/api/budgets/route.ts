import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', user.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { category_id, amount, month, year } = body;

  if (!category_id || !amount || !month || !year) {
    return NextResponse.json(
      { error: 'Missing required fields: category_id, amount, month, year' },
      { status: 400 }
    );
  }

  // Validate month and year
  if (month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Month must be between 1 and 12' },
      { status: 400 }
    );
  }

  if (amount <= 0) {
    return NextResponse.json(
      { error: 'Amount must be greater than 0' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('budgets')
    .upsert({
      user_id: user.id,
      category_id,
      amount,
      month,
      year,
    }, {
      onConflict: 'user_id, category_id, month, year'
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
