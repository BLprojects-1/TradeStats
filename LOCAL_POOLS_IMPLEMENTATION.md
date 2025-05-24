# 🏊 Local Pools Service Implementation

## Overview

We've implemented a **Local Pools Service** approach that replaces the complex `getProgramAccounts` blockchain scanning with simple HTTP API calls to a local pools service running on `http://127.0.0.1:3000`.

## Problem Solved

The original approach using `comprehensivePoolDiscovery` was:
- Complex (parsing multiple DEX account structures)
- Slow (multiple RPC calls with rate limiting)
- Unreliable (dependent on correct byte offsets for each DEX)
- Not finding pools for tokens like `EdfRrkHUkzg1LM3qf8titmZrYrdMLhLwHyHqRSGtdcXH`

## New Local Pools Approach

### Architecture

```
┌─────────────────┐    HTTP API    ┌─────────────────┐
│                 │ ──────────────► │                 │
│  Trading App    │                │ Local Pools     │
│  (Port 3002)    │                │ Service         │
│                 │ ◄────────────── │ (Port 3000)     │
└─────────────────┘    JSON Data   └─────────────────┘

Trading App Services:
├── localPoolsService.ts     # HTTP client for pools API
├── onChainPriceService.ts   # Updated to use local pools
└── test-local-pools.tsx     # Testing interface
```

### Key Components

#### 1. LocalPoolsService (`src/services/localPoolsService.ts`)

**Main Methods:**
- `getPoolsByToken(tokenMint)` - Find all pools containing a token
- `getPoolState(poolId)` - Get live pool state (prices, liquidity)
- `getBestPool(tokenMint, preferredQuote?)` - Find and score the best pool
- `getTokenPrice(tokenMint, preferredQuote?)` - Get token price from best pool

**API Calls:**
```typescript
// Discover pools
GET http://127.0.0.1:3000/pool/by-token-ids?token0=${mint}
GET http://127.0.0.1:3000/pool/by-token-ids?token1=${mint}

// Get pool state
GET http://127.0.0.1:3000/pool/by-id/${poolId}
```

#### 2. Updated OnChainPriceService (`src/services/onChainPriceService.ts`)

**Integration:**
```typescript
// OLD: Complex comprehensive discovery
const pool = await comprehensivePoolDiscovery.getBestPool(tokenMint);

// NEW: Simple local API call
const priceResult = await localPoolsService.getTokenPrice(tokenMint);
```

**Features:**
- ✅ Uses local pools service for discovery
- ✅ Maintains caching for performance
- ✅ Provides fallback error handling
- ⚠️ Historical prices simplified (uses current price)

#### 3. Test Interface (`src/pages/test-local-pools.tsx`)

**Testing Features:**
- Service availability check
- Pool discovery testing
- Price service testing
- Live API logging
- Performance metrics

## API Expectations

### Pool Discovery Response
```json
[
  {
    "id": "pool_id_123",
    "type": "raydium",
    "token0": {
      "mint": "EdfRrkHUkzg1LM3qf8titmZrYrdMLhLwHyHqRSGtdcXH",
      "symbol": "TOKEN",
      "decimals": 9
    },
    "token1": {
      "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "symbol": "USDC",
      "decimals": 6
    },
    "liquidity": "1000000",
    "volume24h": "500000",
    "address": "pool_address_abc"
  }
]
```

### Pool State Response
```json
{
  "id": "pool_id_123",
  "token0Amount": "1000000",
  "token1Amount": "500000",
  "price": 0.5,
  "liquidity": "1000000",
  "volume24h": "500000",
  "lastUpdated": 1643723400000
}
```

## Usage Examples

### Basic Pool Discovery
```typescript
import { localPoolsService } from './services/localPoolsService';

// Find all pools for a token
const pools = await localPoolsService.getPoolsByToken(
  'EdfRrkHUkzg1LM3qf8titmZrYrdMLhLwHyHqRSGtdcXH'
);

console.log(`Found ${pools.length} pools`);
```

### Get Token Price
```typescript
import { onChainPriceService } from './services/onChainPriceService';

// Get current price using local pools service
const price = await onChainPriceService.getTokenPrice(
  'EdfRrkHUkzg1LM3qf8titmZrYrdMLhLwHyHqRSGtdcXH'
);

console.log(`Price: ${price.price} (from ${price.source})`);
```

