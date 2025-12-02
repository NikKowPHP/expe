-- Migration: Add default categories for existing users
-- Run this in your Supabase SQL Editor to seed categories for users who registered before the trigger was added

-- This script will add default categories for all users who don't have any categories yet
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM public.profiles
    LOOP
        -- Check if user already has categories
        IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = user_record.id) THEN
            -- Insert default categories for this user
            INSERT INTO public.categories (user_id, name, icon, type, color, is_default)
            VALUES
                (user_record.id, 'Food', 'coffee', 'expense', 'bg-orange-100 text-orange-600', true),
                (user_record.id, 'Transport', 'bus', 'expense', 'bg-blue-100 text-blue-600', true),
                (user_record.id, 'Shopping', 'shopping-cart', 'expense', 'bg-purple-100 text-purple-600', true),
                (user_record.id, 'Housing', 'home', 'expense', 'bg-green-100 text-green-600', true),
                (user_record.id, 'Utilities', 'zap', 'expense', 'bg-yellow-100 text-yellow-600', true),
                (user_record.id, 'Health', 'heart', 'expense', 'bg-red-100 text-red-600', true),
                (user_record.id, 'Work', 'briefcase', 'expense', 'bg-slate-100 text-slate-600', true),
                (user_record.id, 'Other', 'more-horizontal', 'expense', 'bg-gray-100 text-gray-600', true);
            
            RAISE NOTICE 'Added default categories for user %', user_record.id;
        END IF;
    END LOOP;
END $$;
