import axios from 'axios';
import { TokenInfoResponse, TokenPriceResponse } from './jupiterApiService';
import { supabase } from '../lib/supabaseClient';

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

// Check if a Supabase table exists or create it if it doesn't
async function ensureSupabaseTable(tableName: string, schema: Record<string, any>) {
  try {
    // First try to query the table to see if it exists
    const { error } = await supabase.from(tableName).select('count').limit(1);
    
    if (error && error.code === '42P01') { // Table doesn't exist
      console.log(`Table ${tableName} doesn't exist. Please create it manually in Supabase.`);
      // We can't create tables via client API, so we'll just log the error
    }
  } catch (err) {
    console.error(`Error checking/creating Supabase table ${tableName}:`, err);
  }
}

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

    // Check and create tables if needed
    await Promise.all([
      ensureSupabaseTable('token_info', {
        mint_address: 'text primary key',
        symbol: 'text',
        name: 'text',
        logo_uri: 'text',
        decimals: 'integer',
        last_updated: 'timestamp with time zone'
      }),
      ensureSupabaseTable('token_prices', {
        mint_address: 'text',
        price_usd: 'numeric',
        timestamp: 'timestamp with time zone',
        primary_key: '(mint_address, timestamp)'
      })
    ]);

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
    
    // Check if we already have this token info in Supabase
    try {
      await this.ensureTables();
      
      const { data: tokenData, error } = await supabase
        .from('token_info')
        .select('mint_address, symbol, name, logo_uri, decimals')
        .eq('mint_address', mintAddress)
        .single();
      
      if (!error && tokenData && tokenData.symbol) {
        // Convert Supabase format to TokenInfoResponse format
        const cachedInfo: TokenInfoResponse = {
          address: mintAddress,
          name: tokenData.name,
          symbol: tokenData.symbol,
          decimals: tokenData.decimals,
          logoURI: tokenData.logo_uri,
          tags: null,
          daily_volume: null,
          created_at: new Date().toISOString(),
          freeze_authority: null,
          mint_authority: null,
          permanent_delegate: null,
          minted_at: null
        };
        
        // Update cache
        this.cache.tokenInfo.set(cacheKey, {
          data: cachedInfo,
          timestamp: Date.now()
        });
        
        return cachedInfo;
      }
    } catch (err) {
      console.error('Error checking token info in Supabase:', err);
      // Continue to Jupiter API if Supabase lookup fails
    }
    
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
        
        // Store in Supabase for future reference
        try {
          await this.ensureTables();
          
          await supabase.from('token_info').upsert({
            mint_address: mintAddress,
            symbol: response.data.symbol,
            name: response.data.name,
            logo_uri: response.data.logoURI,
            decimals: response.data.decimals,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'mint_address'
          });
        } catch (err) {
          console.error('Error storing token info in Supabase:', err);
          // Continue even if Supabase storage fails
        }
        
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
    
    // Check if we already have this price in Supabase
    if (timestamp) {
      try {
        await this.ensureTables();
        
        const { data: priceData, error } = await supabase
          .from('token_prices')
          .select('price_usd')
          .eq('mint_address', tokenAddress)
          .eq('timestamp', formattedTimestamp)
          .single();
        
        if (!error && priceData && priceData.price_usd) {
          // Construct a response that matches the Jupiter API format but with minimal data
          const cachedPrice: TokenPriceResponse = {
            data: {
              [tokenAddress]: {
                id: tokenAddress,
                type: 'token',
                price: priceData.price_usd.toString(),
                extraInfo: {
                  lastSwappedPrice: {
                    lastJupiterSellAt: null,
                    lastJupiterSellPrice: null,
                    lastJupiterBuyAt: null,
                    lastJupiterBuyPrice: null
                  },
                  quotedPrice: {
                    buyPrice: priceData.price_usd.toString(),
                    buyAt: 0,
                    sellPrice: priceData.price_usd.toString(),
                    sellAt: 0
                  },
                  confidenceLevel: 'high',
                  depth: {
                    buyPriceImpactRatio: {
                      depth: {},
                      timestamp: 0
                    },
                    sellPriceImpactRatio: {
                      depth: {},
                      timestamp: 0
                    }
                  }
                }
              }
            },
            timeTaken: 0
          };
          
          // Update cache
          this.cache.tokenPrice.set(cacheKey, {
            data: cachedPrice,
            timestamp: Date.now()
          });
          
          return cachedPrice;
        }
      } catch (err) {
        console.error('Error checking price in Supabase:', err);
        // Continue to Jupiter API if Supabase lookup fails
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
      
      // Store price in Supabase for historical reference
      try {
        await this.ensureTables();
        
        // Format the timestamp for storage
        const storedTimestamp = timestamp 
          ? typeof timestamp === 'object' 
            ? timestamp.toISOString() 
            : typeof timestamp === 'number'
              ? new Date(timestamp).toISOString()
              : timestamp
          : new Date().toISOString();
        
        await supabase.from('token_prices').upsert({
          mint_address: tokenAddress,
          price_usd: parseFloat(response.data.data[tokenAddress].price),
          timestamp: storedTimestamp
        }, {
          onConflict: 'mint_address,timestamp'
        });
      } catch (err) {
        console.error('Error storing price in Supabase:', err);
        // Continue even if Supabase storage fails
      }
      
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
    const response = await this.getTokenPrice(tokenAddress, timestamp);
    const priceData = response.data[tokenAddress];
    return parseFloat(priceData.price);
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