import { PublicKey, Connection, GetProgramAccountsConfig, GetProgramAccountsResponse } from '@solana/web3.js';
import axios from 'axios';

// Pool information structure for discovered pools
export interface DiscoveredPool {
  address: PublicKey;
  tokenA: PublicKey;
  tokenB: PublicKey;
  programId: PublicKey;
  reserveA: bigint;
  reserveB: bigint;
  decimalsA: number;
  decimalsB: number;
  liquidity?: number; // USD value of liquidity
  volume24h?: number; // 24h volume in USD
  lastUpdated: number; // Timestamp
  source: 'raydium' | 'orca' | 'whirlpool' | 'meteora' | 'lifinity' | 'saber';
  poolType: 'amm' | 'stable' | 'concentrated';
}

// DEX Program IDs and their configurations
const DEX_PROGRAMS = {
  RAYDIUM_AMM_V4: {
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    name: 'Raydium V4',
    source: 'raydium' as const,
    poolType: 'amm' as const,
    accountSize: 752, // Raydium AMM pool account size
  },
  RAYDIUM_AMM_V5: {
    programId: '5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h',
    name: 'Raydium V5',
    source: 'raydium' as const,
    poolType: 'amm' as const,
    accountSize: 752,
  },
  ORCA_V1: {
    programId: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
    name: 'Orca V1',
    source: 'orca' as const,
    poolType: 'amm' as const,
    accountSize: 324, // Orca pool account size
  },
  ORCA_WHIRLPOOL: {
    programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    name: 'Orca Whirlpool',
    source: 'whirlpool' as const,
    poolType: 'concentrated' as const,
    accountSize: 653, // Whirlpool account size
  },
  METEORA: {
    programId: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
    name: 'Meteora',
    source: 'meteora' as const,
    poolType: 'amm' as const,
    accountSize: 1024, // Meteora pool account size
  },
  LIFINITY: {
    programId: 'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S',
    name: 'Lifinity',
    source: 'lifinity' as const,
    poolType: 'amm' as const,
    accountSize: 648, // Lifinity pool account size
  },
  SABER: {
    programId: 'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ',
    name: 'Saber',
    source: 'saber' as const,
    poolType: 'stable' as const,
    accountSize: 324, // Saber stable pool account size
  }
};

// Popular quote tokens for scoring
const QUOTE_TOKENS = new Map([
  ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', { symbol: 'USDC', priority: 100 }],
  ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', { symbol: 'USDT', priority: 90 }],
  ['So11111111111111111111111111111111111111112', { symbol: 'SOL', priority: 80 }],
  ['mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', { symbol: 'mSOL', priority: 70 }],
  ['7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', { symbol: 'ETH', priority: 60 }],
]);

export class ComprehensivePoolDiscovery {
  private poolsByMint = new Map<string, DiscoveredPool[]>();
  private allPools = new Map<string, DiscoveredPool>();
  private lastIndexTime = 0;
  private readonly INDEX_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly rpcEndpoint = 'https://lb.drpc.org/ogrpc?network=solana&dkey=AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF';
  private connection: Connection;
  private isIndexing = false;

