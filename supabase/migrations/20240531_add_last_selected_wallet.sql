-- Add last_selected_wallet_id column to user_profiles table
-- This will store the user's last selected wallet for persistence across sessions

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS last_selected_wallet_id UUID REFERENCES public.tracked_wallets(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_selected_wallet 
ON public.user_profiles(last_selected_wallet_id);

-- Add a comment to document the column
COMMENT ON COLUMN public.user_profiles.last_selected_wallet_id IS 'References the users last selected wallet for persistence across sessions'; 