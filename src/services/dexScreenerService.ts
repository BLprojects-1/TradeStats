import axios from 'axios';

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: {
      buys: number;
      sells: number;
    };
    h1: {
      buys: number;
      sells: number;
    };
    h24: {
      buys: number;
      sells: number;
    };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
  };
  fdv: number | null;
  pairCreatedAt: number;
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[];
  token?: {
    name: string;
    symbol: string;
    priceUsd: string;
    fdv: string | null;
  };
}

interface DexScreenerPairResponse {
  pair?: {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
    quoteToken: {
      symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
      m5: {
        buys: number;
        sells: number;
      };
      h1: {
        buys: number;
        sells: number;
      };
      h24: {
        buys: number;
        sells: number;
      };
    };
    volume: {
      h24: number;
      h6: number;
      h1: number;
      m5: number;
    };
    priceChange: {
      m5: number;
      h1: number;
      h6: number;
      h24: number;
    };
    liquidity: {
      usd: number;
    };
    fdv: number | null;
  };
}

// In-memory cache to reduce API calls
interface CacheEntry {
  timestamp: number;
  marketCap: number;
  priceUsd: number;
  source: 'token' | 'pool'; // Track data source for better reliability
}

// Common DEX program IDs to identify pool addresses in transactions
const DEX_PROGRAM_IDS = [
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Whirlpool
  'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr', // Raydium
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', // Serum
  'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', // Orca
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', // pAMM
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', // Meteora
  'CURVGoZn8zycx6FXwwevgBTB2gVvdbGTEpvMJDbgs2t4', // Curve
  'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ', // Saber
];

// Known pool addresses for specific tokens (manual mapping)
const KNOWN_POOLS: Record<string, string> = {
  // Add frequently used tokens here
  'So11111111111111111111111111111111111111112': '7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX', // wSOL/USDC
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': '7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX', // USDC/wSOL
  // Add more known token-to-pool mappings as needed
};

class DexScreenerService {
  private readonly client;
  private readonly baseUrl = 'https://api.dexscreener.com/latest/dex';
  private readonly cache = new Map<string, CacheEntry>();
  // Cache validity period - 5 minutes
  private readonly CACHE_TTL = 5 * 60 * 1000;
  // Token address to pool address mapping cache
  private readonly poolAddressCache = new Map<string, string>();
  // Store known user wallet addresses to avoid misidentifying them as pools
  private readonly userWallets = new Set<string>();

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Registers a user wallet to avoid misidentifying it as a pool
   * @param walletAddress The user's wallet address
   */
  registerUserWallet(walletAddress: string): void {
    this.userWallets.add(walletAddress);
  }

