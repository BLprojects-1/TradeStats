# Supabase Setup for Journi App

This guide explains how to set up the required Supabase database tables and policies for the Journi app.

## Database Setup

1. Go to your Supabase dashboard for your project
2. Navigate to the SQL Editor
3. Create a new query and paste the contents of the `supabase/migrations/20240529_create_user_tables.sql` file
4. Run the query to create the necessary tables and policies

## Tables Created

### 1. User Profiles Table

This table stores user display names and is linked to the Supabase auth.users table:

```sql
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Tracked Wallets Table

This table stores the Solana wallet addresses that users want to track:

```sql
CREATE TABLE IF NOT EXISTS public.tracked_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add a constraint to ensure wallet addresses are unique per user
  CONSTRAINT unique_wallet_per_user UNIQUE (user_id, wallet_address)
);
```

## Row Level Security

The SQL script also sets up Row Level Security (RLS) policies to ensure users can only access their own data:

- Users can view, insert, and update their own profile
- Users can view, insert, update, and delete their own tracked wallets

## Onboarding Helper Function

A helper function `has_completed_onboarding` is created to check if a user has completed the onboarding process:

```sql
CREATE OR REPLACE FUNCTION public.has_completed_onboarding(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Next Steps

After running the SQL script, the application will be able to:

1. Check if a user has completed onboarding
2. Store user display names (what to call them)
3. Store and manage tracked wallet addresses
4. Enforce security so users can only access their own data 