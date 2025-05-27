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

-- Add initial_scan_complete column if it doesn't exist
ALTER TABLE public.tracked_wallets 
ADD COLUMN IF NOT EXISTS initial_scan_complete BOOLEAN DEFAULT FALSE;

-- Update any NULL values to FALSE
UPDATE public.tracked_wallets 
SET initial_scan_complete = FALSE 
WHERE initial_scan_complete IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_scan_status 
ON public.tracked_wallets(initial_scan_complete);

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

-- Add stored procedure to force update initial_scan_complete
CREATE OR REPLACE FUNCTION public.force_mark_wallet_scanned(
  p_wallet_address TEXT,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE public.tracked_wallets
  SET 
    initial_scan_complete = TRUE,
    updated_at = NOW()
  WHERE 
    wallet_address = p_wallet_address
    AND user_id = p_user_id
  RETURNING TRUE INTO v_updated;

  -- Log the update attempt
  INSERT INTO public.debug_logs (
    operation,
    wallet_address,
    user_id,
    success,
    error_message,
    created_at
  ) VALUES (
    'force_mark_wallet_scanned',
    p_wallet_address,
    p_user_id,
    COALESCE(v_updated, FALSE),
    CASE WHEN v_updated THEN NULL ELSE 'Update failed' END,
    NOW()
  );

  RETURN COALESCE(v_updated, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create debug logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation TEXT NOT NULL,
  wallet_address TEXT,
  user_id UUID,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.force_mark_wallet_scanned(TEXT, UUID) TO authenticated;

-- Enable RLS on debug_logs but allow all authenticated users to view
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated users to view logs"
  ON public.debug_logs
  FOR SELECT
  USING (auth.role() = 'authenticated'); 