### Advanced Usage
```typescript
// Get best pool with preferred quote token
const result = await localPoolsService.getBestPool(
  'EdfRrkHUkzg1LM3qf8titmZrYrdMLhLwHyHqRSGtdcXH',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
);

if (result) {
  console.log(`Pool: ${result.pool.id}`);
  console.log(`Price: ${result.state.price}`);
  console.log(`Liquidity: ${result.state.liquidity}`);
}
```

## Testing

### Test Page Access
```bash
# Start your app (if not already running)
npm run dev -- --port 3002

# Access test page
open http://localhost:3002/test-local-pools
```

### Expected Test Flow

1. **Service Check**: Verifies local pools service is running on port 3000
2. **Pool Discovery**: Tests finding pools for the target token
3. **Price Service**: Tests getting prices via the integrated service
4. **Live Logging**: Shows all API calls and responses in real-time

### Test Results Interpretation

**✅ Success Indicators:**
- Service status shows "Available"
- Pool discovery finds multiple pools
- Price service returns valid price data
- Response times < 1000ms

**❌ Failure Indicators:**
- Service status shows "Unavailable" 
- No pools found (may indicate service not running)
- Connection refused errors
- Empty responses

## Local Pools Service Requirements

### Service Must Provide:

1. **Health/Availability Check**
   ```http
   GET /health
   ```

2. **Pool Discovery by Token**
   ```http
   GET /pool/by-token-ids?token0={mint}
   GET /pool/by-token-ids?token1={mint}
   ```

3. **Pool State by ID**
   ```http
   GET /pool/by-id/{poolId}
   ```

### Response Requirements:

- **Content-Type**: `application/json`
- **CORS**: Allow requests from localhost:3002
- **Error Handling**: Return 404 for not found, 500 for errors
- **Performance**: Response times < 1000ms for good UX

## Benefits of This Approach

### ✅ Advantages

1. **Simplicity**: Just HTTP API calls instead of complex blockchain parsing
2. **Speed**: Pre-indexed data vs real-time blockchain scanning
3. **Reliability**: No RPC rate limits or parsing edge cases
4. **Comprehensive**: Service handles all DEX integrations
5. **Maintainable**: Clean separation of concerns

### ⚠️ Limitations

1. **Dependency**: Requires local pools service to be running
2. **Historical Data**: Limited historical price functionality
3. **Service Availability**: Single point of failure if service is down
4. **Data Freshness**: Dependent on service's update frequency

## Migration Notes

### From Comprehensive Discovery

**Files Updated:**
- ✅ `src/services/onChainPriceService.ts` - Simplified to use local pools
- ✅ `src/services/localPoolsService.ts` - New HTTP client service
- ✅ `src/pages/test-local-pools.tsx` - New test interface

**Files Deprecated:**
- 🗑️ `src/services/comprehensivePoolDiscovery.ts` - No longer used
- 🗑️ `src/pages/test-comprehensive-discovery.tsx` - Replaced

**Breaking Changes:**
- `onChainPriceService.getTokenPrice()` now requires local service
- Historical prices simplified (returns current price)
- Pool discovery caching behavior changed

## Troubleshooting

### Common Issues

**"Local pools service is not available"**
- Ensure service is running on http://127.0.0.1:3000
- Check if endpoints `/pool/by-token-ids` and `/pool/by-id` exist
- Verify CORS settings allow requests from your app

**"No pools found"**
- Token might not have liquidity on major DEXs
- Service might not have indexed this token yet
- Check if token mint address is correct

**Connection timeouts**
- Service might be overloaded
- Check service logs for errors
- Increase timeout in `localPoolsService.ts` if needed

### Debug Steps

1. **Manual API Test**:
   ```bash
   curl "http://127.0.0.1:3000/pool/by-token-ids?token0=So11111111111111111111111111111111111111112"
   ```

2. **Check Service Logs**: Look for errors in pools service console

3. **Browser Network Tab**: Inspect actual HTTP requests in dev tools

4. **Test Page Logs**: Use the live logging feature in the test interface

## Next Steps

1. **Ensure Local Service**: Get the pools service running on port 3000
2. **Test Integration**: Use `/test-local-pools` page to verify
3. **Monitor Performance**: Check response times and cache hit rates
4. **Add Fallbacks**: Consider fallback strategies if service is unavailable 