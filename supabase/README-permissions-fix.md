# Fixing Supabase Permissions Issue

If you encounter **401 Unauthorized** errors when trying to create user profiles or add wallet addresses, the issue is related to Row Level Security (RLS) policies in Supabase.

## How to Fix

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and run the SQL from the file `20240529_fix_rls_policies.sql`

This SQL script will:

1. Drop existing restrictive policies
2. Create more permissive policies that work correctly with authenticated users
3. Grant explicit permissions to authenticated users
4. Recreate the helper function

## Why This Works

The original RLS policies were too restrictive and may not have been correctly detecting the authenticated user. The new policies are simpler and give authenticated users full access to their own data.

## The main changes are:

1. Consolidating separate policies (insert, select, update, delete) into single policies that handle all operations
2. Adding explicit GRANT statements to ensure authenticated users have permissions
3. Using simpler policy conditions that are more reliable

## Testing the Fix

After applying the SQL fix:

1. Log out and log back in to your application
2. Try creating a new profile and adding wallets
3. Check the Supabase database tables to confirm data is being stored correctly

If problems persist, check the browser console for specific error messages that might provide more information about the issue. 