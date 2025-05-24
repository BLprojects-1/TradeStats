import { PublicKey, Connection } from '@solana/web3.js';
import axios from 'axios';

// Pool information structure
export interface DiscoveredPool {
  address: PublicKey;
  tokenA: PublicKey;
  tokenB: PublicKey;
  programId: PublicKey;
  liquidity?: number; // USD value of liquidity
  volume24h?: number; // 24h volume in USD
  lastUpdated: number; // Timestamp
  source: 'raydium' | 'orca' | 'whirlpool' | 'jupiter' | 'manual';
}

// Pool scoring criteria for selection
interface PoolScore {
  pool: DiscoveredPool;
  score: number;
  reasons: string[];
}

// DEX Program IDs for different AMMs
const DEX_PROGRAM_IDS = {
  RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  RAYDIUM_V5: '5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h',
  ORCA_V1: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  ORCA_V2: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  METEORA: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
  LIFINITY: 'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S'
};

// SOL mint address (wrapped SOL)
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Popular quote tokens for scoring
const QUOTE_TOKENS = new Map([
  ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', { symbol: 'USDC', priority: 100 }],
  ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', { symbol: 'USDT', priority: 90 }],
  ['So11111111111111111111111111111111111111112', { symbol: 'SOL', priority: 80 }],
  ['mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', { symbol: 'mSOL', priority: 70 }],
  ['7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', { symbol: 'ETH', priority: 60 }],
]);

export class PoolDiscoveryService {
  private poolsByMint = new Map<string, DiscoveredPool[]>();
  private allPools = new Map<string, DiscoveredPool>();
  private lastIndexTime = 0;
  private readonly INDEX_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly rpcEndpoint = 'https://lb.drpc.org/ogrpc?network=solana&dkey=AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF';
  private isIndexing = false;

  constructor() {
    console.log('🔍 PoolDiscoveryService initialized');
    // Start initial indexing
    this.indexPools().catch(err => console.error('Initial pool indexing failed:', err));
  }

  /**
   * Get the best pool for a token pair (preferably with SOL or major stablecoins)
   */
  async getBestPool(tokenMint: string, quoteMint?: string): Promise<DiscoveredPool | null> {
    await this.ensureFreshIndex();
    
    const mint = tokenMint.toString();
    const pools = this.poolsByMint.get(mint) || [];
    
    if (pools.length === 0) {
      console.log(`No pools found for token ${mint}`);
      return null;
    }

    // Score and rank pools
    const scoredPools = this.scorePools(pools, quoteMint);
    
    if (scoredPools.length === 0) {
      console.log(`No suitable pools found for token ${mint}`);
      return null;
    }

    const bestPool = scoredPools[0];
    console.log(`Selected pool for ${mint}: ${bestPool.pool.address.toString()} (score: ${bestPool.score}, reasons: ${bestPool.reasons.join(', ')})`);
    
    return bestPool.pool;
  }

  /**
   * Get all pools for a specific token
   */
  getPoolsForToken(tokenMint: string): DiscoveredPool[] {
    return this.poolsByMint.get(tokenMint.toString()) || [];
  }

  /**
   * Get pool statistics
   */
  getStats(): { totalPools: number; poolsByDex: Record<string, number>; lastIndexed: Date } {
    const poolsByDex: Record<string, number> = {};
    
    for (const pool of this.allPools.values()) {
      const source = pool.source;
      poolsByDex[source] = (poolsByDex[source] || 0) + 1;
    }

    return {
      totalPools: this.allPools.size,
      poolsByDex,
      lastIndexed: new Date(this.lastIndexTime)
    };
  }

  /**
   * Force refresh of pool index
   */
  async forceRefresh(): Promise<void> {
    console.log('🔄 Forcing pool index refresh...');
    this.lastIndexTime = 0; // Reset to force refresh
    await this.indexPools();
  }

  /**
   * Ensure pool index is fresh
   */
  private async ensureFreshIndex(): Promise<void> {
    const now = Date.now();
    if (now - this.lastIndexTime > this.INDEX_INTERVAL && !this.isIndexing) {
      await this.indexPools();
    }
  }

