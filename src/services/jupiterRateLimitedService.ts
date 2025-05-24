import axios from 'axios';
import { TokenInfoResponse, TokenPriceResponse } from './jupiterApiService';
import { supabase } from '../lib/supabaseClient';
import { onChainPriceService } from './onChainPriceService';

// Simple in-memory cache implementation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Queue implementation for rate limiting
class RequestQueue {
  private queue: Array<{
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    retryCount: number;
    priority: number;
  }> = [];
  private isProcessing = false;
  private interval = 1000; // 1000ms between requests (1 req/sec) - more conservative than before
  private lastRequestTime = 0;
  private maxRetries = 5; // Increased from 3 to 5
  private initialBackoff = 500; // Increased from 200ms to 500ms

  async add<T>(task: () => Promise<T>, priority: number = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
        retryCount: 0,
        priority
      });
      
      // Sort queue by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;

    // Ensure we're respecting the rate limit
    const now = Date.now();
    const timeToWait = Math.max(0, this.interval - (now - this.lastRequestTime));
    
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }

    const { task, resolve, reject, retryCount, priority } = this.queue.shift()!;

    try {
      this.lastRequestTime = Date.now();
      const result = await task();
      resolve(result);
    } catch (error: any) {
      // Handle rate limit errors with exponential backoff
      if (error.response?.status === 429 && retryCount < this.maxRetries) {
        const backoff = this.initialBackoff * Math.pow(2, retryCount);
        console.log(`Rate limit hit, retrying after ${backoff}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        
        // Put the task back in the queue with increased retry count
        this.queue.unshift({
          task,
          resolve,
          reject,
          retryCount: retryCount + 1,
          priority
        });
        
        // Wait before processing the next request
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        reject(error);
      }
    }

    // Add random jitter delay before processing next item (50-150ms)
    const jitter = 50 + Math.floor(Math.random() * 100);
    await new Promise(resolve => setTimeout(resolve, jitter));
    
    // Process next item in queue
    this.processQueue();
  }
}

// Tables are managed via migrations in src/db/migrations.sql
// Token data is stored directly in the trading_history table

export class JupiterRateLimitedService {
  private readonly priceApiBaseUrl = 'https://lite-api.jup.ag/price/v2';
  private readonly tokenApiBaseUrl = 'https://lite-api.jup.ag/tokens/v1';
  
  private cache: {
    tokenInfo: Map<string, CacheEntry<TokenInfoResponse>>;
    tokenPrice: Map<string, CacheEntry<TokenPriceResponse>>;
  };
  
  private requestQueue: RequestQueue;
  private cacheTTL = 10 * 60 * 1000; // 10 minutes in milliseconds
  private tablesChecked = false;

  constructor() {
    this.cache = {
      tokenInfo: new Map(),
      tokenPrice: new Map()
    };
    this.requestQueue = new RequestQueue();

    // Check/create Supabase tables
    this.ensureTables();
  }

  private async ensureTables() {
    if (this.tablesChecked) return;

    // Tables are managed via migrations, not here
    // We don't need to create token_info or token_prices tables
    // Token data is stored directly in trading_history table
    console.log('Tables check complete - using existing trading_history table schema');

    this.tablesChecked = true;
  }

  /**
   * Get token info with rate limiting and caching, focused on just the data we need
   * @param mintAddress Token mint address
   * @param timestamp Optional timestamp to include in cache key for historical lookups
   */
  async getTokenInfo(mintAddress: string, timestamp?: string | Date | number): Promise<TokenInfoResponse> {
    // Format timestamp for cache key
    const formattedTimestamp = timestamp 
      ? typeof timestamp === 'object' 
        ? timestamp.toISOString() 
        : typeof timestamp === 'number'
          ? new Date(timestamp).toISOString()
          : timestamp
      : 'current';
    
    const cacheKey = `${mintAddress}:${formattedTimestamp}`;
    
    // Check cache first
    const cachedEntry = this.cache.tokenInfo.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp) < this.cacheTTL) {
      return cachedEntry.data;
    }
    
    // Skip Supabase lookup - token info is cached in memory and stored in trading_history table when needed
    // No need to maintain a separate token_info table
    
    // Not in cache or Supabase, fetch from API with rate limiting
    const fetchTask = async () => {
      try {
        // Use a simpler endpoint that just gets the minimal info we need
        const response = await axios.get<TokenInfoResponse>(`${this.tokenApiBaseUrl}/token/${mintAddress}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.data) {
          throw new Error('Invalid token info response from Jupiter API');
        }
        
        // Token info will be stored in trading_history table when trades are processed
        // No need to maintain a separate token_info table
        
        return response.data;
      } catch (error) {
        // If direct token lookup fails, try to find it in the tradable tokens list
        try {
          const allTokensResponse = await axios.get<TokenInfoResponse[]>(`${this.tokenApiBaseUrl}/mints/tradable`, {
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (!allTokensResponse.data || !Array.isArray(allTokensResponse.data)) {
            throw new Error('Invalid token list response from Jupiter API');
          }
          
          const tokenInfo = allTokensResponse.data.find(token => token.address === mintAddress);
          
          if (!tokenInfo) {
            throw new Error(`Token with mint address ${mintAddress} not found`);
          }
          
          return tokenInfo;
        } catch (fallbackError) {
          console.error('Error fetching token info with fallback method:', fallbackError);
          throw error; // Still throw the original error
        }
      }
    };
    
    // Add to rate-limited queue (higher priority for token info)
    const result = await this.requestQueue.add(fetchTask, 10);
    
    // Update cache
    this.cache.tokenInfo.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  /**
   * Get token price with rate limiting and caching, focused on just the price data
   * @param tokenAddress Token mint address
   * @param timestamp Optional timestamp for historical price lookup (ISO string or Date)
   */
  async getTokenPrice(tokenAddress: string, timestamp?: string | Date | number): Promise<TokenPriceResponse> {
    // Format timestamp for cache key
    const formattedTimestamp = timestamp 
      ? typeof timestamp === 'object' 
        ? timestamp.toISOString() 
        : typeof timestamp === 'number'
          ? new Date(timestamp).toISOString()
          : timestamp
      : 'current';
    
    const cacheKey = `${tokenAddress}:${formattedTimestamp}`;
    
    // Check cache first
    const cachedEntry = this.cache.tokenPrice.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp) < this.cacheTTL) {
      return cachedEntry.data;
    }
    
    // Skip Supabase price lookup - prices are fetched fresh from Jupiter API and cached in memory
    // Historical prices are stored in trading_history table when trades are processed
    
    // If timestamp is provided (historical price), try on-chain service first
    if (timestamp) {
      try {
        console.log(`Attempting on-chain historical price lookup for ${tokenAddress} at timestamp ${timestamp}`);
        
        // Pass the timestamp directly to the on-chain service
        // It will handle the timestamp-to-slot conversion internally
        const onChainPrice = await onChainPriceService.getHistoricalPrice(tokenAddress, timestamp);
        
        // Format response to match Jupiter API structure
        const response: TokenPriceResponse = {
          data: {
            [tokenAddress]: {
              id: tokenAddress,
              type: 'token',
              price: onChainPrice.toString(),
              extraInfo: {
                lastSwappedPrice: {
                  lastJupiterSellAt: null,
                  lastJupiterSellPrice: null,
                  lastJupiterBuyAt: null,
                  lastJupiterBuyPrice: null,
                },
                quotedPrice: {
                  buyPrice: onChainPrice.toString(),
                  buyAt: Date.now(),
                  sellPrice: onChainPrice.toString(),
                  sellAt: Date.now(),
                },
                confidenceLevel: 'high' as const,
                depth: {
                  buyPriceImpactRatio: {
                    depth: {},
                    timestamp: Date.now(),
                  },
                  sellPriceImpactRatio: {
                    depth: {},
                    timestamp: Date.now(),
                  },
                },
              },
            }
          },
          timeTaken: 0
        };
        
        // Update cache
        this.cache.tokenPrice.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
        
        console.log(`Successfully fetched on-chain historical price for ${tokenAddress}: $${onChainPrice}`);
        return response;
      } catch (error) {
        console.warn(`❌ On-chain historical price lookup failed for ${tokenAddress}:`, error instanceof Error ? error.message : String(error));
        console.log(`🔄 Falling back to Jupiter API current price for ${tokenAddress}...`);
        
        // Fallback to Jupiter API with current price (not historical)
        try {
          const response = await this.getTokenPrice(tokenAddress); // No timestamp = current price
          const priceData = response.data[tokenAddress];
          const currentPrice = parseFloat(priceData.price);
          console.log(`✅ Jupiter API fallback price for ${tokenAddress}: $${currentPrice}`);
          return response;
        } catch (fallbackError) {
          console.error(`❌ Jupiter API fallback also failed for ${tokenAddress}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          
          // Last resort: return 0 (will be handled gracefully by caller)
          console.warn(`⚠️ Returning 0 price for ${tokenAddress} - all price lookups failed`);
          return {
            data: {
              [tokenAddress]: {
                id: tokenAddress,
                type: 'token',
                price: '0',
                extraInfo: {
                  lastSwappedPrice: {
                    lastJupiterSellAt: null,
                    lastJupiterSellPrice: null,
                    lastJupiterBuyAt: null,
                    lastJupiterBuyPrice: null,
                  },
                  quotedPrice: {
                    buyPrice: '0',
                    buyAt: Date.now(),
                    sellPrice: '0',
                    sellAt: Date.now(),
                  },
                  confidenceLevel: 'high' as const,
                  depth: {
                    buyPriceImpactRatio: {
                      depth: {},
                      timestamp: Date.now(),
                    },
                    sellPriceImpactRatio: {
                      depth: {},
                      timestamp: Date.now(),
                    },
                  },
                },
              }
            },
            timeTaken: 0
          };
        }
      }
    }
    
    // Not in cache or Supabase, fetch from API with rate limiting
    const fetchTask = async () => {
      // Simplify the request to only get the price, not extra info
      const response = await axios.get<TokenPriceResponse>(`${this.priceApiBaseUrl}`, {
        params: {
          ids: tokenAddress,
          showExtraInfo: false // Set to false to reduce response size
        },
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.data || !response.data.data || !response.data.data[tokenAddress]) {
        throw new Error('Invalid price response from Jupiter API');
      }
      
      // Price data will be stored in trading_history table when trades are processed
      // No need to maintain a separate token_prices table
      
      return response.data;
    };
    
    // Add to rate-limited queue (normal priority for prices)
    const result = await this.requestQueue.add(fetchTask, 5);
    
    // Update cache
    this.cache.tokenPrice.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  /**
   * Get token price in USD with rate limiting and caching
   * @param tokenAddress Token mint address
   * @param timestamp Optional timestamp for historical price lookup
   */
  async getTokenPriceInUSD(tokenAddress: string, timestamp?: string | Date | number): Promise<number> {
    // If timestamp is provided, try on-chain service first (for historical prices)
    if (timestamp) {
      try {
        console.log(`Attempting historical price lookup for ${tokenAddress} at timestamp ${timestamp}`);
        const onChainPrice = await onChainPriceService.getHistoricalPrice(tokenAddress, timestamp);
        console.log(`✅ On-chain historical price for ${tokenAddress}: $${onChainPrice}`);
        return onChainPrice;
      } catch (error) {
        console.warn(`❌ On-chain historical price lookup failed for ${tokenAddress}:`, error instanceof Error ? error.message : String(error));
        console.log(`🔄 Falling back to Jupiter API current price for ${tokenAddress}...`);
        
        // Fallback to Jupiter API with current price (not historical)
        try {
          const response = await this.getTokenPrice(tokenAddress); // No timestamp = current price
          const priceData = response.data[tokenAddress];
          const currentPrice = parseFloat(priceData.price);
          console.log(`✅ Jupiter API fallback price for ${tokenAddress}: $${currentPrice}`);
          return currentPrice;
        } catch (fallbackError) {
          console.error(`❌ Jupiter API fallback also failed for ${tokenAddress}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          
          // Last resort: return 0 (will be handled gracefully by caller)
          console.warn(`⚠️ Returning 0 price for ${tokenAddress} - all price lookups failed`);
          return 0;
        }
      }
    }
    
    // For current prices (no timestamp), use Jupiter API directly
    try {
      const response = await this.getTokenPrice(tokenAddress, timestamp);
      const priceData = response.data[tokenAddress];
      return parseFloat(priceData.price);
    } catch (error) {
      console.error(`❌ Current price lookup failed for ${tokenAddress}:`, error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Get token price in SOL with rate limiting and caching
   * @param tokenAddress Token mint address
   * @param timestamp Optional timestamp for historical price lookup
   */
  async getTokenPriceInSOL(tokenAddress: string, timestamp?: string | Date | number): Promise<number> {
    // This will use the queue and cache system under the hood
    const [tokenPrice, solPrice] = await Promise.all([
      this.getTokenPriceInUSD(tokenAddress, timestamp),
      this.getTokenPriceInUSD('So11111111111111111111111111111111111111112', timestamp)
    ]);
    
    return solPrice > 0 ? tokenPrice / solPrice : 0;
  }
}

// Export a singleton instance
export const jupiterRateLimitedService = new JupiterRateLimitedService(); 