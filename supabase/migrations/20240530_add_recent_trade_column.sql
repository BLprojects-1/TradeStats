-- Add recent_trade column to tracked_wallets table
ALTER TABLE public.tracked_wallets
ADD COLUMN IF NOT EXISTS recent_trade TIMESTAMPTZ;

-- Update existing rows to have the same value as updated_at
UPDATE public.tracked_wallets
SET recent_trade = updated_at
WHERE recent_trade IS NULL;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN public.tracked_wallets.recent_trade IS 'Timestamp of the most recent trade for this wallet';