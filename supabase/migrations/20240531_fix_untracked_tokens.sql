-- Drop existing constraints if they exist
DO $$ 
BEGIN
  -- Drop the wallet_address + contract_address composite constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'untracked_tokens_wallet_contract_key'
    AND table_name = 'untracked_tokens'
  ) THEN
    ALTER TABLE public.untracked_tokens
    DROP CONSTRAINT untracked_tokens_wallet_contract_key;
  END IF;

  -- Drop the contract_address unique constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'untracked_tokens_contract_address_key'
    AND table_name = 'untracked_tokens'
  ) THEN
    ALTER TABLE public.untracked_tokens
    DROP CONSTRAINT untracked_tokens_contract_address_key;
  END IF;
END $$;

-- Drop and recreate the table to ensure clean state
DROP TABLE IF EXISTS public.untracked_tokens;

-- Create the untracked_tokens table
CREATE TABLE public.untracked_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_address TEXT NOT NULL,
  symbol TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  present_trades BOOLEAN DEFAULT FALSE,
  current_price DECIMAL,
  total_supply DECIMAL,
  token_uri TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add a constraint to ensure wallet_address + contract_address combination is unique
  CONSTRAINT untracked_tokens_wallet_contract_key UNIQUE (wallet_address, contract_address)
);

-- Enable RLS
ALTER TABLE public.untracked_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view untracked tokens" 
  ON public.untracked_tokens
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert untracked tokens" 
  ON public.untracked_tokens
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update untracked tokens" 
  ON public.untracked_tokens
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete untracked tokens" 
  ON public.untracked_tokens
  FOR DELETE
  USING (true);

-- Grant permissions
GRANT ALL ON public.untracked_tokens TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_untracked_tokens_wallet 
ON public.untracked_tokens(wallet_address);

CREATE INDEX IF NOT EXISTS idx_untracked_tokens_contract 
ON public.untracked_tokens(contract_address); 