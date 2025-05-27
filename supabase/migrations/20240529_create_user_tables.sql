-- Create user profiles table to store user display names
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tracked wallets table to store user wallet addresses
CREATE TABLE IF NOT EXISTS public.tracked_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  label TEXT,
  initial_scan_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add a constraint to ensure wallet addresses are unique per user
  CONSTRAINT unique_wallet_per_user UNIQUE (user_id, wallet_address)
);

-- Set up Row Level Security for the tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view their own profile" 
  ON public.user_profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.user_profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.user_profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Policies for tracked_wallets
CREATE POLICY "Users can view their own wallets" 
  ON public.tracked_wallets FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallets" 
  ON public.tracked_wallets FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallets" 
  ON public.tracked_wallets FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wallets" 
  ON public.tracked_wallets FOR DELETE 
  USING (auth.uid() = user_id);

-- Create function to check if a user has completed onboarding
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