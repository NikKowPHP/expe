-- TRANSFERS
create table public.transfers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  from_account_id uuid references public.accounts not null,
  to_account_id uuid references public.accounts not null,
  amount numeric(12, 2) not null,
  note text,
  date timestamp with time zone not null default now(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone,
  sync_status text default 'synced'
);

alter table public.transfers enable row level security;

create policy "Users can view their own transfers" on transfers
  for select using (auth.uid() = user_id);

create policy "Users can insert their own transfers" on transfers
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own transfers" on transfers
  for update using (auth.uid() = user_id);

create policy "Users can delete their own transfers" on transfers
  for delete using (auth.uid() = user_id);
