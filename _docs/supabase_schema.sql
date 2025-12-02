-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  currency text default 'USD',
  updated_at timestamp with time zone
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- CATEGORIES
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  icon text not null, -- Store as string (e.g., "coffee", "bus")
  type text check (type in ('income', 'expense')) default 'expense',
  color text,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.categories enable row level security;

create policy "Users can view their own categories" on categories
  for select using (auth.uid() = user_id);

create policy "Users can insert their own categories" on categories
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own categories" on categories
  for update using (auth.uid() = user_id);

create policy "Users can delete their own categories" on categories
  for delete using (auth.uid() = user_id);

-- EXPENSES
create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  category_id uuid references public.categories,
  amount numeric(12, 2) not null,
  note text,
  date date not null default CURRENT_DATE,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.expenses enable row level security;

create policy "Users can view their own expenses" on expenses
  for select using (auth.uid() = user_id);

create policy "Users can insert their own expenses" on expenses
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own expenses" on expenses
  for update using (auth.uid() = user_id);

create policy "Users can delete their own expenses" on expenses
  for delete using (auth.uid() = user_id);

-- BUDGETS
create table public.budgets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  category_id uuid references public.categories,
  amount numeric(12, 2) not null,
  month integer not null, -- 1-12
  year integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, category_id, month, year)
);

alter table public.budgets enable row level security;

create policy "Users can view their own budgets" on budgets
  for select using (auth.uid() = user_id);

create policy "Users can insert their own budgets" on budgets
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own budgets" on budgets
  for update using (auth.uid() = user_id);

create policy "Users can delete their own budgets" on budgets
  for delete using (auth.uid() = user_id);