  /**
   * Fetches market cap and price data for a token
   * @param mintAddress The SPL token mint address
   * @param transactionLogs Optional transaction logs to extract pool addresses
   * @param userWallet Optional user wallet to avoid misidentifying as pool
   * @returns Market cap in USD or null if not found
   */
  async fetchTokenData(
    mintAddress: string, 
    transactionLogs?: string[],
    userWallet?: string
  ): Promise<{ marketCap: number | null, priceUsd: number | null, isReliable: boolean }> {
    try {
      console.log(`DexScreener: Fetching data for token ${mintAddress}`);
      
      // Register the user wallet if provided
      if (userWallet) {
        this.registerUserWallet(userWallet);
      }
      
      // Check cache first
      const cacheKey = mintAddress;
      const cachedData = this.cache.get(cacheKey);
      const now = Date.now();
      
      if (cachedData && (now - cachedData.timestamp) < this.CACHE_TTL) {
        console.log(`DexScreener: Using cached data for ${mintAddress} (source: ${cachedData.source})`);
        return {
          marketCap: cachedData.marketCap,
          priceUsd: cachedData.priceUsd,
          isReliable: cachedData.source === 'token' // Token endpoint data is considered reliable
        };
      }
      
      // First try the token endpoint - most accurate source
      const response = await this.client.get<DexScreenerResponse>(
        `/tokens/solana:${mintAddress}`
      );
      
      // Check if we have token data
      if (response.data.token) {
        // Safely parse values with fallbacks
        const fdvStr = response.data.token.fdv;
        const priceUsdStr = response.data.token.priceUsd;
        
        const fdv = fdvStr && !isNaN(parseFloat(fdvStr)) ? parseFloat(fdvStr) : null;
        const priceUsd = priceUsdStr && !isNaN(parseFloat(priceUsdStr)) ? parseFloat(priceUsdStr) : null;
        
        console.log(`DexScreener: Found data for ${mintAddress} - FDV: ${fdv}, Price: ${priceUsd}`);
        
        // Only cache valid data
        if (fdv !== null && fdv > 0 && priceUsd !== null && priceUsd > 0) {
          // Cache the result - this is reliable data from token endpoint
          this.cache.set(cacheKey, {
            timestamp: now,
            marketCap: fdv,
            priceUsd,
            source: 'token'
          });
          
          return {
            marketCap: fdv,
            priceUsd,
            isReliable: true
          };
        }
        
        // Return data even if we didn't cache it
        return {
          marketCap: fdv,
          priceUsd,
          isReliable: true
        };
      }
      
      // If no token data but we have pairs, use the first pair's data
      if (response.data.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];
        const fdv = pair.fdv !== null && pair.fdv !== undefined ? pair.fdv : null;
        const priceUsd = pair.priceUsd && !isNaN(parseFloat(pair.priceUsd)) ? 
          parseFloat(pair.priceUsd) : null;
        
        console.log(`DexScreener: Using pair data for ${mintAddress} - FDV: ${fdv}, Price: ${priceUsd}`);
        
        // Only cache valid data
        if (fdv !== null && fdv > 0 && priceUsd !== null && priceUsd > 0) {
          // Cache the result - less reliable but still directly from DexScreener
          this.cache.set(cacheKey, {
            timestamp: now,
            marketCap: fdv,
            priceUsd,
            source: 'pool'
          });
        }
        
        return {
          marketCap: fdv,
          priceUsd,
          isReliable: true // Still from DexScreener's token endpoint
        };
      }
      
      // If we still don't have data, try to find a pool address
      console.log(`DexScreener: No token data found, trying to find pool address for ${mintAddress}`);
      
      // Check if we have a known pool for this token
      let poolAddress = KNOWN_POOLS[mintAddress];
      
      // Check if we've already cached a pool address for this token
      if (!poolAddress && this.poolAddressCache.has(mintAddress)) {
        poolAddress = this.poolAddressCache.get(mintAddress) || '';
      }
      
      // Try to extract pool address from transaction logs
      if (!poolAddress && transactionLogs && transactionLogs.length > 0) {
        const extractedAddress = this.extractPoolAddressFromLogs(transactionLogs, mintAddress);
        if (extractedAddress) {
          poolAddress = extractedAddress;
        }
      }
      
      // If we found a pool address, try to get data from the pool
      if (poolAddress) {
        console.log(`DexScreener: Using pool address ${poolAddress} for token ${mintAddress}`);
        
        // Cache the pool address for future use
        this.poolAddressCache.set(mintAddress, poolAddress);
        
        // Try to get data from the pool
        const pairData = await this.fetchPairData(poolAddress);
        
        // Only return data that's reliable, with proper fallbacks
        if (pairData.priceUsd !== null && pairData.priceUsd > 0) {
          // Only cache if we have valid data
          if (pairData.marketCap !== null && pairData.marketCap > 0) {
            this.cache.set(cacheKey, {
              timestamp: now,
              marketCap: pairData.marketCap,
              priceUsd: pairData.priceUsd,
              source: 'pool'
            });
          }
          
          return {
            marketCap: pairData.marketCap,
            priceUsd: pairData.priceUsd,
            isReliable: false // Pool-based data is less reliable
          };
        }
      }
      
      console.log(`DexScreener: No data found for ${mintAddress}`);
      return {
        marketCap: null,
        priceUsd: null,
        isReliable: false
      };
      
    } catch (error) {
      console.error('DexScreener: Error fetching token data:', error);
      return {
        marketCap: null,
        priceUsd: null,
        isReliable: false
      };
    }
  }

  /**
   * Fetches data for a specific pool/pair
   * @param poolAddress The pool address
   * @returns Market cap and price data
   */
  async fetchPairData(poolAddress: string): Promise<{ marketCap: number | null, priceUsd: number | null }> {
    try {
      console.log(`DexScreener: Fetching data for pool ${poolAddress}`);
      
      const response = await this.client.get<DexScreenerPairResponse>(
        `/pairs/solana:${poolAddress}`
      );
      
      if (response.data.pair) {
        const pair = response.data.pair;
        
        // Safely parse with fallbacks
        const priceUsd = pair.priceUsd && !isNaN(parseFloat(pair.priceUsd)) ? 
          parseFloat(pair.priceUsd) : null;
        const marketCap = pair.fdv !== null && pair.fdv !== undefined ? pair.fdv : null;
        
        console.log(`DexScreener: Found data for pool ${poolAddress} - Price: ${priceUsd}, MarketCap: ${marketCap}`);
        
        return {
          marketCap,
          priceUsd
        };
      }
      
      return {
        marketCap: null,
        priceUsd: null
      };
    } catch (error) {
      console.error(`DexScreener: Error fetching pair data for ${poolAddress}:`, error);
      return {
        marketCap: null,
        priceUsd: null
      };
    }
  }

  /**
   * Registers a known pool address for a specific token mint
   * This is useful for new or uncommon tokens that aren't well indexed
   * @param mintAddress The token mint address
   * @param poolAddress The pool address where this token is traded
   */
  registerTokenPool(mintAddress: string, poolAddress: string): void {
    console.log(`DexScreener: Registering pool ${poolAddress} for token ${mintAddress}`);
    this.poolAddressCache.set(mintAddress, poolAddress);
  }

  /**
   * Extracts a pool address from transaction logs
   * @param logs Transaction logs to scan
   * @param mintAddress The token mint address
   * @returns A pool address if found
   */
  private extractPoolAddressFromLogs(logs: string[], mintAddress: string): string | null {
    try {
      // Simplified approach - look for Solana wallet addresses in logs that might be pool addresses
      const addressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
      const potentialAddresses = new Set<string>();
      
      // Find all Solana addresses in logs
      for (const log of logs) {
        const matches = log.match(addressRegex);
        if (matches) {
          for (const match of matches) {
            // Skip the mint address itself and any known user wallets
            if (match !== mintAddress && !this.userWallets.has(match)) {
              potentialAddresses.add(match);
            }
          }
        }
      }
      
      // Look for known DEX program IDs in logs, addresses near them could be pool addresses
      for (const log of logs) {
        for (const dexId of DEX_PROGRAM_IDS) {
          if (log.includes(dexId)) {
            // Extract addresses from this log
            const matches = log.match(addressRegex);
            if (matches) {
              for (const match of matches) {
                // Skip the mint address, DEX program ID, and known user wallets
                if (match !== mintAddress && match !== dexId && !this.userWallets.has(match)) {
                  // Higher probability this is a pool address
                  return match;
                }
              }
            }
          }
        }
      }
      
      // Return the first address we found if any
      return potentialAddresses.size > 0 ? 
        Array.from(potentialAddresses)[0] : null;
    } catch (error) {
      console.error('DexScreener: Error extracting pool address from logs:', error);
      return null;
    }
  }
}

export const dexScreenerService = new DexScreenerService();
export default dexScreenerService; 