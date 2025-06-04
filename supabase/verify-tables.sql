-- Function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(tablename TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = tablename
  );
END;
$$ LANGUAGE plpgsql;

-- Check for user_profiles table
DO $$
BEGIN
  IF NOT table_exists('user_profiles') THEN
    RAISE NOTICE 'Creating user_profiles table...';
    
    -- Create user profiles table
    CREATE TABLE public.user_profiles (
      id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Enable RLS
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policy
    CREATE POLICY "Users can manage their own profile" 
      ON public.user_profiles 
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
    
    -- Grant permissions
    GRANT ALL ON public.user_profiles TO authenticated;
    
    RAISE NOTICE 'user_profiles table created successfully.';
  ELSE
    RAISE NOTICE 'user_profiles table already exists.';
  END IF;
END $$;

-- Check for tracked_wallets table
DO $$
BEGIN
  IF NOT table_exists('tracked_wallets') THEN
    RAISE NOTICE 'Creating tracked_wallets table...';
    
    -- Create tracked wallets table
    CREATE TABLE public.tracked_wallets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      wallet_address TEXT NOT NULL,
      label TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      -- Add a constraint to ensure wallet addresses are unique per user
      CONSTRAINT unique_wallet_per_user UNIQUE (user_id, wallet_address)
    );
    
    -- Enable RLS
    ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policy
    CREATE POLICY "Users can manage their own wallets" 
      ON public.tracked_wallets
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    
    -- Grant permissions
    GRANT ALL ON public.tracked_wallets TO authenticated;
    
    RAISE NOTICE 'tracked_wallets table created successfully.';
  ELSE
    RAISE NOTICE 'tracked_wallets table already exists.';
  END IF;
END $$;

-- Create or update onboarding check function
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

-- Print summary
DO $$
BEGIN
  RAISE NOTICE '---------------------------------------';
  RAISE NOTICE 'Database verification complete!';
  RAISE NOTICE '---------------------------------------';
  RAISE NOTICE 'Tables required for TICKR:';
  RAISE NOTICE '- user_profiles: %', CASE WHEN table_exists('user_profiles') THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '- tracked_wallets: %', CASE WHEN table_exists('tracked_wallets') THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '---------------------------------------';
  RAISE NOTICE 'If any tables are missing, run the SQL again.';
  RAISE NOTICE '---------------------------------------';
END $$; 