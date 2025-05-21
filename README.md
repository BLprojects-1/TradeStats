# Journi - Solana Trade Journal Backend

A backend service for tracking and analyzing Solana wallet transactions using dRPC's Growth API.

## Features

- User authentication via Supabase
- Wallet management and tracking
- Real-time transaction fetching from Solana blockchain
- Trade analysis and annotation
- Caching system for rate limiting
- REST API endpoints

## Tech Stack

- Node.js + TypeScript
- Fastify
- Supabase (Auth & Database)
- dRPC Growth API
- In-memory caching

## Prerequisites

- Node.js 16+
- Supabase account
- dRPC API key

## Environment Variables

Create a `.env` file in the root directory with:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up Supabase:
   - Create a new Supabase project
   - Run the migrations from `src/db/migrations.sql`
   - Set up authentication
   - Add environment variables

## API Endpoints

### Trades

```
GET /api/wallets/:address/trades
Query params:
- limit (default: 50, max: 500)
- sinceSlot (optional)
```

### Top Trades

```
GET /api/wallets/:address/top
Query params:
- limit (default: 5)
```

### Notes

```
POST /api/wallets/:address/notes
Body:
{
  "signature": "transaction_signature",
  "note": "Your note here"
}
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Rate Limiting

The service implements rate limiting to stay within dRPC's Growth plan limits:
- 125 requests per second
- In-memory caching with 30s TTL
- Per-wallet request debouncing

## Database Schema

### Users
- id (UUID, PK)
- email (TEXT)
- created_at (TIMESTAMPTZ)

### Wallets
- id (UUID, PK)
- user_id (UUID, FK)
- address (TEXT)
- created_at (TIMESTAMPTZ)

### Slots
- wallet_id (UUID, PK, FK)
- last_slot (BIGINT)
- updated_at (TIMESTAMPTZ)

### Notes
- id (UUID, PK)
- wallet_id (UUID, FK)
- signature (TEXT)
- note (TEXT)
- created_at (TIMESTAMPTZ)

## License

MIT
