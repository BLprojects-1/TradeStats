import { PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { localPoolsService } from './localPoolsService';

/**
 * On-chain price service for fetching historical token prices
 * Uses AMM pools for accurate historical price data
 */

// Token price data structure
interface TokenPrice {
  price: number;
  decimals: number;
  slot: number;
  poolId?: string;
  source?: string;
  confidence?: 'high' | 'medium' | 'low';
}

// Local pools historical response
interface LocalPoolsHistoricalResponse {
  tokenMint: string;
  timestamp: number;
  date: string;
  price: number;
  poolId: string;
  poolAddress: string;
  dex: string;
  token: {
    symbol: string;
    decimals: number;
  };
  quotedIn: string;
  dataSource: string;
}

export class OnChainPriceService {
  // Price cache
  private priceCache = new Map<string, { price: number; timestamp: number; slot: number; poolId?: string }>();
  private historicalCache = new Map<string, { price: number; timestamp: number; source: string; confidence: 'high' | 'medium' | 'low' }>();
  
  // Cache durations
  private readonly PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly HISTORICAL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor() {
    console.log('🔍 OnChainPriceService initialized with AMM pool-based historical price detection');
  }

  /**
   * Get historical price using AMM pools
   * @param tokenMint Token mint address
   * @param timestamp Target timestamp
   * @returns Historical price in USD
   */
  async getHistoricalPrice(tokenMint: string, timestamp: number | string | Date): Promise<number> {
    try {
      // Convert timestamp to number
      const targetTimestamp = typeof timestamp === 'number' ? timestamp : 
                             typeof timestamp === 'string' ? parseInt(timestamp) :
                             timestamp.getTime();
      
      const targetDate = new Date(targetTimestamp);
      console.log(`🕐 Getting historical price for ${tokenMint} at ${targetDate.toISOString()}`);
      
      // Check historical cache first
      const cacheKey = `hist-${tokenMint}-${targetTimestamp}`;
      const cached = this.historicalCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.HISTORICAL_CACHE_DURATION) {
        console.log(`📋 Using cached historical price for ${tokenMint}: $${cached.price} (source: ${cached.source}, confidence: ${cached.confidence})`);
        return cached.price;
      }

      // Check if local pools service is available
      const isAvailable = await localPoolsService.isServiceAvailable();
      if (!isAvailable) {
        throw new Error('Local pools service is not available. Please ensure it is running on http://127.0.0.1:3001');
      }

      // Get best pool for token with retry logic
      let bestPool = null;
      let retryCount = 0;
      
      while (!bestPool && retryCount < this.MAX_RETRIES) {
        try {
          bestPool = await localPoolsService.getBestPool(tokenMint);
          if (!bestPool) {
            throw new Error('No suitable pool found');
          }
        } catch (error) {
          retryCount++;
          if (retryCount === this.MAX_RETRIES) {
            throw error;
          }
          console.log(`Retrying pool discovery (attempt ${retryCount}/${this.MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * retryCount));
        }
      }

      if (!bestPool) {
        throw new Error(`No suitable pool found for ${tokenMint} after ${this.MAX_RETRIES} retries`);
      }

      // Get historical price from pool with retry logic
      let historicalPrice = null;
      retryCount = 0;
      
      while (!historicalPrice && retryCount < this.MAX_RETRIES) {
        try {
          const response = await axios.get<LocalPoolsHistoricalResponse>(
            `http://127.0.0.1:3001/pool/historical-price/${bestPool.pool.id}/${targetTimestamp}`,
            {
              timeout: 10000,
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            }
          );

          if (!response.data || response.data.price <= 0) {
            throw new Error('Invalid historical price data');
          }

          historicalPrice = response.data.price;
          console.log(`✅ Historical price from pool ${bestPool.pool.id}: $${historicalPrice} (source: ${response.data.dataSource})`);
        } catch (error) {
          retryCount++;
          if (retryCount === this.MAX_RETRIES) {
            throw error;
          }
          console.log(`Retrying historical price fetch (attempt ${retryCount}/${this.MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * retryCount));
        }
      }

      if (!historicalPrice) {
        throw new Error(`Failed to get historical price from pool ${bestPool.pool.id} after ${this.MAX_RETRIES} retries`);
      }

      // Cache the result
      this.historicalCache.set(cacheKey, {
        price: historicalPrice,
        timestamp: Date.now(),
        source: 'AMM Pool',
        confidence: 'high'
      });

      return historicalPrice;
      
    } catch (error) {
      console.error(`❌ Error getting historical price for ${tokenMint}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get current SOL price
   */
  async getNativeSOLPrice(): Promise<{ price: number; source: string }> {
    try {
      const solMint = 'So11111111111111111111111111111111111111112';
      const price = await this.getHistoricalPrice(solMint, Date.now());
      return { price, source: 'AMM Pool' };
    } catch (error) {
      console.error('Error getting SOL price:', error);
      throw error;
    }
  }

  /**
   * Get token price using local pools service
   */
  async getTokenPrice(tokenMint: string, timestamp?: number): Promise<TokenPrice> {
    try {
      console.log(`🔍 Getting price for token ${tokenMint}${timestamp ? ` at timestamp ${timestamp}` : ' (current)'}`);
      
      // Check if local pools service is available
      const isAvailable = await localPoolsService.isServiceAvailable();
      if (!isAvailable) {
        throw new Error('Local pools service is not available. Please ensure it is running on http://127.0.0.1:3001');
      }
      
      // Get current price first (historical prices would need additional implementation)
      const currentSlot = await this.getCurrentSlot();
      
      // Check cache first
      const cacheKey = `${tokenMint}-${currentSlot}`;
      const cached = this.priceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_DURATION) {
        console.log(`📋 Using cached price for ${tokenMint}: ${cached.price}`);
        return {
          price: cached.price,
          decimals: 9, // Default, would need to fetch from mint account for accuracy
          slot: cached.slot,
          poolId: cached.poolId
        };
      }
      
      // Use local pools service to get price
      const priceResult = await localPoolsService.getTokenPrice(
        tokenMint, 
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // Prefer USDC
      );
      
      if (!priceResult) {
        throw new Error(`No pools found for token ${tokenMint} via local pools service`);
      }
      
      console.log(`✅ Price found via local pools service: ${priceResult.price} (pool: ${priceResult.poolId}, source: ${priceResult.source})`);
      
      // Cache the result
      this.priceCache.set(cacheKey, {
        price: priceResult.price,
        timestamp: Date.now(),
        slot: currentSlot,
        poolId: priceResult.poolId
      });
      
      return {
        price: priceResult.price,
        decimals: 9, // Default, would need to fetch from mint account for accuracy
        slot: currentSlot,
        poolId: priceResult.poolId,
        source: priceResult.source || 'AMM Pool'
      };
      
    } catch (error: any) {
      console.error(`❌ Error getting token price for ${tokenMint}:`, error.message);
      throw error;
    }
  }

  /**
   * Get current Solana slot
   */
  private async getCurrentSlot(): Promise<number> {
    try {
      const response = await axios.post<{ result: number }>(
        'https://api.mainnet-beta.solana.com',
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getSlot',
          params: [{ commitment: 'confirmed' }]
        },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.data?.result) {
        throw new Error('Invalid RPC response');
      }

      return response.data.result;
    } catch (error: any) {
      console.error('❌ Error getting current slot:', error.message);
      throw new Error(`Failed to get current slot: ${error.message}`);
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.priceCache.clear();
    this.historicalCache.clear();
    localPoolsService.clearCache();
    console.log('🗑️ OnChainPriceService cache cleared');
  }

  /**
   * Get service statistics
   */
  getStats(): {
    pricesCached: number;
    historicalCached: number;
    localPoolsStats: any;
  } {
    return {
      pricesCached: this.priceCache.size,
      historicalCached: this.historicalCache.size,
      localPoolsStats: localPoolsService.getStats()
    };
  }
}

// Export singleton instance
export const onChainPriceService = new OnChainPriceService(); 