# Fixing 401 Unauthorized Errors in TradeStats

This guide addresses the 401 Unauthorized error that may occur when trying to save user profiles or wallet addresses in TradeStats.

## The Problem

When making POST requests to Supabase tables like `user_profiles`, you may encounter:

```
Status Code: 401 Unauthorized
```

This occurs due to Row Level Security (RLS) policy issues in Supabase, where the authenticated user doesn't have proper permissions to insert data.

## Solution Approaches

There are three different approaches to fix this issue, from standard to more permissive.

### Approach 1: Standard RLS Fix

This approach creates basic RLS policies that should work in most cases:

1. Run the `fix-permissions.sh` script and select option 1 (Standard fix)
2. Or directly run the SQL in `supabase/migrations/20240529_fix_rls_policies.sql`

The standard fix:
- Grants basic permissions to authenticated users
- Creates policies that allow users to access their own data
- Maintains a reasonable level of security

### Approach 2: Advanced Auth-Specific Fix

If the standard fix doesn't resolve the issue, this approach creates more explicit policies:

1. Run the `fix-permissions.sh` script and select option 2 (Advanced fix)
2. Or run both `20240529_fix_rls_policies.sql` and `20240529_fix_rls_auth_issue.sql`

The advanced fix:
- Creates separate policies for SELECT, INSERT, UPDATE, and DELETE operations
- Adds a debug function to help diagnose auth issues
- Makes the INSERT policy slightly more permissive

### Approach 3: Permissive Reset (Development/Testing Only)

If all else fails, this approach creates maximally permissive policies:

1. Run the `fix-permissions.sh` script and select option 3 (Permissive reset)
2. Or run `20240529_rls_permissions_reset.sql` directly

**⚠️ Warning**: This approach is for development and testing only! It:
- Temporarily disables RLS and resets all policies
- Creates extremely permissive policies that allow any authenticated user to do anything
- Creates debugging tools to inspect authentication

Once you confirm the app works with permissive settings, you should implement more restrictive policies.

## Debugging Tools

The app now includes several debugging tools to help you diagnose auth issues:

1. **Debug Panel in OnboardingForm**: Click "Show Debug Tools" when an error occurs
2. **Auth Diagnostics**: Runs comprehensive checks on your auth session
3. **JWT Token Inspector**: Examines your JWT token directly
4. **Supabase SQL Debugging**: Query the `auth_debug` view in the SQL Editor:
   ```sql
   SELECT * FROM auth_debug;
   ```

## Common Causes of 401 Errors

1. **Mismatched User IDs**: The user ID in the JWT doesn't match the one being used
2. **Expired Tokens**: The JWT token has expired (though the error would be different)
3. **RLS Policy Issues**: The policies don't properly allow the operation
4. **Role Permission Issues**: The authenticated role doesn't have table permissions

## After Fixing

After applying any of these fixes, you should:

1. Sign out and sign back in to get a fresh JWT token
2. Clear browser cache and reload the application
3. Try the operation again

If issues persist, use the debug tools to gather more information about what's happening. 