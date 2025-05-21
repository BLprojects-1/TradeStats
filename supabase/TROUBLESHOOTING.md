# Supabase Authentication Troubleshooting Guide

This document provides a detailed analysis of authentication issues that might be encountered with Supabase in the Journi app.

## Understanding 401 Unauthorized Errors

A 401 Unauthorized error when making requests to Supabase endpoints can occur for several reasons:

1. **Invalid or expired JWT token**
2. **Row Level Security (RLS) policy issues**
3. **Missing permissions for the authenticated role**
4. **Database schema issues**

## Analyzing Your 401 Error

Based on the network request information you provided, here's what we know:

- You're making a POST request to `/rest/v1/user_profiles`
- You have both an `apikey` (anon key) and an `authorization` Bearer token
- The error occurs despite having what appears to be valid authentication

## Root Causes and Solutions

### 1. JWT Verification Issues

The JWT token in your request (`Bearer eyJhbGciOiJIUzI1NiIsImt...`) may not be correctly verified by Supabase.

**Solution:** The specific auth fix SQL we provided ensures that the RLS policies properly check `auth.uid()`, which is how Supabase identifies the current user from the JWT.

### 2. RLS Policy Configuration

The Row Level Security policies need to be specifically configured to allow INSERT operations for the authenticated user on their own profile.

**Solution:** Our improved RLS policies in `20240529_fix_rls_auth_issue.sql` create more explicit policies using the proper format, separating each operation.

### 3. Role Permissions

Even with RLS policies, the `authenticated` role needs explicit permissions on the table.

**Solution:** We've added a `GRANT ALL ON public.user_profiles TO authenticated;` command to ensure the role has the necessary permissions.

### 4. Token Verification In the JWT

Sometimes Supabase has issues verifying JWT tokens due to:
- JWT not issued by the same Supabase project
- Missing claims in the JWT
- Token format issues

**Solution:** The debug function `public.debug_auth()` can help identify the current user ID from the token and confirm permissions.

## Step-by-Step Verification

If you continue to experience issues after applying the fixes, you can run this diagnostic query in the Supabase SQL Editor:

```sql
SELECT * FROM public.debug_auth();
```

This will show:
1. The current user ID extracted from the auth token
2. Whether that user has permission to access the user_profiles table
3. The current database role being used

## Common Patterns for Fixing 401 Errors

1. Apply the SQL fix files we've provided
2. Verify the JWT token isn't expired by logging out and back in
3. Check that your client's Supabase configuration is using the correct API keys
4. Ensure your RLS policies allow operations by the authenticated user on their own data
5. Explicitly grant permissions to the authenticated role

## If Problems Persist

1. Create a simple SELECT query on user_profiles or tracked_wallets in the SQL Editor
2. Look at the Supabase logs in the dashboard
3. Check for any errors in the auth.users table
4. Verify the foreign key relationship between auth.users and your custom tables

## Persistent 401 Errors

If you've tried all the standard fixes and are still getting 401 Unauthorized errors, there is a more drastic approach available:

### The Permissive Reset Approach

For development and testing purposes only, we've included a permissive reset option that:

1. Temporarily disables Row Level Security
2. Drops all existing policies
3. Creates new, extremely permissive policies
4. Creates debugging tools to inspect authentication

This approach is **not recommended for production** but can help identify if the issue is with the RLS policies themselves or with another aspect of your setup.

To apply this fix:

1. Run the fix-permissions.sh script and select option 3
2. Or run the SQL file directly: `supabase/migrations/20240529_rls_permissions_reset.sql`

After confirming that your application works with these permissive settings, you should implement more restrictive policies once you understand the issue.

### Understanding JWT Authentication Issues

Based on your logs, we can see that the JWT token contains:
- User ID: `b38e8420-e26b-4cd4-bc81-4ebb574a87ca`
- Role: `authenticated`
- Issuer: `https://hfxvnajwwhlqnfjfdqwi.supabase.co/auth/v1`

This appears to be a correctly formatted token that should work. Potential issues could be:

1. The JWT token isn't being processed correctly by Supabase's RLS system
2. There may be an issue with how the token is being passed to specific endpoints
3. There could be a mismatch between the user ID in the token and in the database

The permissive reset approach helps identify which of these is causing the problem. 