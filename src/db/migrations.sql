-- Create users table (if not already created by Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  initial_scan_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, address)
);

-- Create slots table for tracking last fetched slot per wallet
CREATE TABLE IF NOT EXISTS slots (
  wallet_id UUID PRIMARY KEY REFERENCES wallets(id) ON DELETE CASCADE,
  last_slot BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notes table for trade annotations
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trading_history table
CREATE TABLE IF NOT EXISTS trading_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  block_time BIGINT NOT NULL,
  type TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_logo_uri TEXT,
  decimals INTEGER NOT NULL,
  amount DECIMAL NOT NULL,
  price_sol DECIMAL,
  price_usd DECIMAL,
  value_sol DECIMAL,
  value_usd DECIMAL,
  profit_loss DECIMAL,
  market_cap DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_id, signature)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_wallet_id ON notes(wallet_id);
CREATE INDEX IF NOT EXISTS idx_notes_signature ON notes(signature);
CREATE INDEX IF NOT EXISTS idx_trading_history_wallet_id ON trading_history(wallet_id);
CREATE INDEX IF NOT EXISTS idx_trading_history_timestamp ON trading_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_trading_history_signature ON trading_history(signature);
CREATE INDEX IF NOT EXISTS idx_trading_history_wallet_timestamp ON trading_history(wallet_id, timestamp DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for slots table
CREATE TRIGGER update_slots_updated_at
  BEFORE UPDATE ON slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for trading_history table
CREATE TRIGGER update_trading_history_updated_at
  BEFORE UPDATE ON trading_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 