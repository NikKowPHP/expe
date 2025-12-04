-- Add account_id to expenses

-- ACCOUNTS
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  type text CHECK (type IN ('cash', 'bank', 'credit')) NOT NULL,
  balance numeric(12, 2) DEFAULT 0,
  currency text DEFAULT 'USD',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Function to seed default account for new users
CREATE OR REPLACE FUNCTION public.seed_user_account()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.accounts (user_id, name, type, balance, currency)
  VALUES (new.id, 'Cash', 'cash', 0, 'USD');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to seed account after user profile creation
CREATE TRIGGER on_user_profile_created_account
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.seed_user_account();
