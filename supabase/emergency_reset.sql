-- EMERGENCY RESET for 401 Unauthorized Error
-- Run this in the Supabase SQL Editor if you're still having issues

-- 1. Disable RLS entirely for the session
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_wallets DISABLE ROW LEVEL SECURITY;

-- 2. Delete any existing policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Delete all policies on user_profiles
  FOR policy_record IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', policy_record.policyname);
  END LOOP;
  
  -- Delete all policies on tracked_wallets
  FOR policy_record IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'tracked_wallets' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tracked_wallets', policy_record.policyname);
  END LOOP;
END $$;

-- 3. Grant permissions to authenticated users
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.tracked_wallets TO authenticated;

-- 4. Enable RLS but with a policy that allows everything
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;

-- 5. Create super permissive policies with unique names
CREATE POLICY "emergency_reset_policy_profiles" 
  ON public.user_profiles 
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "emergency_reset_policy_wallets" 
  ON public.tracked_wallets 
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Test what user we're running as
SELECT 
  auth.uid() as current_user_id,
  current_user as database_user,
  current_setting('role') as current_role; 