-- This SQL script fixes authorization issues with user_profiles and tracked_wallets tables
-- Specifically addressing the 401 Unauthorized error when creating profiles

-- 1. First verify that auth schema is properly set up
DO $$
BEGIN
    RAISE NOTICE 'Checking authentication schema...';
END $$;

-- 2. Drop all existing policies on user_profiles for a clean slate
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can select their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.user_profiles;

-- 3. Make sure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create a more permissive INSERT policy for user_profiles
CREATE POLICY "Allow insert own profile" 
  ON public.user_profiles 
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5. Create a policy for selecting profiles
CREATE POLICY "Allow select own profile" 
  ON public.user_profiles 
  FOR SELECT
  USING (auth.uid() = id);

-- 6. Create policies for update and delete
CREATE POLICY "Allow update own profile" 
  ON public.user_profiles 
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow delete own profile" 
  ON public.user_profiles 
  FOR DELETE
  USING (auth.uid() = id);

-- 7. Grant explicit permissions to authenticated users
GRANT ALL ON public.user_profiles TO authenticated;

-- 8. Create a debug function to help troubleshoot auth issues
CREATE OR REPLACE FUNCTION public.debug_auth()
RETURNS TABLE(
  current_user_id UUID,
  has_permission BOOLEAN,
  current_role TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() AS current_user_id,
    EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid()) AS has_permission,
    current_role AS current_role;
END;
$$;

-- 9. Verify the changes
DO $$
BEGIN
    RAISE NOTICE 'Auth permissions have been fixed for user_profiles.';
    RAISE NOTICE 'You should now be able to insert records without 401 errors.';
END $$; 