-- Add deleted_at to expenses for soft deletes
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- RECURRING EXPENSES
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  category_id uuid REFERENCES public.categories,
  amount numeric(12, 2) NOT NULL,
  description text,
  frequency text CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')) NOT NULL,
  next_due_date date NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring expenses" ON recurring_expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring expenses" ON recurring_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring expenses" ON recurring_expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring expenses" ON recurring_expenses
  FOR DELETE USING (auth.uid() = user_id);
