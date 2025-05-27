-- Add scan status fields to tracked_wallets table
ALTER TABLE tracked_wallets
ADD COLUMN scan_status text DEFAULT 'pending',
ADD COLUMN scan_started_at timestamptz,
ADD COLUMN scan_completed_at timestamptz,
ADD COLUMN scan_error text,
ADD COLUMN trades_found integer DEFAULT 0,
ADD COLUMN total_trades integer DEFAULT 0;

-- Add constraint to ensure scan_status is one of the allowed values
ALTER TABLE tracked_wallets
ADD CONSTRAINT scan_status_check 
CHECK (scan_status IN ('pending', 'scanning', 'completed', 'failed')); 