  constructor() {
    this.connection = new Connection(this.rpcEndpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
    console.log('🔍 ComprehensivePoolDiscovery initialized');
    // Start initial indexing
    this.indexAllPools().catch(err => console.error('Initial pool indexing failed:', err));
  }

  /**
   * Get the best pool for a token pair using comprehensive discovery
   */
  async getBestPool(tokenMint: string, quoteMint?: string): Promise<DiscoveredPool | null> {
    await this.ensureFreshIndex();
    
    const mint = tokenMint.toString();
    const pools = this.poolsByMint.get(mint) || [];
    
    if (pools.length === 0) {
      console.log(`No pools found for token ${mint}, attempting targeted discovery...`);
      
      // Try targeted discovery for this specific token
      const targetedPools = await this.discoverPoolsForToken(mint);
      if (targetedPools.length > 0) {
        // Add discovered pools to our cache
        targetedPools.forEach(pool => {
          this.allPools.set(pool.address.toString(), pool);
        });
        this.buildMintMapping();
        
        // Now try again
        const newPools = this.poolsByMint.get(mint) || [];
        if (newPools.length > 0) {
          const scoredPools = this.scorePools(newPools, quoteMint);
          if (scoredPools.length > 0) {
            const bestPool = scoredPools[0];
            console.log(`🎯 Found pool via targeted discovery: ${bestPool.pool.address.toString()}`);
            return bestPool.pool;
          }
        }
      }
      
      return null;
    }

    // Score and rank pools
    const scoredPools = this.scorePools(pools, quoteMint);
    
    if (scoredPools.length === 0) {
      console.log(`No suitable pools found for token ${mint}`);
      return null;
    }

    const bestPool = scoredPools[0];
    console.log(`Selected pool for ${mint}: ${bestPool.pool.address.toString()} (source: ${bestPool.pool.source}, liquidity: $${bestPool.pool.liquidity?.toLocaleString()})`);
    
    return bestPool.pool;
  }

  /**
   * Discover pools for a specific token using targeted getProgramAccounts calls
   */
  private async discoverPoolsForToken(tokenMint: string): Promise<DiscoveredPool[]> {
    console.log(`🎯 Starting targeted pool discovery for token: ${tokenMint}`);
    
    const discoveredPools: DiscoveredPool[] = [];
    const tokenPublicKey = new PublicKey(tokenMint);

    // Search each DEX program for pools containing this token
    for (const [dexKey, dexConfig] of Object.entries(DEX_PROGRAMS)) {
      try {
        console.log(`  📡 Scanning ${dexConfig.name} for token ${tokenMint}...`);
        
        const pools = await this.scanDexForToken(tokenPublicKey, dexConfig);
        discoveredPools.push(...pools);
        
        if (pools.length > 0) {
          console.log(`    ✅ Found ${pools.length} pools in ${dexConfig.name}`);
        }
      } catch (error) {
        console.error(`    ❌ Error scanning ${dexConfig.name}:`, error);
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`🎯 Targeted discovery complete: found ${discoveredPools.length} pools for ${tokenMint}`);
    return discoveredPools;
  }

  /**
   * Scan a specific DEX program for pools containing a token
   */
  private async scanDexForToken(tokenMint: PublicKey, dexConfig: any): Promise<DiscoveredPool[]> {
    const pools: DiscoveredPool[] = [];
    
    try {
      // For Raydium, search by both baseMint and quoteMint positions
      if (dexConfig.source === 'raydium') {
        console.log(`    📡 Scanning Raydium for ${tokenMint.toString()}...`);
        
        // Based on Raydium AMM state structure research:
        // The coin_mint (baseMint) is typically at offset 400 (0x190)
        // The pc_mint (quoteMint) is typically at offset 432 (0x1B0)
        
        // Search as base token (coin_mint)
        const baseResults = await this.getProgramAccountsWithFilters(
          new PublicKey(dexConfig.programId),
          [
            { dataSize: dexConfig.accountSize },
            {
              memcmp: {
                offset: 400, // coin_mint offset in Raydium pool structure
                bytes: tokenMint.toBase58(),
              },
            },
          ]
        );
        
        console.log(`      🔍 Found ${baseResults.length} pools with token as base`);
        
        // Search as quote token (pc_mint)
        const quoteResults = await this.getProgramAccountsWithFilters(
          new PublicKey(dexConfig.programId),
          [
            { dataSize: dexConfig.accountSize },
            {
              memcmp: {
                offset: 432, // pc_mint offset in Raydium pool structure
                bytes: tokenMint.toBase58(),
              },
            },
          ]
        );
        
        console.log(`      🔍 Found ${quoteResults.length} pools with token as quote`);
        
        // Process both sets of results
        const allResults = [...baseResults, ...quoteResults];
        for (const result of allResults) {
          try {
            const pool = await this.parseRaydiumPool(result.account.data, result.pubkey, dexConfig);
            if (pool) {
              console.log(`        ✅ Parsed Raydium pool: ${pool.address.toString()}`);
              console.log(`           Token A: ${pool.tokenA.toString()}`);
              console.log(`           Token B: ${pool.tokenB.toString()}`);
              pools.push(pool);
            }
          } catch (parseError) {
            console.error(`        ❌ Error parsing Raydium pool:`, parseError);
          }
        }
      }
      
      // For Orca V1
      else if (dexConfig.source === 'orca') {
        console.log(`    📡 Scanning Orca V1 for ${tokenMint.toString()}...`);
        
        // Orca V1 pool structure has different offsets
        // Search as mintA
        const mintAResults = await this.getProgramAccountsWithFilters(
          new PublicKey(dexConfig.programId),
          [
            { dataSize: dexConfig.accountSize },
            {
              memcmp: {
                offset: 101, // mintA offset in Orca pool structure
                bytes: tokenMint.toBase58(),
              },
            },
          ]
        );
        
        // Search as mintB
        const mintBResults = await this.getProgramAccountsWithFilters(
          new PublicKey(dexConfig.programId),
          [
            { dataSize: dexConfig.accountSize },
            {
              memcmp: {
                offset: 133, // mintB offset in Orca pool structure
                bytes: tokenMint.toBase58(),
              },
            },
          ]
        );
        
        console.log(`      🔍 Found ${mintAResults.length + mintBResults.length} Orca pools`);
        
        const allResults = [...mintAResults, ...mintBResults];
        for (const result of allResults) {
          try {
            const pool = await this.parseOrcaPool(result.account.data, result.pubkey, dexConfig);
            if (pool) {
              console.log(`        ✅ Parsed Orca pool: ${pool.address.toString()}`);
              pools.push(pool);
            }
          } catch (parseError) {
            console.error(`        ❌ Error parsing Orca pool:`, parseError);
          }
        }
      }
      
      // For Whirlpool (Orca V2)
      else if (dexConfig.source === 'whirlpool') {
        console.log(`    📡 Scanning Whirlpool for ${tokenMint.toString()}...`);
        
        // Search as tokenMintA
        const mintAResults = await this.getProgramAccountsWithFilters(
          new PublicKey(dexConfig.programId),
          [
            { dataSize: dexConfig.accountSize },
            {
              memcmp: {
                offset: 101, // tokenMintA offset in Whirlpool structure
                bytes: tokenMint.toBase58(),
              },
            },
          ]
        );
        
        // Search as tokenMintB
        const mintBResults = await this.getProgramAccountsWithFilters(
          new PublicKey(dexConfig.programId),
          [
            { dataSize: dexConfig.accountSize },
            {
              memcmp: {
                offset: 181, // tokenMintB offset in Whirlpool structure
                bytes: tokenMint.toBase58(),
              },
            },
          ]
        );
        
        console.log(`      🔍 Found ${mintAResults.length + mintBResults.length} Whirlpool pools`);
        
        const allResults = [...mintAResults, ...mintBResults];
        for (const result of allResults) {
          try {
            const pool = await this.parseWhirlpool(result.account.data, result.pubkey, dexConfig);
            if (pool) {
              console.log(`        ✅ Parsed Whirlpool: ${pool.address.toString()}`);
              pools.push(pool);
            }
          } catch (parseError) {
            console.error(`        ❌ Error parsing Whirlpool:`, parseError);
          }
        }
      }
      
    } catch (error) {
      console.error(`    ❌ Error scanning ${dexConfig.name} for token ${tokenMint.toString()}:`, error);
    }
    
    return pools;
  }

  /**
   * Helper method to call getProgramAccounts with proper error handling and retries
   */
  private async getProgramAccountsWithFilters(
    programId: PublicKey,
    filters: any[],
    maxRetries = 3
  ): Promise<GetProgramAccountsResponse> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const config: GetProgramAccountsConfig = {
          commitment: 'confirmed',
          filters,
          encoding: 'base64',
        };
        
        console.log(`    🔍 getProgramAccounts call (attempt ${attempt}/${maxRetries})`);
        
        const accounts = await this.connection.getProgramAccounts(programId, config);
        
        console.log(`    📊 Found ${accounts.length} matching accounts`);
        return accounts;
        
      } catch (error: any) {
        console.error(`    ❌ getProgramAccounts attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`    ⏱️  Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return [];
  }

  /**
   * Parse Raydium pool data
   */
  private async parseRaydiumPool(data: Buffer, pubkey: PublicKey, dexConfig: any): Promise<DiscoveredPool | null> {
    try {
      if (data.length < 752) {
        console.log(`        ⚠️  Pool data too short: ${data.length} bytes (expected 752)`);
        return null;
      }
      
      // Log the first few bytes to debug the status field
      console.log(`        🔍 First 16 bytes: ${Array.from(data.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      
      // Read status field - Raydium uses different status values
      // We'll be more permissive here since we're just discovering pools
      const status = data.readBigUInt64LE(0);
      console.log(`        📊 Pool status: ${status}`);
      
      // For discovery, we'll accept various status values, not just 6
      // Status values in Raydium: 0=uninitialized, 1=initialized, 3=disabled_deposit, 4=disabled_withdraw, 6=enabled
      if (status === BigInt(0)) {
        console.log(`        ❌ Pool uninitialized (status 0)`);
        return null;
      }
      
      // Read mint addresses at the researched offsets
      const baseMint = new PublicKey(data.slice(400, 432));
      const quoteMint = new PublicKey(data.slice(432, 464));
      
      console.log(`        🪙 Base mint: ${baseMint.toString()}`);
      console.log(`        🪙 Quote mint: ${quoteMint.toString()}`);
      
      // Basic validation - ensure mints are not zero
      if (baseMint.toString() === '11111111111111111111111111111111' || 
          quoteMint.toString() === '11111111111111111111111111111111') {
        console.log(`        ❌ Invalid mint address detected`);
        return null;
      }
      
      // Try to read decimals, but use defaults if they seem wrong
      let baseDecimals = 9;  // Default for most tokens
      let quoteDecimals = 6; // Default for USDC/USDT
      
      try {
        // These might be at different offsets, so we'll use sensible defaults
        const readBaseDecimals = Number(data.readBigUInt64LE(32));
        const readQuoteDecimals = Number(data.readBigUInt64LE(40));
        
        if (readBaseDecimals >= 0 && readBaseDecimals <= 18) {
          baseDecimals = readBaseDecimals;
        }
        if (readQuoteDecimals >= 0 && readQuoteDecimals <= 18) {
          quoteDecimals = readQuoteDecimals;
        }
      } catch (e) {
        console.log(`        ⚠️  Using default decimals (base: ${baseDecimals}, quote: ${quoteDecimals})`);
      }
      
      const pool: DiscoveredPool = {
        address: pubkey,
        tokenA: baseMint,
        tokenB: quoteMint,
        programId: new PublicKey(dexConfig.programId),
        reserveA: BigInt(0),
        reserveB: BigInt(0),
        decimalsA: baseDecimals,
        decimalsB: quoteDecimals,
        lastUpdated: Date.now(),
        source: dexConfig.source,
        poolType: dexConfig.poolType,
      };
      
      return pool;
    } catch (error) {
      console.error(`        ❌ Error parsing Raydium pool:`, error);
      return null;
    }
  }

  /**
   * Parse Orca pool data
   */
  private async parseOrcaPool(data: Buffer, pubkey: PublicKey, dexConfig: any): Promise<DiscoveredPool | null> {
    try {
      if (data.length < 324) {
        return null;
      }
      
      // Check if pool is initialized
      const isInitialized = data[0] === 1;
      if (!isInitialized) {
        return null;
      }
      
      // Read mint addresses
      const mintA = new PublicKey(data.slice(101, 133));
      const mintB = new PublicKey(data.slice(133, 165));
      
      const pool: DiscoveredPool = {
        address: pubkey,
        tokenA: mintA,
        tokenB: mintB,
        programId: new PublicKey(dexConfig.programId),
        reserveA: BigInt(0),
        reserveB: BigInt(0),
        decimalsA: 9, // Default, would need to fetch from mint accounts
        decimalsB: 6, // Default, would need to fetch from mint accounts
        lastUpdated: Date.now(),
        source: dexConfig.source,
        poolType: dexConfig.poolType,
      };
      
      return pool;
    } catch (error) {
      console.error('Error parsing Orca pool:', error);
      return null;
    }
  }

  /**
   * Parse Whirlpool data
   */
  private async parseWhirlpool(data: Buffer, pubkey: PublicKey, dexConfig: any): Promise<DiscoveredPool | null> {
    try {
      if (data.length < 653) {
        return null;
      }
      
      // Read mint addresses from Whirlpool structure
      const tokenMintA = new PublicKey(data.slice(101, 133));
      const tokenMintB = new PublicKey(data.slice(181, 213));
      
      const pool: DiscoveredPool = {
        address: pubkey,
        tokenA: tokenMintA,
        tokenB: tokenMintB,
        programId: new PublicKey(dexConfig.programId),
        reserveA: BigInt(0),
        reserveB: BigInt(0),
        decimalsA: 9, // Default
        decimalsB: 6, // Default
        lastUpdated: Date.now(),
        source: dexConfig.source,
        poolType: dexConfig.poolType,
      };
      
      return pool;
    } catch (error) {
      console.error('Error parsing Whirlpool:', error);
      return null;
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
    
    console.log(`📊 Built mint mapping: ${this.poolsByMint.size} unique tokens, ${this.allPools.size} total pools`);
  }

  /**
   * Score pools to select the best one for trading
   */
  private scorePools(pools: DiscoveredPool[], preferredQuote?: string): Array<{ pool: DiscoveredPool; score: number; reasons: string[] }> {
    const scores: Array<{ pool: DiscoveredPool; score: number; reasons: string[] }> = [];

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
        case 'raydium':
          score += 100; // Highest priority for Raydium (most reliable)
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
        case 'lifinity':
          score += 60;
          reasons.push('Lifinity');
          break;
        case 'saber':
          score += 50;
          reasons.push('Saber');
          break;
      }

      // Pool type preference
      if (pool.poolType === 'amm') {
        score += 20;
        reasons.push('AMM');
      } else if (pool.poolType === 'stable') {
        score += 15;
        reasons.push('stable');
      }

      // Recency bonus
      const age = Date.now() - pool.lastUpdated;
      if (age < 300000) { // Less than 5 minutes old
        score += 10;
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
   * Ensure pool index is fresh
   */
  private async ensureFreshIndex(): Promise<void> {
    const now = Date.now();
    if (now - this.lastIndexTime > this.INDEX_INTERVAL && !this.isIndexing) {
      await this.indexAllPools();
    }
  }

  /**
   * Index all pools from all DEX programs (full discovery)
   */
  private async indexAllPools(): Promise<void> {
    if (this.isIndexing) {
      console.log('Pool indexing already in progress, skipping...');
      return;
    }

    this.isIndexing = true;
    const startTime = Date.now();
    
    try {
      console.log('🏊 Starting comprehensive pool discovery across all DEXs...');
      
      // Note: Full indexing is very RPC-intensive and slow
      // For production, you'd want to:
      // 1. Cache results more aggressively
      // 2. Use websocket subscriptions for real-time updates
      // 3. Index incrementally
      
      console.log('💡 Full indexing skipped to avoid RPC overload. Use targeted discovery instead.');
      
      this.lastIndexTime = Date.now();
      
    } catch (error) {
      console.error('❌ Pool indexing failed:', error);
    } finally {
      this.isIndexing = false;
    }
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
    console.log('🔄 Forcing comprehensive pool index refresh...');
    this.lastIndexTime = 0; // Reset to force refresh
    await this.indexAllPools();
  }

  /**
   * Get all pools for a specific token
   */
  getPoolsForToken(tokenMint: string): DiscoveredPool[] {
    return this.poolsByMint.get(tokenMint.toString()) || [];
  }
}

// Export singleton instance
export const comprehensivePoolDiscovery = new ComprehensivePoolDiscovery(); 