-- Add items column to expenses table to store receipt line items
alter table public.expenses 
add column if not exists items jsonb;

comment on column public.expenses.items is 'List of line items from receipt parsing: [{description, amount}]';
