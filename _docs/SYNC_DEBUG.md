# Sync Debugging Guide

## Step 1: Run SQL Migration

**CRITICAL**: You MUST run this SQL in Supabase first:

```sql
-- File: _docs/accounts_migration.sql
-- Execute this in Supabase SQL Editor
```

Without this, the `accounts` table doesn't exist and sync will fail.

## Step 2: Check Browser Console

1. Open your app
2. Press F12 to open DevTools
3. Go to Console tab
4. Look for these messages:

```
[SYNC] Starting sync for user: <user_id>
[SYNC] Syncing accounts...
[SYNC] Pushing X pending accounts
[SYNC] Successfully pushed account: <name>
[SYNC] Sync completed successfully
```

## Step 3: Common Issues

### Error: "relation 'accounts' does not exist"
**Fix**: Run the SQL migration in Supabase

### Error: "Failed to sync account"
**Fix**: Check Supabase RLS policies are correct

### No sync messages at all
**Fix**: Check AuthGuard is passing user authentication

## Step 4: Manual Sync Test

1. Open Browser Console
2. Create an account in Settings
3. Check Dexie (F12 → Application → IndexedDB → ExpenseTrackerDB → accounts)
4. Look for `sync_status: 'pending'`
5. Refresh the page (this triggers sync)
6. Check console for sync logs
7. Verify in Supabase Dashboard → Table Editor → accounts

## Step 5: Verify Supabase

1. Go to Supabase Dashboard
2. Click "Table Editor"
3. Look for `accounts` table
4. Check if your account appears there

## Quick Fix Commands

```bash
# If needed, rebuild
npm run dev
```
