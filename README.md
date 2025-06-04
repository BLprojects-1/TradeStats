# TICKR - Professional Solana Trading Analytics

A comprehensive trading analytics platform for professional Solana traders, featuring advanced portfolio management, automated trade tracking, and institutional-grade performance insights.

## Features

### Core Analytics
- **Real-time Portfolio Monitoring** - Live P/L tracking, performance metrics, and risk analytics
- **Advanced Trade Journal** - Automated transaction import with professional annotation capabilities  
- **Institutional Performance Analytics** - Statistical analysis, risk metrics, and pattern recognition
- **Professional Trading Discipline** - Systematic checklists and automated trade validation

### Technical Infrastructure
- **Self-Custodial Security** - Zero counterparty risk with complete asset control
- **Lightning-Fast RPC** - Ultra-low latency DRPC & Helius connections
- **Scalable Database** - Enterprise PostgreSQL with real-time sync
- **Intelligent Caching** - Smart data optimization with incremental updates

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js + TypeScript, Fastify
- **Database**: Supabase (PostgreSQL + Auth)
- **Blockchain**: Solana via dRPC Growth API
- **Performance**: Advanced caching with rate limiting

## Prerequisites

- Node.js 18+
- Supabase account
- dRPC API key

## Environment Variables

Create a `.env` file in the root directory with:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
DRPC_API_KEY=your_drpc_api_key
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

### Trading Analytics

```
GET /api/wallets/:address/trades
Query params:
- limit (default: 50, max: 500)
- sinceSlot (optional)
```

### Performance Metrics

```
GET /api/wallets/:address/performance
Query params:
- timeframe (1d, 7d, 30d, 90d)
- metrics (returns, risk, sharpe)
```

### Trade Annotations

```
POST /api/wallets/:address/notes
Body:
{
  "signature": "transaction_signature",
  "note": "Professional trade analysis",
  "tags": ["strategy", "risk-managed"]
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

## Infrastructure

### Rate Limiting
- 125 requests per second for optimal dRPC performance
- Intelligent caching with 30s TTL
- Per-wallet request debouncing

### Security
- Self-custodial architecture with zero private key exposure
- Enterprise-grade data encryption
- SOC 2 compliant data handling

## Database Schema

### Core Tables
- **users** - User accounts and preferences
- **wallets** - Tracked wallet addresses per user
- **trading_history** - Complete transaction records
- **performance_metrics** - Calculated analytics and insights
- **trade_annotations** - Professional notes and tags

## License

MIT License - Built for professional traders by professional traders.

---

**TICKR** - Elevating Solana trading through professional-grade analytics and systematic discipline.
