-- EMERGENCY DATABASE TABLE RESET
-- This script recreates the database tables from scratch
-- USE WITH CAUTION - will delete all data in the tables!

-- 1. Drop existing tables (comment this out if you want to keep your data)
DROP TABLE IF EXISTS public.tracked_wallets;
DROP TABLE IF EXISTS public.user_profiles;

-- 2. Create tables with correct schema
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.tracked_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add a constraint to ensure wallet addresses are unique per user
  CONSTRAINT unique_wallet_per_user UNIQUE (user_id, wallet_address)
);

-- 3. Grant permissions
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.tracked_wallets TO authenticated;

-- 4. Enable but disable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;

-- 5. Create extremely permissive policies
CREATE POLICY "emergency_all_access_profiles" 
  ON public.user_profiles 
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "emergency_all_access_wallets" 
  ON public.tracked_wallets 
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Test the setup by checking what auth.uid() returns
SELECT 
  auth.uid() as current_user_id,
  current_setting('role') as current_role; 