-- =========================================================
-- WARNING: THIS SCRIPT CREATES HIGHLY PERMISSIVE SECURITY POLICIES
-- =========================================================
-- 
-- This script is intended for development and testing purposes ONLY.
-- DO NOT use this configuration in production environments.
--
-- The policies created by this script allow any authenticated user
-- to perform ANY operation on the database tables. This is useful for
-- troubleshooting 401 errors but creates serious security risks.
--
-- After confirming your application works with these settings,
-- implement more restrictive policies that limit users to accessing
-- only their own data.
-- =========================================================

-- This script completely resets and rebuilds permissions for the TICKR app tables
-- It addresses the 401 Unauthorized issue with a more permissive approach

-- 1. First disable RLS temporarily to ensure we can reset everything
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_wallets DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies with ANY name pattern
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Drop all policies on user_profiles
  FOR policy_record IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', policy_record.policyname);
    RAISE NOTICE 'Dropped policy % on user_profiles', policy_record.policyname;
  END LOOP;
  
  -- Drop all policies on tracked_wallets
  FOR policy_record IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'tracked_wallets' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tracked_wallets', policy_record.policyname);
    RAISE NOTICE 'Dropped policy % on tracked_wallets', policy_record.policyname;
  END LOOP;
END $$;

-- 3. Grant full permissions to the authenticated role
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.tracked_wallets TO authenticated;

-- 4. Re-enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;

-- 5. Create a very permissive policy for authenticated users (for initial testing)
CREATE POLICY "TICKR_auth_users_full_access" 
  ON public.user_profiles 
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "TICKR_auth_users_full_access" 
  ON public.tracked_wallets 
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Create a debug view to check what's happening with auth
DROP VIEW IF EXISTS auth_debug;
CREATE VIEW auth_debug AS
SELECT 
  current_setting('request.jwt.claims', true)::json as jwt_claims,
  auth.uid() as current_user_id,
  (SELECT count(*) FROM auth.users WHERE id = auth.uid()) as user_exists_in_auth,
  current_user as database_user,
  current_setting('role') as current_role;

-- 7. Log the completion
DO $$
BEGIN
    RAISE NOTICE 'Security policies have been completely reset with permissive access.';
    RAISE NOTICE 'This configuration should be used for initial testing only.';
    RAISE NOTICE 'After confirming the app works, apply more restrictive policies.';
END $$; 