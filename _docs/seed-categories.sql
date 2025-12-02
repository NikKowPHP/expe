-- Seed Default Categories for Expense Tracking
-- Run this script in your Supabase SQL Editor after creating a user account
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users table

-- You can get your user ID by running:
-- SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- Define predefined UUIDs for default categories
-- These UUIDs are consistent across all users for easier category management
-- Format: [category-name]-0000-0000-0000-000000000000

INSERT INTO public.categories (id, user_id, name, icon, type, color, is_default, created_at)
VALUES
  -- Food & Dining
  ('6068fe4a-1af3-482e-8700-3b16082f9a3a', /* YOUR_USER_ID */ auth.uid(), 'Food', 'coffee', 'expense', 'bg-orange-100 text-orange-600', true, now()),
  
  -- Transportation
  ('6068fe4a-1af3-482e-8700-3b16082f9a3a', /* YOUR_USER_ID */ auth.uid(), 'Transport', 'bus', 'expense', 'bg-blue-100 text-blue-600', true, now()),
  
  -- Shopping
  ('6068fe4a-1af3-482e-8700-3b16082f9a3a', /* YOUR_USER_ID */ auth.uid(), 'Shopping', 'shopping-cart', 'expense', 'bg-purple-100 text-purple-600', true, now()),
  
  -- Housing
  ('6068fe4a-1af3-482e-8700-3b16082f9a3a', /* YOUR_USER_ID */ auth.uid(), 'Housing', 'home', 'expense', 'bg-green-100 text-green-600', true, now()),
  
  -- Utilities
  ('6068fe4a-1af3-482e-8700-3b16082f9a3a', /* YOUR_USER_ID */ auth.uid(), 'Utilities', 'zap', 'expense', 'bg-yellow-100 text-yellow-600', true, now()),
  
  -- Health & Wellness
  ('6068fe4a-1af3-482e-8700-3b16082f9a3a', /* YOUR_USER_ID */ auth.uid(), 'Health', 'heart', 'expense', 'bg-red-100 text-red-600', true, now()),
  
  -- Work & Business
  ('6068fe4a-1af3-482e-8700-3b16082f9a3a', /* YOUR_USER_ID */ auth.uid(), 'Work', 'briefcase', 'expense', 'bg-slate-100 text-slate-600', true, now()),
  
  -- Miscellaneous
  ('6068fe4a-1af3-482e-8700-3b16082f9a3a', /* YOUR_USER_ID */ auth.uid(), 'Other', 'more-horizontal', 'expense', 'bg-gray-100 text-gray-600', true, now())
ON CONFLICT (id) DO NOTHING;
