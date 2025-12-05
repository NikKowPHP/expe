-- Create subcategories table
create table if not exists public.subcategories (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  created_at timestamp with time zone not null default now(),
  sync_status text default 'synced'
);

-- Enable RLS
alter table public.subcategories enable row level security;

-- Policies
create policy "Users can view their own subcategories"
  on public.subcategories for select
  using (auth.uid() = user_id);

create policy "Users can insert their own subcategories"
  on public.subcategories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own subcategories"
  on public.subcategories for update
  using (auth.uid() = user_id);

create policy "Users can delete their own subcategories"
  on public.subcategories for delete
  using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_subcategories_user_id on public.subcategories(user_id);
create index if not exists idx_subcategories_category_id on public.subcategories(category_id);
