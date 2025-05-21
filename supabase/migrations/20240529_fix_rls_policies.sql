-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can manage their own wallets" ON public.tracked_wallets;
DROP POLICY IF EXISTS "Users can view their own wallets" ON public.tracked_wallets;
DROP POLICY IF EXISTS "Users can insert their own wallets" ON public.tracked_wallets;
DROP POLICY IF EXISTS "Users can update their own wallets" ON public.tracked_wallets;
DROP POLICY IF EXISTS "Users can delete their own wallets" ON public.tracked_wallets;

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;

-- Create individual policies for user_profiles with more explicit permissions
CREATE POLICY "Users can select their own profile" 
  ON public.user_profiles 
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.user_profiles 
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.user_profiles 
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile" 
  ON public.user_profiles 
  FOR DELETE
  USING (auth.uid() = id);

-- Create individual policies for tracked_wallets
CREATE POLICY "Users can select their own wallets" 
  ON public.tracked_wallets 
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallets" 
  ON public.tracked_wallets 
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallets" 
  ON public.tracked_wallets 
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wallets" 
  ON public.tracked_wallets 
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.tracked_wallets TO authenticated;

-- Refresh function with SECURITY DEFINER
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