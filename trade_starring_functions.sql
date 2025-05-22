-- SQL Functions for Trade Starring Operations
-- These functions provide enhanced functionality for managing starred trades

-- Function to get all starred trades for a user with pagination
CREATE OR REPLACE FUNCTION get_user_starred_trades(
  p_user_id UUID,
  p_wallet_address TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  trade_id UUID,
  wallet_address TEXT,
  signature TEXT,
  "timestamp" TIMESTAMPTZ,
  type TEXT,
  token_symbol TEXT,
  token_address TEXT,
  token_logo_uri TEXT,
  amount DECIMAL,
  decimals INTEGER,
  price_usd DECIMAL,
  value_usd DECIMAL,
  profit_loss DECIMAL,
  notes TEXT,
  tags TEXT,
  starred_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    th.id as trade_id,
    w.address as wallet_address,
    th.signature,
    th.timestamp,
    th.type,
    th.token_symbol,
    th.token_address,
    th.token_logo_uri,
    th.amount,
    th.decimals,
    th.price_usd,
    th.value_usd,
    th.profit_loss,
    th.notes,
    th.tags,
    th.updated_at as starred_at
  FROM trading_history th
  JOIN wallets w ON w.id = th.wallet_id
  WHERE w.user_id = p_user_id
    AND th.starred = TRUE
    AND (p_wallet_address IS NULL OR w.address = p_wallet_address)
  ORDER BY th.updated_at DESC
  LIMIT p_limit 
  OFFSET p_offset;
END;
$$;

-- Function to toggle starred status with audit trail
CREATE OR REPLACE FUNCTION toggle_trade_starred(
  p_wallet_id UUID,
  p_signature TEXT,
  p_starred BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_trade_exists BOOLEAN;
  v_old_starred BOOLEAN;
BEGIN
  -- Check if trade exists and get current starred status
  SELECT EXISTS(
    SELECT 1 FROM trading_history 
    WHERE wallet_id = p_wallet_id AND signature = p_signature
  ), COALESCE(starred, FALSE)
  INTO v_trade_exists, v_old_starred
  FROM trading_history 
  WHERE wallet_id = p_wallet_id AND signature = p_signature;
  
  -- If trade doesn't exist, return false
  IF NOT v_trade_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Only update if the starred status is actually changing
  IF v_old_starred != p_starred THEN
    UPDATE trading_history 
    SET starred = p_starred,
        updated_at = NOW()
    WHERE wallet_id = p_wallet_id AND signature = p_signature;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to bulk star/unstar trades by criteria
CREATE OR REPLACE FUNCTION bulk_star_trades(
  p_user_id UUID,
  p_wallet_address TEXT,
  p_starred BOOLEAN,
  p_token_address TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_trade_type TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Get wallet ID
  SELECT id INTO v_wallet_id 
  FROM wallets 
  WHERE user_id = p_user_id AND address = p_wallet_address;
  
  IF v_wallet_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Update trades based on criteria
  UPDATE trading_history 
  SET starred = p_starred,
      updated_at = NOW()
  WHERE wallet_id = v_wallet_id
    AND (p_token_address IS NULL OR token_address = p_token_address)
    AND (p_date_from IS NULL OR timestamp >= p_date_from)
    AND (p_date_to IS NULL OR timestamp <= p_date_to)
    AND (p_trade_type IS NULL OR type = p_trade_type)
    AND starred != p_starred; -- Only update if status is different
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- Function to get starred trades count by token
CREATE OR REPLACE FUNCTION get_starred_trades_by_token(
  p_user_id UUID,
  p_wallet_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  token_address TEXT,
  token_symbol TEXT,
  starred_count BIGINT,
  total_value_usd DECIMAL,
  avg_profit_loss DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    th.token_address,
    th.token_symbol,
    COUNT(*) as starred_count,
    SUM(th.value_usd) as total_value_usd,
    AVG(th.profit_loss) as avg_profit_loss
  FROM trading_history th
  JOIN wallets w ON w.id = th.wallet_id
  WHERE w.user_id = p_user_id
    AND th.starred = TRUE
    AND (p_wallet_address IS NULL OR w.address = p_wallet_address)
  GROUP BY th.token_address, th.token_symbol
  ORDER BY starred_count DESC, total_value_usd DESC;
END;
$$;

-- Function to get starred trades summary for dashboard
CREATE OR REPLACE FUNCTION get_starred_trades_summary(
  p_user_id UUID,
  p_wallet_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_starred BIGINT,
  total_value_usd DECIMAL,
  most_starred_token TEXT,
  recent_starred_count BIGINT,
  avg_profit_loss DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH starred_stats AS (
    SELECT 
      COUNT(*) as total_starred,
      SUM(th.value_usd) as total_value_usd,
      AVG(th.profit_loss) as avg_profit_loss,
      COUNT(*) FILTER (WHERE th.updated_at >= NOW() - INTERVAL '7 days') as recent_starred_count
    FROM trading_history th
    JOIN wallets w ON w.id = th.wallet_id
    WHERE w.user_id = p_user_id
      AND th.starred = TRUE
      AND (p_wallet_address IS NULL OR w.address = p_wallet_address)
  ),
  most_starred AS (
    SELECT th.token_symbol
    FROM trading_history th
    JOIN wallets w ON w.id = th.wallet_id
    WHERE w.user_id = p_user_id
      AND th.starred = TRUE
      AND (p_wallet_address IS NULL OR w.address = p_wallet_address)
    GROUP BY th.token_symbol
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  SELECT 
    ss.total_starred,
    ss.total_value_usd,
    ms.token_symbol as most_starred_token,
    ss.recent_starred_count,
    ss.avg_profit_loss
  FROM starred_stats ss
  CROSS JOIN most_starred ms;
END;
$$;

-- Function to find and star similar trades
CREATE OR REPLACE FUNCTION star_similar_trades(
  p_user_id UUID,
  p_wallet_address TEXT,
  p_reference_signature TEXT,
  p_similarity_criteria TEXT DEFAULT 'token' -- 'token', 'profit_range', 'time_range'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id UUID;
  v_ref_trade trading_history%ROWTYPE;
  v_updated_count INTEGER := 0;
BEGIN
  -- Get wallet ID
  SELECT id INTO v_wallet_id 
  FROM wallets 
  WHERE user_id = p_user_id AND address = p_wallet_address;
  
  IF v_wallet_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get reference trade
  SELECT * INTO v_ref_trade
  FROM trading_history
  WHERE wallet_id = v_wallet_id AND signature = p_reference_signature;
  
  IF v_ref_trade.id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Star similar trades based on criteria
  CASE p_similarity_criteria
    WHEN 'token' THEN
      UPDATE trading_history 
      SET starred = TRUE, updated_at = NOW()
      WHERE wallet_id = v_wallet_id
        AND token_address = v_ref_trade.token_address
        AND starred = FALSE
        AND signature != p_reference_signature;
        
    WHEN 'profit_range' THEN
      UPDATE trading_history 
      SET starred = TRUE, updated_at = NOW()
      WHERE wallet_id = v_wallet_id
        AND profit_loss BETWEEN (v_ref_trade.profit_loss * 0.8) AND (v_ref_trade.profit_loss * 1.2)
        AND starred = FALSE
        AND signature != p_reference_signature;
        
    WHEN 'time_range' THEN
      UPDATE trading_history 
      SET starred = TRUE, updated_at = NOW()
      WHERE wallet_id = v_wallet_id
        AND timestamp BETWEEN (v_ref_trade.timestamp - INTERVAL '1 hour') AND (v_ref_trade.timestamp + INTERVAL '1 hour')
        AND starred = FALSE
        AND signature != p_reference_signature;
  END CASE;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- Indexes for better performance on starred trades queries
-- These will only be created if the starred column exists
DO $$
BEGIN
    -- Check if starred column exists before creating indexes
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trading_history' 
        AND column_name = 'starred'
    ) THEN
        -- Create indexes only if starred column exists
        CREATE INDEX IF NOT EXISTS idx_trading_history_starred_wallet_updated 
        ON trading_history(wallet_id, starred, updated_at DESC) WHERE starred = TRUE;

        CREATE INDEX IF NOT EXISTS idx_trading_history_starred_token 
        ON trading_history(token_address, starred) WHERE starred = TRUE;

        CREATE INDEX IF NOT EXISTS idx_trading_history_starred_timestamp 
        ON trading_history(timestamp, starred) WHERE starred = TRUE;
        
        RAISE NOTICE 'Created indexes for starred trades functionality';
    ELSE
        RAISE NOTICE 'Starred column does not exist yet - skipping index creation';
    END IF;
END $$;

-- Comments for documentation
COMMENT ON FUNCTION get_user_starred_trades IS 'Retrieves all starred trades for a user with optional wallet filtering and pagination';
COMMENT ON FUNCTION toggle_trade_starred IS 'Toggles the starred status of a trade with audit trail';
COMMENT ON FUNCTION bulk_star_trades IS 'Bulk operation to star/unstar trades based on various criteria';
COMMENT ON FUNCTION get_starred_trades_by_token IS 'Groups starred trades by token with aggregated statistics';
COMMENT ON FUNCTION get_starred_trades_summary IS 'Provides summary statistics for starred trades dashboard';
COMMENT ON FUNCTION star_similar_trades IS 'Stars trades similar to a reference trade based on configurable criteria'; 