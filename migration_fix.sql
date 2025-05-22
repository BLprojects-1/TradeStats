-- Add the missing columns to trading_history table
ALTER TABLE trading_history 
ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT;

-- Create the index for starred column
CREATE INDEX IF NOT EXISTS idx_trading_history_starred 
ON trading_history(starred) WHERE starred = TRUE;

-- The update_trading_history_updated_at trigger already exists, so we don't need to recreate it
-- If you need to modify the trigger, you would first drop it then recreate it:
-- DROP TRIGGER IF EXISTS update_trading_history_updated_at ON trading_history;
-- CREATE TRIGGER update_trading_history_updated_at
--   BEFORE UPDATE ON trading_history
--   FOR EACH ROW
--   EXECUTE FUNCTION update_updated_at_column(); 