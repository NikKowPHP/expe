import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const email = 'dev@dev.dev';
  const password = 'asdfgh';

  console.log(`Creating user ${email}...`);

  // 1. Sign Up
  let { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    console.log('Signup message:', authError.message);
    // Continue to login if user already exists
  }
  
  // 2. Sign In to get session
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError) {
      console.error('Login failed:', loginError.message);
      return;
  }

  const user = loginData.user;
  if (!user) {
      console.error('No user after login');
      return;
  }
  
  console.log('User authenticated:', user.id);

  // 3. Wait for triggers to create defaults
  // The database has triggers that run ON INSERT to profiles/categories
  console.log('Checking for default categories and accounts...');
  
  // Simple retry loop to wait for triggers
  let categories: any[] | null = [];
  let accounts: any[] | null = [];
  
  for (let i = 0; i < 5; i++) {
    const c = await supabase.from('categories').select('*').eq('user_id', user.id);
    const a = await supabase.from('accounts').select('*').eq('user_id', user.id);
    categories = c.data;
    accounts = a.data;
    
    if (categories && categories.length > 0 && accounts && accounts.length > 0) {
        break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const cashAccount = accounts?.find((a: any) => a.name === 'Cash');
  const foodCat = categories?.find((c: any) => c.name === 'Food');
  const transportCat = categories?.find((c: any) => c.name === 'Transport');
  const housingCat = categories?.find((c: any) => c.name === 'Housing');
  const shoppingCat = categories?.find((c: any) => c.name === 'Shopping');
  
  if (!cashAccount || !foodCat) {
      console.error('Defaults not created properly via triggers. Check database logs.');
      return;
  }

  console.log('Seeding expenses...');
  
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const twoDaysAgo = new Date(Date.now() - 172800000);
  const lastWeek = new Date(Date.now() - 604800000);

  const expenses = [
      {
          user_id: user.id,
          account_id: cashAccount.id,
          category_id: foodCat.id,
          amount: 45.50,
          note: 'Weekly Groceries at Biedronka',
          date: today.toISOString(),
      },
      {
          user_id: user.id,
          account_id: cashAccount.id,
          category_id: transportCat?.id || foodCat.id,
          amount: 4.20,
          note: 'Bus Ticket to Center',
          date: yesterday.toISOString(),
      },
      {
          user_id: user.id,
          account_id: cashAccount.id,
          category_id: housingCat?.id || foodCat.id,
          amount: 2500.00,
          note: 'Monthly Rent',
          date: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(), // 1st of month
      },
      {
          user_id: user.id,
          account_id: cashAccount.id,
          category_id: shoppingCat?.id || foodCat.id,
          amount: 129.99,
          note: 'New Headphones',
          date: lastWeek.toISOString(),
      },
      {
        user_id: user.id,
        account_id: cashAccount.id,
        category_id: foodCat.id,
        amount: 12.50,
        note: 'Lunch at work',
        date: twoDaysAgo.toISOString(),
    }
  ];

  const { error: expError } = await supabase.from('expenses').insert(expenses);
  if (expError) console.error('Error inserting expenses:', expError);
  else console.log(`Seeded ${expenses.length} expenses.`);

  console.log('Seeding completed successfully.');
}

seed().catch(console.error);