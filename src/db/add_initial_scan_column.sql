-- Add initial_scan_complete column to wallets table
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS initial_scan_complete BOOLEAN DEFAULT FALSE;

-- Update existing wallets to have initial_scan_complete set to false
UPDATE wallets 
SET initial_scan_complete = FALSE 
WHERE initial_scan_complete IS NULL;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallets_initial_scan ON wallets(initial_scan_complete);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema'; 