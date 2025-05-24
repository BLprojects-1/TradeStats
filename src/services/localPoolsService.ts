import axios from 'axios';
import { PublicKey } from '@solana/web3.js';

// Pool data structures for the local pools API
export interface LocalPoolInfo {
  id: string;
  type: string; // 'raydium' | 'orca' | 'saber' etc.
  token0: {
    mint: string;
    symbol?: string;
    decimals: number;
  };
  token1: {
    mint: string;
    symbol?: string;
    decimals: number;
  };
  liquidity?: string;
  volume24h?: string;
  fee?: number;
  address: string; // Pool address
}

export interface LocalPoolState {
  id: string;
  token0Amount: string;
  token1Amount: string;
  price: number;
  liquidity: string;
  volume24h?: string;
  lastUpdated: number;
}

export class LocalPoolsService {
  private readonly baseUrl: string;
  private poolCache = new Map<string, LocalPoolInfo[]>();
  private poolStateCache = new Map<string, { state: LocalPoolState; timestamp: number }>();
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds

  constructor(baseUrl = 'http://127.0.0.1:3001') {
    this.baseUrl = baseUrl;
    console.log(`🏊 LocalPoolsService initialized with base URL: ${baseUrl}`);
  }

  /**
   * Discover pools containing a specific token
   */
  async getPoolsByToken(tokenMint: string): Promise<LocalPoolInfo[]> {
    const cacheKey = tokenMint;
    const cached = this.poolCache.get(cacheKey);
    
    if (cached && cached.length > 0) {
      console.log(`📋 Using cached pools for ${tokenMint}: ${cached.length} pools`);
      return cached;
    }

    try {
      console.log(`🔍 Discovering pools for token: ${tokenMint}`);
      
      // Try both token0 and token1 positions
      const [pools0, pools1] = await Promise.all([
        this.fetchPoolsByTokenPosition(tokenMint, 'token0'),
        this.fetchPoolsByTokenPosition(tokenMint, 'token1')
      ]);

      // Combine and deduplicate pools
      const allPools = [...pools0, ...pools1];
      const uniquePools = allPools.filter((pool, index, self) => 
        index === self.findIndex(p => p.id === pool.id)
      );

      console.log(`✅ Found ${uniquePools.length} unique pools for ${tokenMint}`);
      
      // Cache the results
      this.poolCache.set(cacheKey, uniquePools);
      
      return uniquePools;
      
    } catch (error: any) {
      console.error(`❌ Error discovering pools for ${tokenMint}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch pools where token is in a specific position (token0 or token1)
   */
  private async fetchPoolsByTokenPosition(tokenMint: string, position: 'token0' | 'token1'): Promise<LocalPoolInfo[]> {
    try {
      const url = `${this.baseUrl}/pool/by-token-ids?${position}=${tokenMint}`;
      console.log(`  📡 Fetching pools: ${url}`);
      
      const response = await axios.get<LocalPoolInfo[]>(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (Array.isArray(response.data)) {
        console.log(`  ✅ Found ${response.data.length} pools with token as ${position}`);
        return response.data;
      } else {
        console.log(`  ⚠️ Unexpected response format for ${position} query`);
        return [];
      }
      
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`  ❌ Local pools service not running on ${this.baseUrl}`);
      } else if (error.response?.status === 404) {
        console.log(`  📭 No pools found with token as ${position}`);
      } else {
        console.error(`  ❌ Error fetching pools for ${position}:`, error.message);
      }
      return [];
    }
  }

  /**
   * Get live state of a specific pool
   */
  async getPoolState(poolId: string): Promise<LocalPoolState | null> {
    const cacheKey = poolId;
    const cached = this.poolStateCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`📋 Using cached state for pool ${poolId}`);
      return cached.state;
    }

    try {
      console.log(`🔍 Fetching state for pool: ${poolId}`);
      
      const url = `${this.baseUrl}/pool/by-id/${poolId}`;
      const response = await axios.get<LocalPoolState>(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const state = response.data;
      state.lastUpdated = Date.now();
      
      // Cache the state
      this.poolStateCache.set(cacheKey, {
        state,
        timestamp: Date.now()
      });

      console.log(`✅ Pool state retrieved: price=${state.price}, liquidity=${state.liquidity}`);
      return state;
      
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`❌ Local pools service not running on ${this.baseUrl}`);
      } else if (error.response?.status === 404) {
        console.error(`❌ Pool ${poolId} not found`);
      } else {
        console.error(`❌ Error fetching pool state for ${poolId}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Get the best pool for a token based on liquidity and reliability
   */
  async getBestPool(tokenMint: string, preferredQuoteToken?: string): Promise<{ pool: LocalPoolInfo; state: LocalPoolState } | null> {
    const pools = await this.getPoolsByToken(tokenMint);
    
    if (pools.length === 0) {
      console.log(`❌ No pools found for token ${tokenMint}`);
      return null;
    }

    // Score pools based on various criteria
    const scoredPools = this.scorePools(pools, tokenMint, preferredQuoteToken);
    
    if (scoredPools.length === 0) {
      console.log(`❌ No suitable pools found after scoring for ${tokenMint}`);
      return null;
    }

    // Get state for the best pools (try up to 3 in case one fails)
    for (const { pool } of scoredPools.slice(0, 3)) {
      const state = await this.getPoolState(pool.id);
      if (state) {
        console.log(`🏆 Selected best pool for ${tokenMint}: ${pool.id} (${pool.type}, liquidity: ${state.liquidity})`);
        return { pool, state };
      }
    }

    console.log(`❌ Failed to get state for any pools for ${tokenMint}`);
    return null;
  }

  /**
   * Score pools to find the best one
   */
  private scorePools(
    pools: LocalPoolInfo[], 
    tokenMint: string, 
    preferredQuoteToken?: string
  ): Array<{ pool: LocalPoolInfo; score: number; reasons: string[] }> {
    const scores: Array<{ pool: LocalPoolInfo; score: number; reasons: string[] }> = [];

    // Quote token preferences
    const quoteTokenScores = new Map([
      ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 100], // USDC
      ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 90],  // USDT
      ['So11111111111111111111111111111111111111112', 80],     // SOL
      ['mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', 70],     // mSOL
    ]);

    for (const pool of pools) {
      let score = 0;
      const reasons: string[] = [];

      // Liquidity score
      if (pool.liquidity) {
        const liquidityNum = parseFloat(pool.liquidity);
        if (liquidityNum > 0) {
          score += Math.log10(liquidityNum) * 10;
          reasons.push(`liquidity: ${(liquidityNum / 1000000).toFixed(1)}M`);
        }
      }

      // DEX type preference
      switch (pool.type.toLowerCase()) {
        case 'raydium':
          score += 100;
          reasons.push('Raydium');
          break;
        case 'orca':
          score += 90;
          reasons.push('Orca');
          break;
        case 'whirlpool':
          score += 85;
          reasons.push('Whirlpool');
          break;
        case 'meteora':
          score += 70;
          reasons.push('Meteora');
          break;
        case 'saber':
          score += 60;
          reasons.push('Saber');
          break;
        default:
          score += 50;
          reasons.push(pool.type);
      }

      // Preferred quote token bonus
      if (preferredQuoteToken) {
        if (pool.token0.mint === preferredQuoteToken || pool.token1.mint === preferredQuoteToken) {
          score += 50;
          reasons.push('preferred quote');
        }
      }

      // Popular quote token bonus
      const token0Score = quoteTokenScores.get(pool.token0.mint) || 0;
      const token1Score = quoteTokenScores.get(pool.token1.mint) || 0;
      
      if (token0Score > 0) {
        score += token0Score;
        reasons.push(`quote: ${pool.token0.symbol || 'token0'}`);
      }
      if (token1Score > 0) {
        score += token1Score;
        reasons.push(`quote: ${pool.token1.symbol || 'token1'}`);
      }

      // Volume bonus
      if (pool.volume24h) {
        const volume = parseFloat(pool.volume24h);
        if (volume > 1000000) { // > $1M volume
          score += 30;
          reasons.push('high volume');
        } else if (volume > 100000) { // > $100K volume
          score += 15;
          reasons.push('good volume');
        }
      }

      if (score > 0) {
        scores.push({ pool, score, reasons });
      }
    }

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Get price for a token from the best available pool
   */
  async getTokenPrice(tokenMint: string, preferredQuoteToken?: string): Promise<{
    price: number;
    poolId: string;
    baseToken: string;
    quoteToken: string;
    source: string;
  } | null> {
    const result = await this.getBestPool(tokenMint, preferredQuoteToken);
    
    if (!result) {
      return null;
    }

    const { pool, state } = result;
    
    // Determine which token is our target and calculate price accordingly
    let price: number;
    let baseToken: string;
    let quoteToken: string;

    if (pool.token0.mint === tokenMint) {
      // Our token is token0, price is in terms of token1
      price = parseFloat(state.token1Amount) / parseFloat(state.token0Amount);
      baseToken = pool.token0.mint;
      quoteToken = pool.token1.mint;
    } else if (pool.token1.mint === tokenMint) {
      // Our token is token1, price is in terms of token0
      price = parseFloat(state.token0Amount) / parseFloat(state.token1Amount);
      baseToken = pool.token1.mint;
      quoteToken = pool.token0.mint;
    } else {
      console.error(`❌ Token ${tokenMint} not found in pool ${pool.id}`);
      return null;
    }

    // Adjust for decimals
    const baseDecimals = pool.token0.mint === tokenMint ? pool.token0.decimals : pool.token1.decimals;
    const quoteDecimals = pool.token0.mint === tokenMint ? pool.token1.decimals : pool.token0.decimals;
    
    const decimalAdjustment = Math.pow(10, quoteDecimals - baseDecimals);
    price = price * decimalAdjustment;

    return {
      price,
      poolId: pool.id,
      baseToken,
      quoteToken,
      source: pool.type
    };
  }

  /**
   * Check if the local pools service is available
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      try {
        // Fallback: try a simple pools query
        await axios.get(`${this.baseUrl}/pool/by-token-ids?token0=So11111111111111111111111111111111111111112`, { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.poolCache.clear();
    this.poolStateCache.clear();
    console.log('🗑️ Local pools service cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { 
    poolsCached: number; 
    statesCached: number; 
    serviceUrl: string; 
  } {
    return {
      poolsCached: this.poolCache.size,
      statesCached: this.poolStateCache.size,
      serviceUrl: this.baseUrl
    };
  }
}

// Export singleton instance
export const localPoolsService = new LocalPoolsService(); 