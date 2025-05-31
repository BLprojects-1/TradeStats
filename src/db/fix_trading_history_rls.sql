-- Fix Row Level Security for trading_history table
-- This script adds proper RLS policies to allow users to access their own trading data

-- Enable RLS on trading_history if not already enabled
ALTER TABLE trading_history ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own trading history" ON trading_history;
DROP POLICY IF EXISTS "Users can insert their own trading history" ON trading_history;
DROP POLICY IF EXISTS "Users can update their own trading history" ON trading_history;
DROP POLICY IF EXISTS "Users can delete their own trading history" ON trading_history;

-- Create RLS policies for trading_history table
-- Users can view their own trading history through their wallets
CREATE POLICY "Users can view their own trading history" 
  ON trading_history 
  FOR SELECT
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

-- Users can insert trading history for their own wallets
CREATE POLICY "Users can insert their own trading history" 
  ON trading_history 
  FOR INSERT
  WITH CHECK (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

-- Users can update trading history for their own wallets
CREATE POLICY "Users can update their own trading history" 
  ON trading_history 
  FOR UPDATE
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

-- Users can delete trading history for their own wallets
CREATE POLICY "Users can delete their own trading history" 
  ON trading_history 
  FOR DELETE
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

-- Grant necessary permissions to authenticated users
GRANT ALL ON trading_history TO authenticated;

-- Also ensure wallets table has proper RLS (needed for the policies above)
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for wallets table if they don't exist
DROP POLICY IF EXISTS "Users can view their own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can insert their own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can update their own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can delete their own wallets" ON wallets;

CREATE POLICY "Users can view their own wallets" 
  ON wallets 
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own wallets" 
  ON wallets 
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own wallets" 
  ON wallets 
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own wallets" 
  ON wallets 
  FOR DELETE
  USING (user_id = auth.uid());

-- Grant necessary permissions to authenticated users
GRANT ALL ON wallets TO authenticated;

-- Create indexes for better performance with RLS
CREATE INDEX IF NOT EXISTS idx_trading_history_wallet_user 
ON trading_history(wallet_id);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id 
ON wallets(user_id);

-- Test the policies work by creating a function to test access
CREATE OR REPLACE FUNCTION test_trading_history_access(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_count INTEGER;
  v_trade_count INTEGER;
  v_starred_count INTEGER;
BEGIN
  -- Count wallets for user
  SELECT COUNT(*) INTO v_wallet_count
  FROM wallets 
  WHERE user_id = p_user_id;
  
  -- Count total trades for user's wallets
  SELECT COUNT(*) INTO v_trade_count
  FROM trading_history th
  JOIN wallets w ON w.id = th.wallet_id
  WHERE w.user_id = p_user_id;
  
  -- Count starred trades for user's wallets
  SELECT COUNT(*) INTO v_starred_count
  FROM trading_history th
  JOIN wallets w ON w.id = th.wallet_id
  WHERE w.user_id = p_user_id AND th.starred = true;
  
  RETURN format(
    'User %s has %s wallets, %s total trades, %s starred trades',
    p_user_id, v_wallet_count, v_trade_count, v_starred_count
  );
END;
$$; 