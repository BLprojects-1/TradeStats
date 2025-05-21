# Trading History Scripts

This directory contains scripts for fetching and managing trading history data.

## fetch-trading-history.ts

This script fetches Solana trading history for a wallet and stores it in Supabase. It implements a comprehensive system that:

1. Checks if a wallet has had an initial scan (`initial_scan_complete` flag)
2. For first-time wallets, fetches ALL historical transactions
3. For previously scanned wallets, only fetches new transactions since the last update
4. Processes transactions to extract trading information
5. Stores processed trades in Supabase

### How It Works

The script follows this process:

1. Checks the `wallets` table in Supabase to see if the wallet exists and its scan status
2. For new or unscanned wallets:
   - Fetches all historical transactions in batches from dRPC
   - Processes each transaction to identify trades
   - Stores trades in Supabase
   - Marks the wallet as `initial_scan_complete = true`
3. For previously scanned wallets:
   - Only fetches transactions newer than the last update timestamp
   - Processes and stores new trades

### Data Fields

The script captures these data fields for each trade:

- `wallet_id`: The wallet ID in Supabase
- `timestamp`: Transaction timestamp
- `type`: BUY or SELL
- `token_symbol`: Token symbol from Jupiter API
- `token_address`: Token mint address
- `token_logo_url`: Token logo URL from Jupiter API
- `amount`: Amount of tokens traded
- `price_sol`: Price in SOL
- `price_usd`: Price in USD
- `value_sol`: Value in SOL
- `value_usd`: Value in USD
- `profit_loss`: Profit/Loss calculation

### Running the Script

```
npm run fetch:trades
```

By default, it will use the test wallet address defined in the script. To fetch for a different wallet, modify the `testWalletAddress` variable in the script.

### Rate Limiting

The script implements several measures to avoid rate limiting:
- Processes transactions in batches (50 at a time)
- Adds delays between API requests
- Implements error handling and retries

### Prerequisites

Make sure you have:
- Supabase credentials configured
- Node.js and npm installed
- Required dependencies installed (`npm install`) 