  /**
   * Main indexing function - discovers pools from all DEX programs
   */
  private async indexPools(): Promise<void> {
    if (this.isIndexing) {
      console.log('Pool indexing already in progress, skipping...');
      return;
    }

    this.isIndexing = true;
    const startTime = Date.now();
    
    try {
      console.log('🏊 Starting comprehensive pool discovery...');
      
      // Clear existing data
      this.poolsByMint.clear();
      this.allPools.clear();

      // Start with high-priority known pools for immediate availability
      await this.addKnownPools();

      // Discover pools from Jupiter (fastest and most comprehensive)
      await this.discoverFromJupiter();

      // Discover from major DEX programs (comprehensive but slower)
      // await this.discoverFromDexPrograms(); // Commented out for now to avoid RPC limits

      // Build the mint->pools mapping
      this.buildMintMapping();

      this.lastIndexTime = Date.now();
      const duration = this.lastIndexTime - startTime;
      
      console.log(`✅ Pool discovery completed in ${duration}ms`);
      console.log(`📊 Indexed ${this.allPools.size} pools across ${this.poolsByMint.size} unique tokens`);
      
    } catch (error) {
      console.error('❌ Pool indexing failed:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Add high-priority known pools for immediate availability
   */
  private async addKnownPools(): Promise<void> {
    const knownPools: Array<{
      address: string;
      tokenA: string;
      tokenB: string;
      programId: string;
      source: 'manual';
      liquidity?: number;
    }> = [
      // SOL/USDC (Raydium) - Most important for SOL price
      {
        address: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
        tokenA: 'So11111111111111111111111111111111111111112',
        tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
        source: 'manual' as const,
        liquidity: 50000000 // High liquidity score
      },
      // SOL/USDC (Orca)
      {
        address: 'EGZ7tiLeH62TPV1gL8WwbXGzEPa9zmcpVnnkPKKnrE2U',
        tokenA: 'So11111111111111111111111111111111111111112',
        tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        programId: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
        source: 'manual' as const,
        liquidity: 30000000
      },
      // SOL/USDT (Raydium)
      {
        address: 'HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz',
        tokenA: 'So11111111111111111111111111111111111111112',
        tokenB: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
        source: 'manual' as const,
        liquidity: 20000000
      },
      // USDC/USDT
      {
        address: '77quYg4MGneUdjgXCunt9GgM1usmrxKY31twEy3WHwcS',
        tokenA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tokenB: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
        source: 'manual' as const,
        liquidity: 10000000
      }
    ];

    for (const poolData of knownPools) {
      try {
        const pool: DiscoveredPool = {
          address: new PublicKey(poolData.address),
          tokenA: new PublicKey(poolData.tokenA),
          tokenB: new PublicKey(poolData.tokenB),
          programId: new PublicKey(poolData.programId),
          liquidity: poolData.liquidity,
          lastUpdated: Date.now(),
          source: poolData.source
        };

        this.allPools.set(poolData.address, pool);
      } catch (error) {
        console.error(`Failed to add known pool ${poolData.address}:`, error);
      }
    }

    console.log(`Added ${knownPools.length} known high-priority pools`);
  }

  /**
   * Discover pools from Jupiter's API (fastest and most comprehensive)
   */
  private async discoverFromJupiter(): Promise<void> {
    try {
      console.log('🪐 Discovering pools from Jupiter...');
      
      // Get route map from Jupiter - this contains all available token pairs
      const response = await axios.get('https://quote-api.jup.ag/v6/route-map', {
        timeout: 30000
      });

      const routeMap = response.data as Record<string, string[]>;
      let discoveredCount = 0;

      // Process route map to find pools
      for (const [inputMint, outputMints] of Object.entries(routeMap)) {
        if (Array.isArray(outputMints)) {
          for (const outputMint of outputMints) {
            // Skip if we already have pools for this pair
            const poolKey = `${inputMint}-${outputMint}`;
            if (this.allPools.has(poolKey)) continue;

            try {
              // Create a virtual pool entry (Jupiter handles the routing)
              const pool: DiscoveredPool = {
                address: new PublicKey(this.generateVirtualAddress(inputMint, outputMint)),
                tokenA: new PublicKey(inputMint),
                tokenB: new PublicKey(outputMint),
                programId: new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'), // Jupiter v6
                liquidity: 1000000, // Default liquidity score for Jupiter routes
                lastUpdated: Date.now(),
                source: 'jupiter'
              };

              this.allPools.set(poolKey, pool);
              discoveredCount++;

              // Limit to prevent memory issues
              if (discoveredCount > 50000) break;
            } catch (error) {
              // Skip invalid mint addresses
              continue;
            }
          }
          if (discoveredCount > 50000) break;
        }
      }

      console.log(`🎯 Discovered ${discoveredCount} token pairs from Jupiter`);
    } catch (error) {
      console.error('Failed to discover pools from Jupiter:', error);
    }
  }

  /**
   * Discover pools from DEX program accounts (comprehensive but slow)
   * This would be used for more accurate liquidity data
   */
  private async discoverFromDexPrograms(): Promise<void> {
    console.log('🏗️ Discovering pools from DEX programs...');
    
    const programs = [
      { id: DEX_PROGRAM_IDS.RAYDIUM_V4, name: 'Raydium V4' },
      { id: DEX_PROGRAM_IDS.ORCA_V1, name: 'Orca V1' },
      // Add more as needed
    ];

    for (const program of programs) {
      try {
        await this.discoverFromProgram(program.id, program.name);
      } catch (error) {
        console.error(`Failed to discover pools from ${program.name}:`, error);
      }
    }
  }

  /**
   * Discover pools from a specific DEX program
   */
  private async discoverFromProgram(programId: string, programName: string): Promise<void> {
    try {
      // This would use getProgramAccounts to find all pools
      // For now, we'll skip this to avoid RPC rate limits
      console.log(`Skipping ${programName} program account discovery (would use too many RPC calls)`);
    } catch (error) {
      console.error(`Failed to discover pools from ${programName}:`, error);
    }
  }

  /**
   * Build mapping from token mints to their pools
   */
  private buildMintMapping(): void {
    this.poolsByMint.clear();

    for (const pool of this.allPools.values()) {
      const tokenA = pool.tokenA.toString();
      const tokenB = pool.tokenB.toString();

      // Add pool to both tokens
      if (!this.poolsByMint.has(tokenA)) {
        this.poolsByMint.set(tokenA, []);
      }
      if (!this.poolsByMint.has(tokenB)) {
        this.poolsByMint.set(tokenB, []);
      }

      this.poolsByMint.get(tokenA)!.push(pool);
      this.poolsByMint.get(tokenB)!.push(pool);
    }
  }

  /**
   * Score pools to select the best one for trading
   */
  private scorePools(pools: DiscoveredPool[], preferredQuote?: string): PoolScore[] {
    const scores: PoolScore[] = [];

    for (const pool of pools) {
      let score = 0;
      const reasons: string[] = [];

      // Base liquidity score
      if (pool.liquidity) {
        score += Math.log10(pool.liquidity) * 10;
        reasons.push(`liquidity: ${(pool.liquidity / 1000000).toFixed(1)}M`);
      }

      // Preferred quote token bonus
      const tokenAStr = pool.tokenA.toString();
      const tokenBStr = pool.tokenB.toString();
      
      if (preferredQuote) {
        if (tokenAStr === preferredQuote || tokenBStr === preferredQuote) {
          score += 50;
          reasons.push('preferred quote');
        }
      }

      // Quote token priority bonus
      const quoteTokenA = QUOTE_TOKENS.get(tokenAStr);
      const quoteTokenB = QUOTE_TOKENS.get(tokenBStr);
      
      if (quoteTokenA) {
        score += quoteTokenA.priority;
        reasons.push(`quote: ${quoteTokenA.symbol}`);
      }
      if (quoteTokenB) {
        score += quoteTokenB.priority;
        reasons.push(`quote: ${quoteTokenB.symbol}`);
      }

      // Source preference
      switch (pool.source) {
        case 'manual':
          score += 100; // Highest priority for known good pools
          reasons.push('known pool');
          break;
        case 'raydium':
          score += 80;
          reasons.push('Raydium');
          break;
        case 'orca':
          score += 70;
          reasons.push('Orca');
          break;
        case 'jupiter':
          score += 50;
          reasons.push('Jupiter route');
          break;
      }

      // Recency bonus
      const age = Date.now() - pool.lastUpdated;
      if (age < 60000) { // Less than 1 minute old
        score += 20;
        reasons.push('fresh');
      }

      if (score > 0) {
        scores.push({ pool, score, reasons });
      }
    }

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Generate a virtual address for Jupiter routes
   */
  private generateVirtualAddress(inputMint: string, outputMint: string): string {
    // Create a deterministic but fake address for Jupiter routes
    const combined = inputMint + outputMint;
    const hash = this.simpleHash(combined);
    // Create a valid base58 address-like string
    return hash.padEnd(44, '1'); // Base58 addresses are typically 32-44 chars
  }

  /**
   * Simple hash function for generating virtual addresses
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Export singleton instance
export const poolDiscoveryService = new PoolDiscoveryService(); 