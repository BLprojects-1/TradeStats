# Supabase Configuration for TICKR

This directory contains SQL scripts and utilities to set up and fix Supabase for the TICKR application.

## Database Setup

### Required Tables

The TICKR application requires two main tables:

1. `user_profiles` - Stores user display names and profile information
2. `tracked_wallets` - Stores wallet addresses connected to each user

### Initial Setup

To create these tables and their required indexes, run:

```sql
-- From the Supabase SQL Editor
-- Use the file: supabase/verify-tables.sql
```

## Common Issues

### 401 Unauthorized Error

If you encounter 401 Unauthorized errors when trying to create user profiles or save wallet addresses, it's likely due to Row Level Security (RLS) policies not being configured correctly.

This error usually appears as:
```
Auth user check failed: Invalid API key
```

Or in your network tab as:
```
Status Code: 401 Unauthorized
/rest/v1/user_profiles POST request failed
```

### Fixing the Issue

There are three ways to fix this:

#### Option 1: Using the SQL Editor (Standard Fix)

1. Log into your Supabase dashboard
2. Go to the SQL Editor
3. Run the contents of `migrations/20240529_fix_rls_policies.sql`

#### Option 2: Using the SQL Editor (Advanced Fix)

1. Log into your Supabase dashboard
2. Go to the SQL Editor
3. First run the contents of `migrations/20240529_fix_rls_policies.sql`
4. Then run the contents of `migrations/20240529_fix_rls_auth_issue.sql` which specifically fixes the 401 unauthorized error

#### Option 3: Permissive Reset (Development/Testing Only)

If you're still experiencing 401 errors after trying options 1 and 2, there's a more permissive approach:

1. Log into your Supabase dashboard
2. Go to the SQL Editor
3. Run the contents of `migrations/20240529_rls_permissions_reset.sql`

**Note:** This creates very permissive RLS policies for testing purposes. It's not recommended for production use.

#### Option 4: Using the Fix Script

1. Make sure you have PostgreSQL client tools installed
2. Make the script executable:
   ```
   chmod +x fix-permissions.sh
   ```
3. Run the script:
   ```
   ./fix-permissions.sh
   ```
4. Choose the fix approach (Standard, Advanced, or Permissive Reset)
5. Follow the prompts to enter your Supabase URL and service role key

The script will apply the selected fix to your Supabase project.

## Migrations

This directory contains the following key migrations:

- `20240529_create_user_tables.sql` - Creates the initial database tables
- `20240529_fix_rls_policies.sql` - Creates basic RLS policies
- `20240529_fix_rls_auth_issue.sql` - Fixes specific auth issues causing 401 errors
- `20240529_rls_permissions_reset.sql` - Creates permissive policies for testing (not for production)

## How RLS Works in Supabase

Row Level Security (RLS) in Supabase restricts which rows a user can access in a table. For TICKR:

1. Each user should only see their own profile and wallet data
2. Policies use `auth.uid()` to get the current user's ID
3. Rows are filtered based on the user ID matching

The fix expands these policies to ensure proper access for authenticated users for all operations (SELECT, INSERT, UPDATE, DELETE).

## Testing Authentication

To verify that authentication is working:

1. Login to your application
2. Check browser console logs for session information 
3. Verify that the session contains a valid user ID
4. Attempt to create a profile and add wallets

If issues persist after applying the fixes, check the browser console for more specific error messages. 