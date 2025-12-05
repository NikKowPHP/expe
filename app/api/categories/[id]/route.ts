import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, icon, color } = body;

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (icon !== undefined) updates.icon = icon;
  if (color !== undefined) updates.color = color;

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Check if category is default
  const { data: category } = await supabase
    .from('categories')
    .select('is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (category?.is_default) {
    return NextResponse.json(
      { error: 'Cannot delete default categories' },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    // Check for foreign key constraint violation
    if (error.code === '23503') { // Postgres code for foreign_key_violation
      return NextResponse.json(
        { error: 'Cannot delete this category because it contains expenses. Please reassign or delete the expenses first.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
