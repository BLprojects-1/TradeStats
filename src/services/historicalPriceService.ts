/**
 * Historical Price Service
 * Production service based on test-historical-pricing.js
 * Handles comprehensive trading data analysis with caching
 */

import axios from 'axios';
import { isValidSolanaAddress } from '../utils/userProfile';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { tradingHistoryService } from './tradingHistoryService';
import { TokenInfoService } from './tokenInfoService';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// DRPC Circuit Breaker and Retry Configuration
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  nextAttemptTime: number;
}

class DRPCCircuitBreaker {
  private static instance: DRPCCircuitBreaker;
  private circuitState: CircuitBreakerState = {
    failureCount: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
    nextAttemptTime: 0
  };

  private readonly maxFailures = 5;
  private readonly cooldownPeriod = 60000;
  private readonly timeout = 30000;

  static getInstance(): DRPCCircuitBreaker {
    if (!DRPCCircuitBreaker.instance) {
      DRPCCircuitBreaker.instance = new DRPCCircuitBreaker();
    }
    return DRPCCircuitBreaker.instance;
  }

  private isCircuitOpen(): boolean {
    if (this.circuitState.state === 'OPEN') {
      if (Date.now() > this.circuitState.nextAttemptTime) {
        this.circuitState.state = 'HALF_OPEN';
        console.log('Circuit breaker moving to HALF_OPEN state');
        return false;
      }
      return true;
    }
    return false;
  }

  private recordSuccess(): void {
    this.circuitState.failureCount = 0;
    this.circuitState.state = 'CLOSED';
    if (this.circuitState.failureCount > 0) {
      console.log('Circuit breaker reset to CLOSED state after successful request');
    }
  }

  private recordFailure(): void {
    this.circuitState.failureCount++;
    this.circuitState.lastFailureTime = Date.now();

    if (this.circuitState.failureCount >= this.maxFailures) {
      this.circuitState.state = 'OPEN';
      this.circuitState.nextAttemptTime = Date.now() + this.cooldownPeriod;
      console.warn(`🚨 DRPC Circuit breaker OPENED after ${this.maxFailures} failures. Cooling down for ${this.cooldownPeriod/1000}s`);
    }
  }

  async makeRequest<T>(requestFn: () => Promise<T>, context: string): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new Error(`DRPC Circuit breaker is OPEN. Service temporarily unavailable for ${context}. Try again in ${Math.ceil((this.circuitState.nextAttemptTime - Date.now()) / 1000)}s`);
    }

    const maxRetries = 4; // Increased retries
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 DRPC Request attempt ${attempt}/${maxRetries} for ${context}`);

        const result = await requestFn();
        this.recordSuccess();
        console.log(`✅ DRPC Request successful for ${context}`);
        return result;

      } catch (error: any) {
        lastError = error;

        // Enhanced error classification
        const is408Error = error.response?.status === 408 || error.code === 'ECONNABORTED';
        const isNetworkError = error.code === 'ENOTFOUND' || 
                              error.code === 'ECONNREFUSED' || 
                              error.code === 'ECONNRESET' ||
                              error.code === 'ETIMEDOUT';
        const isTimeoutError = is408Error || 
                              error.response?.status === 504 ||
                              error.message?.includes('timeout') ||
                              error.message?.includes('ETIMEDOUT') ||
                              isNetworkError;

        const isRetryableError = isTimeoutError || 
                               error.response?.status === 500 ||
                               error.response?.status === 502 ||
                               error.response?.status === 503 ||
                               error.response?.status === 520 ||
                               error.response?.status === 521 ||
                               error.response?.status === 522 ||
                               error.response?.status === 523 ||
                               error.response?.status === 524;

        // Special handling for different error types
        if (is408Error) {
          console.warn(`⏱️ 408 Timeout error for ${context} on attempt ${attempt}/${maxRetries}`);
        } else if (isNetworkError) {
          console.warn(`🌐 Network error (${error.code}) for ${context} on attempt ${attempt}/${maxRetries}`);
        }

        if (isRetryableError && attempt < maxRetries) {
          // Longer backoff for timeout and network errors
          const baseDelay = (is408Error || isNetworkError) ? 3000 : 1000;
          const backoffDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30s for serious errors
          const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
          const waitTime = backoffDelay + jitter;

          const errorContext = is408Error ? 'Timeout detected.' : 
                              isNetworkError ? 'Network issue detected.' : '';

          console.warn(`⚠️ DRPC Request failed for ${context} (attempt ${attempt}/${maxRetries}). ${errorContext} Retrying in ${Math.round(waitTime)}ms. Error: ${error.response?.status || error.code || error.message}`);
          await delay(waitTime);
          continue;
        }

        // Non-retryable error or max retries reached
        console.error(`❌ DRPC Request failed permanently for ${context} after ${attempt} attempts:`, error.response?.status || error.code || error.message);

        // Only record failure for the circuit breaker if it's not a client-side error
        if (!error.response || error.response.status >= 500 || isTimeoutError) {
          this.recordFailure();
        }
        break;
      }
    }

    throw lastError;
  }

  getAxiosConfig() {
    return {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
      // Add retry-specific axios configuration
      validateStatus: (status: number) => {
        // Don't throw for 4xx and 5xx errors, let our retry logic handle them
        return status < 600;
      }
    };
  }
}

// Type definitions
interface TradeData {
  signature: string;
  timestamp: number;
  tokenMint: string;
  tokenName: string;
  tokenChange: number;
  usdValue: number;
  solAmount: number;
  type: 'BUY' | 'SELL';
}

interface AnalysisResult {
  recentTrades: TradeData[];
  totalValue: number;
  profitLoss: number;
}

// Types
interface TokenInfo {
  symbol: string;
  name: string;
  logoURI: string | null;
}

interface TradeData {
  signature: string;
  timestamp: number;
  type: 'BUY' | 'SELL';
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI: string | null;
  tokenChange: number;
  solAmount: number;
  usdValue: number;
  fee: number;
  allTokenChanges?: Array<{
    mint: string;
    change: number;
  }>;
}

interface AnalysisResult {
  recentTrades: TradeData[];
  historicalTrades: Map<string, TradeData[]>;
  totalTrades: number;
  totalVolume: number;
  uniqueTokens: Set<string>;
}

interface CoinGeckoResponse {
  prices: Array<[number, number]>;
}

interface JupiterTokenResponse {
  name: string;
  symbol: string;
  logoURI: string | null;
}

interface JupiterTradableToken {
  address: string;
  name: string;
  symbol: string;
  logoURI: string | null;
}

interface AxiosErrorResponse {
  status: number;
  data: any;
}

interface AxiosError {
  response?: AxiosErrorResponse;
  message: string;
}

interface DRPCResponse {
  error?: any;
  result?: any;
}

interface DRPCParams {
  limit: number;
  commitment: string;
  before?: string;
  until?: string;
}

// Add new interface for scan status
interface ScanStatus {
  totalSignatures: number;
  processedSignatures: number;
  uniqueTokens: number;
  tradesFound: number;
  currentStep: string;
  isComplete: boolean;
}

// Add new interface for token list
interface TokenList {
  tokens: Map<string, TokenInfo>;
}

// Global token list state
const globalTokenList: TokenList = {
  tokens: new Map()
};

// Token Account Tracker
class TokenAccountTracker {
  private accounts = new Map<string, Set<string>>();

  addAccount(mint: string, pubkey: string): void {
    if (!this.accounts.has(mint)) {
      this.accounts.set(mint, new Set());
    }
    this.accounts.get(mint)!.add(pubkey);
  }

  getAccounts(mint: string): string[] {
    return Array.from(this.accounts.get(mint) || []);
  }

  hasAccounts(mint: string): boolean {
    return this.accounts.has(mint) && this.accounts.get(mint)!.size > 0;
  }

  getAllMints(): string[] {
    return Array.from(this.accounts.keys());
  }
}

// Cache for SOL prices and token info
const solPriceCache = new Map<string, number>();
const tokenInfoCache = new Map<string, TokenInfo>();

// Session cache for wallet analysis results
const walletAnalysisCache = new Map<string, {
  data: AnalysisResult;
  timestamp: number;
}>();

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Add rate limiting configuration
const JUPITER_RATE_LIMIT = {
  maxRequests: 10,
  timeWindow: 1000, // 1 second
  requests: [] as number[]
};


// Add rate limiting function
const checkRateLimit = async () => {
  const now = Date.now();
  JUPITER_RATE_LIMIT.requests = JUPITER_RATE_LIMIT.requests.filter(
    time => now - time < JUPITER_RATE_LIMIT.timeWindow
  );

  if (JUPITER_RATE_LIMIT.requests.length >= JUPITER_RATE_LIMIT.maxRequests) {
    const oldestRequest = JUPITER_RATE_LIMIT.requests[0];
    const waitTime = JUPITER_RATE_LIMIT.timeWindow - (now - oldestRequest);
    if (waitTime > 0) {
      await delay(waitTime);
    }
  }

  JUPITER_RATE_LIMIT.requests.push(now);
};

export class HistoricalPriceService {
  private DRPC_API_URL = process.env.NEXT_PUBLIC_DRPC_API_URL
    || 'https://lb.drpc.org/ogrpc?network=solana&dkey=AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF';
  private BACKUP_DRPC_URLS = [
    'https://solana-mainnet.g.alchemy.com/v2/' + (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'demo'),
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana'
  ];
  private COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
  private JUPITER_TOKEN_API_BASE = 'https://lite-api.jup.ag/tokens/v1';
  private tokenAccountTracker = new TokenAccountTracker();
  private walletAddress: string = '';
  private scanStatusCallback?: (status: ScanStatus) => void;
  private circuitBreaker = DRPCCircuitBreaker.getInstance();
  private currentDRPCIndex = 0; // Track which DRPC endpoint we're using

  // Add scan status tracking
  private currentScanStatus: ScanStatus = {
    totalSignatures: 0,
    processedSignatures: 0,
    uniqueTokens: 0,
    tradesFound: 0,
    currentStep: 'Initializing...',
    isComplete: false
  };

  constructor() {
    if (process.env.NEXT_PUBLIC_DRPC_API_URL) {
      this.DRPC_API_URL = process.env.NEXT_PUBLIC_DRPC_API_URL;
      console.log('🔧 Using custom DRPC API URL:', this.DRPC_API_URL);
    }
    console.log('🚀 HistoricalPriceService initialized with enhanced timeout handling');
  }

  /**
   * Set callback for scan status updates
   */
  setScanStatusCallback(callback: (status: ScanStatus) => void) {
    this.scanStatusCallback = callback;
  }

  private updateScanStatus(updates: Partial<ScanStatus>) {
    this.currentScanStatus = {
      ...this.currentScanStatus,
      ...updates
    };
    if (this.scanStatusCallback) {
      this.scanStatusCallback(this.currentScanStatus);
    }
  }

  /**
   * Initial wallet validation and setup
   * This should be called when wallet is first added
   */
  async validateWallet(walletAddress: string): Promise<boolean> {
    try {
      // Validate wallet address
      if (!isValidSolanaAddress(walletAddress)) {
        throw new Error('Invalid Solana wallet address format');
      }

      // Check if wallet exists on chain
      const response = await this.circuitBreaker.makeRequest(async () => {
        return await axios.post(this.DRPC_API_URL, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [walletAddress]
        }, this.circuitBreaker.getAxiosConfig());
      }, `validateWallet for ${walletAddress.slice(0, 8)}...`);

      const data = response.data as { error?: any; result?: any };
      if (data.error) {
        console.error('DRPC Error:', data.error);
        return false;
      }

      // If we get here, wallet is valid
      return true;
    } catch (error) {
      console.error('Error validating wallet:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Load metadata for a specific set of tokens in batches
   */
  private async loadTokenMetadata(tokenMints: Set<string>): Promise<void> {
    try {
      const BATCH_SIZE = 50; // Process 50 tokens at a time
      const BATCH_DELAY = 1000; // Wait 1 second between batches
      const tokenArray = Array.from(tokenMints);
      const totalBatches = Math.ceil(tokenArray.length / BATCH_SIZE);

      console.log(`🔄 Loading metadata for ${tokenMints.size} tokens in ${totalBatches} batches...`);

      // Process tokens in batches
      for (let i = 0; i < tokenArray.length; i += BATCH_SIZE) {
        const batchTokens = tokenArray.slice(i, i + BATCH_SIZE);
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;

        console.log(`\n📦 Processing batch ${currentBatch}/${totalBatches} (${batchTokens.length} tokens)`);

        try {
          // Check rate limit before making request
          await checkRateLimit();

          const response = await axios.get<JupiterTradableToken[]>(`${this.JUPITER_TOKEN_API_BASE}/mints/tradable`, {
            headers: {
              'Accept': 'application/json'
            },
            timeout: 15000
          });

          if (response.data && Array.isArray(response.data)) {
            // Filter and process only the tokens in current batch
            const matchingTokens = response.data.filter(token => 
              batchTokens.includes(token.address)
            );

            console.log(`   ✅ Found metadata for ${matchingTokens.length}/${batchTokens.length} tokens`);

            matchingTokens.forEach(token => {
              globalTokenList.tokens.set(token.address, {
                name: token.name || 'Unknown Token',
                symbol: token.symbol || 'UNKNOWN',
                logoURI: token.logoURI || null
              });
            });

            // Set defaults for tokens not found in this batch
            batchTokens.forEach(mint => {
              if (!globalTokenList.tokens.has(mint)) {
                globalTokenList.tokens.set(mint, {
                  name: 'Unknown Token',
                  symbol: mint.substring(0, 8) + '...',
                  logoURI: null
                });
              }
            });
          }

          // If this isn't the last batch, wait before processing next batch
          if (currentBatch < totalBatches) {
            console.log(`   ⏳ Waiting ${BATCH_DELAY}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
          }

        } catch (error) {
          console.log(`⚠️ Failed to load metadata for batch ${currentBatch}, using defaults`);
          // Set defaults for all tokens in this failed batch
          batchTokens.forEach(mint => {
            if (!globalTokenList.tokens.has(mint)) {
              globalTokenList.tokens.set(mint, {
                name: 'Unknown Token',
                symbol: mint.substring(0, 8) + '...',
                logoURI: null
              });
            }
          });

          // Still wait before next batch on error
          if (currentBatch < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
          }
        }
      }

    } catch (error) {
      console.log('⚠️ Failed to load token metadata, using defaults for all tokens');
      // Set defaults for all tokens if the entire process fails
      tokenMints.forEach(mint => {
        if (!globalTokenList.tokens.has(mint)) {
          globalTokenList.tokens.set(mint, {
            name: 'Unknown Token',
            symbol: mint.substring(0, 8) + '...',
            logoURI: null
          });
        }
      });
    }
  }

  /**
   * Get token information - uses cached data or defaults
   */
  private getTokenInfo(tokenMint: string): TokenInfo {
    return globalTokenList.tokens.get(tokenMint) || {
      name: 'Unknown Token',
      symbol: tokenMint.substring(0, 8) + '...',
      logoURI: null
    };
  }

  /**
   * Main method to analyze wallet trading history
   * @param walletAddress The wallet address to analyze
   * @param userId Optional user ID for storing trades in Supabase
   */
  async analyzeWalletTrades(walletAddress: string, userId?: string): Promise<AnalysisResult> {
    try {
      this.walletAddress = walletAddress;
      console.log('\n🚀 Starting Historical Pricing Analysis');
      console.log('Wallet:', walletAddress);

      // Reset scan status
      this.currentScanStatus = {
        totalSignatures: 0,
        processedSignatures: 0,
        uniqueTokens: 0,
        tradesFound: 0,
        currentStep: 'Starting scan...',
        isComplete: false
      };

      // Check cache first
      const cached = walletAnalysisCache.get(walletAddress);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('📋 Using cached analysis result');
        this.updateScanStatus({
          isComplete: true,
          currentStep: 'Using cached results'
        });
        return cached.data;
      }

      // Step 1: Deep scan to discover all ATAs
      this.updateScanStatus({ currentStep: 'Discovering token accounts...' });
      const allATAs = await this.deepScanATAs(walletAddress);
      console.log(`\n📂 Total ATAs discovered: ${allATAs.size}`);
      allATAs.forEach(ata => console.log(`   ATA: ${ata}`));

      // Add the main wallet to the list of accounts to check
      allATAs.add(walletAddress);

      // Step 2: Fetch all signatures
      this.updateScanStatus({ currentStep: 'Fetching transaction history...' });
      const allSignatures = new Map<string, { signature: string; blockTime: number }>();
      for (const account of allATAs) {
        console.log(`\n📡 Fetching signatures for account: ${account}`);
        const signatures = await this.getAccountSignatures(account, 0);
        signatures.forEach(sig => {
          allSignatures.set(sig.signature, sig);
        });
        console.log(`   Found ${signatures.length} signatures`);
      }

      // Filter recent transactions
      const cutoffTime = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
      const filteredSignatures = Array.from(allSignatures.values())
        .filter(sig => sig.blockTime >= cutoffTime);

      this.updateScanStatus({
        totalSignatures: filteredSignatures.length,
        currentStep: 'Collecting token information...'
      });

      // Step 3: First pass - collect unique tokens
      console.log('\n🔍 First pass: Collecting unique token mints...');
      const uniqueTokenMints = new Set<string>();

      for (let i = 0; i < filteredSignatures.length; i++) {
        const sigInfo = filteredSignatures[i];
        this.updateScanStatus({
          processedSignatures: i + 1,
          currentStep: `Scanning transaction ${i + 1} of ${filteredSignatures.length}...`
        });

        try {
          const tx = await this.fetchTransaction(sigInfo.signature);
          if (!tx?.meta?.preTokenBalances || !tx?.meta?.postTokenBalances) continue;

          tx.meta.preTokenBalances.forEach((balance: any) => {
            if (balance.mint) uniqueTokenMints.add(balance.mint);
          });
          tx.meta.postTokenBalances.forEach((balance: any) => {
            if (balance.mint) uniqueTokenMints.add(balance.mint);
          });
        } catch (error) {
          console.log(`⚠️ Error in first pass for ${sigInfo.signature}: ${error}`);
          continue;
        }
      }

      // Step 4: Load metadata for all discovered tokens
      this.updateScanStatus({
        uniqueTokens: uniqueTokenMints.size,
        currentStep: 'Loading token metadata...'
      });
      await this.loadTokenMetadata(uniqueTokenMints);

      // Step 5: Process transactions
      this.updateScanStatus({ currentStep: 'Processing trades...' });
      console.log('\n💫 Processing transactions with cached token info...');
      const trades: TradeData[] = [];

      for (let i = 0; i < filteredSignatures.length; i++) {
        const sigInfo = filteredSignatures[i];
        this.updateScanStatus({
          processedSignatures: i + 1,
          currentStep: `Processing trade ${i + 1} of ${filteredSignatures.length}...`
        });

        try {
          const tx = await this.fetchTransaction(sigInfo.signature);
          if (!tx) continue;

          const trade = await this.processTransaction(tx, walletAddress);
          if (trade) {
            trades.push(trade);
            this.updateScanStatus({ tradesFound: trades.length });
            console.log(`✅ Found trade: ${trade.type} ${trade.tokenSymbol}`);
          }
        } catch (error) {
          console.log(`⚠️ Error processing transaction ${sigInfo.signature}: ${error}`);
          continue;
        }
      }

      // Step 6: Compile initial results
      this.updateScanStatus({ currentStep: 'Compiling initial results...' });

      const historicalTrades = new Map<string, TradeData[]>();
      for (const trade of trades) {
        if (!historicalTrades.has(trade.tokenMint)) {
          historicalTrades.set(trade.tokenMint, []);
        }
        historicalTrades.get(trade.tokenMint)!.push(trade);
      }

      // Step 7: Second pass - fetch all historical trades for discovered tokens
      // This excludes trades from the past 24 hours to avoid duplication with the first pass
      console.log('\n🔍 Second pass: Fetching all historical trades for discovered tokens (excluding past 24 hours)...');
      this.updateScanStatus({ 
        currentStep: 'Starting historical trade discovery for detected tokens (excluding past 24 hours)...',
        tradesFound: trades.length
      });

      // Use all detected tokens from the past 24 hours, not just those with trades
      console.log(`Found ${uniqueTokenMints.size} tokens detected in initial scan`);

      // For each token mint, fetch all historical trades
      let totalHistoricalTradesFound = 0;
      for (const tokenMint of uniqueTokenMints) {
        this.updateScanStatus({ 
          currentStep: `Fetching historical trades for token ${tokenMint}...`,
        });

        console.log(`\n🔍 Fetching all historical trades for token: ${tokenMint}`);
        const tokenInfo = this.getTokenInfo(tokenMint);
        console.log(`Token: ${tokenInfo.symbol} (${tokenMint})`);

        const tokenHistoricalTrades = await this.fetchAllHistoricalTrades(walletAddress, tokenMint);
        console.log(`✅ Found ${tokenHistoricalTrades.length} historical trades for token ${tokenMint}`);

        // Add to historical trades map
        historicalTrades.set(tokenMint, tokenHistoricalTrades);
        totalHistoricalTradesFound += tokenHistoricalTrades.length;

        this.updateScanStatus({ 
          tradesFound: trades.length + totalHistoricalTradesFound,
          currentStep: `Found ${tokenHistoricalTrades.length} historical trades for ${tokenInfo.symbol}`
        });
      }

      // Step 8: Compile final results
      this.updateScanStatus({ currentStep: 'Finalizing results...' });

      const result: AnalysisResult = {
        recentTrades: trades,
        historicalTrades,
        totalTrades: trades.length + totalHistoricalTradesFound,
        totalVolume: trades.reduce((sum, trade) => sum + trade.usdValue, 0),
        uniqueTokens: uniqueTokenMints,
        totalValue: trades.reduce((sum, trade) => sum + trade.usdValue, 0),
        profitLoss: 0 // Default to 0, can be calculated if needed
      };

      // Cache the result
      walletAnalysisCache.set(walletAddress, { data: result, timestamp: Date.now() });

      // Update final status
      this.updateScanStatus({
        isComplete: true,
        currentStep: 'Scan complete!'
      });

      // Store all trades in Supabase if userId is provided
      if (userId) {
        // Flatten all historical trades for storage
        const allTradesToStore: TradeData[] = [];

        // Add recent trades
        allTradesToStore.push(...trades);

        // Add historical trades
        for (const [_, tokenTrades] of historicalTrades) {
          allTradesToStore.push(...tokenTrades);
        }

        if (allTradesToStore.length > 0) {
          console.log(`🔄 Storing ${allTradesToStore.length} trades in Supabase for user ${userId}`);
          await this.storeAllTrades(userId, allTradesToStore);
        }
      }

      return result;

    } catch (error) {
      console.error('❌ Analysis failed:', error instanceof Error ? error.message : 'Unknown error');
      this.updateScanStatus({
        isComplete: true,
        currentStep: `Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  /**
   * Deep scan to discover all ATAs recursively
   * @param walletAddress string
   */
  private async deepScanATAs(walletAddress: string): Promise<Set<string>> {
    const discoveredATAs = new Set<string>();
    const accountsToProcess = new Set<string>([walletAddress]);
    const processedAccounts = new Set<string>();

    while (accountsToProcess.size > 0) {
      const account = Array.from(accountsToProcess)[0];
      accountsToProcess.delete(account);
      if (processedAccounts.has(account)) continue;
      processedAccounts.add(account);

      console.log(`\n🔍 Deep scanning account: ${account}`);

      try {
        // Get token accounts for this wallet
        const response = await this.circuitBreaker.makeRequest(async () => {
          return await axios.post(this.DRPC_API_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [
              account,
              { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { encoding: 'jsonParsed' }
            ]
          }, this.circuitBreaker.getAxiosConfig());
        }, `getTokenAccountsByOwner for ${account.slice(0, 8)}...`);

        if ((response.data as any)?.error) {
          console.error('Error fetching token accounts:', (response.data as any).error);
          continue;
        }

        const tokenAccounts = (response.data as any)?.result?.value || [];
        console.log(`   Found ${tokenAccounts.length} token accounts`);

        // Add each token account to discovered ATAs
        for (const tokenAccount of tokenAccounts) {
          const pubkey = tokenAccount.pubkey;
          if (!discoveredATAs.has(pubkey)) {
            discoveredATAs.add(pubkey);
            console.log(`   📝 Found new ATA: ${pubkey}`);
          }
        }
      } catch (error) {
        console.error(`Error scanning account ${account}:`, error);
        // If circuit breaker is open, we should stop trying
        if ((error as Error).message?.includes('Circuit breaker is OPEN')) {
          throw error;
        }
        continue;
      }
    }

    return discoveredATAs;
  }

  /**
   * Get signatures for a specific account with time filter
   */
  private async getAccountSignatures(account: string, cutoffTime: number): Promise<Array<{ signature: string; blockTime: number }>> {
    const allSignatures: Array<{ signature: string; blockTime: number }> = [];
    let beforeSignature: string | null = null;
    let pageCount = 0;
    let keepPaging = true;

    // First, check if this is a token account
    const isTokenAccount = account !== this.walletAddress; // If it's not the main wallet, it's an ATA

    while (keepPaging) {
      pageCount++;
      if (pageCount % 10 === 0) {
        console.log(`📄 Fetched ${pageCount} pages of signatures for account ${account}`);
      }

      const params: any = [
        account,
        {
          limit: 1000,
          commitment: 'confirmed'
        }
      ];

      if (beforeSignature) {
        params[1].before = beforeSignature;
      }

      try {
        const response = await this.circuitBreaker.makeRequest(async () => {
          return await axios.post(this.DRPC_API_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: params
          }, this.circuitBreaker.getAxiosConfig());
        }, `getSignaturesForAddress for ${account.slice(0, 8)}...`);

        const data = response.data as DRPCResponse;

        if (data.error) {
          console.error('DRPC Error:', data.error);
          break;
        }

        const signatures = data.result || [];

        if (signatures.length === 0) {
          break;
        }

        // For token accounts, we can be more selective about which transactions we fetch
        if (isTokenAccount) {
          // Only fetch transactions that are likely to be trades
          for (const sigInfo of signatures) {
            try {
              // Skip if before cutoff time
              if (cutoffTime > 0 && sigInfo.blockTime < cutoffTime) {
                continue;
              }

              const tx = await this.fetchTransaction(sigInfo.signature);
              if (!tx) continue;

              // Quick check for token balance changes
              if (!tx.meta?.preTokenBalances?.length || !tx.meta?.postTokenBalances?.length) {
                continue;
              }

              // Check for significant SOL movement
              const preBalance = tx.meta.preBalances[0] || 0;
              const postBalance = tx.meta.postBalances[0] || 0;
              const fee = tx.meta.fee || 0;
              const solChange = (postBalance - preBalance + fee) / 1e9;

              // Skip if insufficient SOL movement
              if (Math.abs(solChange) < 0.0001) {
                continue;
              }

              // If we get here, this is likely a trade
              allSignatures.push(sigInfo);

            } catch (error) {
              console.error(`Error processing signature ${sigInfo.signature}:`, error);
              continue;
            }
          }
        } else {
          // For main wallet, we need to check all transactions for ATA discovery
          allSignatures.push(...signatures);
        }

        // Check if we should continue
        const oldestBlock = signatures[signatures.length - 1].blockTime;

        if (cutoffTime > 0 && oldestBlock < cutoffTime) {
          keepPaging = false;
        } else if (signatures.length < 1000) {
          keepPaging = false;
        } else {
          beforeSignature = signatures[signatures.length - 1].signature;
          await delay(100); // Small delay between requests
        }

      } catch (error) {
        console.error(`Error fetching signatures for ${account}:`, error);
        // If circuit breaker is open, we should stop trying
        if ((error as Error).message?.includes('Circuit breaker is OPEN')) {
          throw error;
        }
        break;
      }
    }

    return allSignatures;
  }

  private async fetchTransaction(signature: string) {
    try {
      console.log(`Fetching transaction ${signature}`);

      const response = await this.circuitBreaker.makeRequest(async () => {
        return await axios.post(this.DRPC_API_URL, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [
            signature,
            { 
              encoding: 'jsonParsed', 
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            }
          ]
        }, this.circuitBreaker.getAxiosConfig());
      }, `getTransaction for ${signature.slice(0, 8)}...`);

      const data = response.data as { error?: any; result?: any };

      if (data.error) {
        console.error('DRPC Error:', data.error);
        // If we get a 500 error, try again with a different encoding
        if (data.error.code === -32603) {
          console.log('Retrying with base64 encoding...');
          const retryResponse = await this.circuitBreaker.makeRequest(async () => {
            return await axios.post(this.DRPC_API_URL, {
              jsonrpc: '2.0',
              id: 1,
              method: 'getTransaction',
              params: [
                signature,
                { 
                  encoding: 'base64', 
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0
                }
              ]
            }, this.circuitBreaker.getAxiosConfig());
          }, `getTransaction retry for ${signature.slice(0, 8)}...`);

          const retryData = retryResponse.data as { error?: any; result?: any };
          if (retryData.error) {
            throw new Error(`DRPC Error: ${JSON.stringify(retryData.error)}`);
          }
          return retryData.result;
        }
        throw new Error(`DRPC Error: ${JSON.stringify(data.error)}`);
      }

      if (!data.result) {
        console.warn(`No transaction data found for signature ${signature}`);
        return null;
      }

      return data.result;
    } catch (error) {
      console.error(`Error fetching transaction ${signature}:`, error);

      // Handle free tier timeout error gracefully
      if (error instanceof Error && 
          error.message.includes('Request timeout on the free tier') || 
          (error as any)?.response?.data?.error?.code === 30) {
        console.warn(`⚠️ Free tier timeout for transaction ${signature}, skipping`);
        return null;
      }

      // Remove the old retry logic since circuit breaker handles retries
      throw error;
    }
  }

  /**
   * Process a single transaction to extract trade data
   */
  private async processTransaction(tx: any, walletAddress: string): Promise<TradeData | null> {
    try {
      // Debug: Log transaction signature and basic info
      console.log(`\n🔍 Processing transaction: ${tx.signature}`);
      console.log(`📅 Block time: ${new Date(tx.blockTime * 1000).toISOString()}`);

      // Track ALL token accounts we see in this transaction - do this FIRST
      if (tx.meta?.preTokenBalances) {
        tx.meta.preTokenBalances.forEach((balance: any) => {
          if (balance.owner === walletAddress && tx.transaction.message.accountKeys[balance.accountIndex]) {
            const pubkey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey;
            this.tokenAccountTracker.addAccount(balance.mint, pubkey);
            console.log(`   📝 Tracked pre-balance ATA: ${pubkey} for mint ${balance.mint}`);
          }
        });
      }
      if (tx.meta?.postTokenBalances) {
        tx.meta.postTokenBalances.forEach((balance: any) => {
          if (balance.owner === walletAddress && tx.transaction.message.accountKeys[balance.accountIndex]) {
            const pubkey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey;
            this.tokenAccountTracker.addAccount(balance.mint, pubkey);
            console.log(`   📝 Tracked post-balance ATA: ${pubkey} for mint ${balance.mint}`);
          }
        });
      }

      // 1. Must have token-balance changes
      if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
        console.log('❌ No token balance data found');
        console.log(`   preTokenBalances: ${tx.meta?.preTokenBalances ? 'exists' : 'missing'}`);
        console.log(`   postTokenBalances: ${tx.meta?.postTokenBalances ? 'exists' : 'missing'}`);
        return null;
      }

      // Compute token changes by comparing preTokenBalances and postTokenBalances
      const preTokenBalances = tx.meta.preTokenBalances;
      const postTokenBalances = tx.meta.postTokenBalances;
      const tokenChanges = [];
      const dustThreshold = 0.001; // stricter dust threshold

      // Build a map of token balances by account index and mint
      const tokenMap = new Map();

      // Process pre-balances
      preTokenBalances.forEach((balance: any) => {
        const key = `${balance.accountIndex}-${balance.mint}`;
        tokenMap.set(key, { pre: balance, post: null });
      });

      // Process post-balances
      postTokenBalances.forEach((balance: any) => {
        const key = `${balance.accountIndex}-${balance.mint}`;
        if (tokenMap.has(key)) {
          tokenMap.get(key)!.post = balance;
        } else {
          tokenMap.set(key, { pre: null, post: balance });
        }
      });

      console.log(`🔄 Found ${tokenMap.size} token balance entries to analyze`);

      // Calculate changes
      for (const [key, { pre, post }] of tokenMap.entries()) {
        if (!pre && !post) continue;
        const mint = pre?.mint || post?.mint;
        const owner = pre?.owner || post?.owner;
        const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmountString || pre.uiTokenAmount.uiAmount || '0') : 0;
        const postAmount = post ? parseFloat(post.uiTokenAmount.uiAmountString || post.uiTokenAmount.uiAmount || '0') : 0;
        const change = postAmount - preAmount;

        console.log(`  Token ${mint}: ${preAmount} → ${postAmount} (change: ${change})`);

        if (Math.abs(change) < dustThreshold) {
          console.log(`    ⚠️ Below dust threshold (${dustThreshold})`);
          continue;
        }

        // Skip native SOL wrapping/unwrapping
        if (mint === 'So11111111111111111111111111111111111111112') {
          console.log(`    ⚠️ Skipping native SOL token`);
          continue;
        }

        // Skip system program ownership (wrapping)
        if (owner === '11111111111111111111111111111111') {
          console.log(`    ⚠️ Skipping system program ownership (wrapping)`);
          continue;
        }

        tokenChanges.push({
          mint,
          owner,
          change,
          preAmount,
          postAmount
        });
      }

      console.log(`📈 Found ${tokenChanges.length} significant token changes`);

      if (tokenChanges.length === 0) {
        console.log('❌ No significant token changes found');
        console.log('   This transaction will be skipped');
        return null;
      }

      // Find the most significant token change (by absolute value)
      const primaryTokenChange = tokenChanges.reduce((max, current) => 
        Math.abs(current.change) > Math.abs(max.change) ? current : max
      );

      console.log(`🎯 Primary token change: ${primaryTokenChange.mint} (${primaryTokenChange.change})`);

      // Calculate SOL balance change
      const preBalance = tx.meta.preBalances[0] || 0;
      const postBalance = tx.meta.postBalances[0] || 0;
      const fee = tx.meta.fee || 0;
      const solChange = (postBalance - preBalance + fee) / 1e9; // Convert lamports to SOL

      console.log(`💰 SOL change: ${solChange} SOL (fee: ${fee / 1e9} SOL)`);

      // Reduced SOL movement threshold
      if (Math.abs(solChange) < 0.0001) {
        console.log('❌ Insufficient SOL movement for trade');
        console.log(`   SOL change ${Math.abs(solChange)} < threshold 0.0001`);
        return null;
      }

      // Determine trade type
      const type: 'BUY' | 'SELL' = solChange < 0 ? 'BUY' : 'SELL';
      console.log(`📊 Trade type: ${type}`);

      // Get historical SOL price
      const blockTime = new Date(tx.blockTime * 1000);
      const dateKey = blockTime.toISOString().split('T')[0];
      const solPrice = await this.getSOLPrice(dateKey);

      // Calculate USD value based on SOL amount
      const usdValue = Math.abs(solChange) * solPrice;

      // Fetch token info from Jupiter API (only for metadata)
      console.log(`🔍 Fetching token info for ${primaryTokenChange.mint}...`);
      const tokenInfo = this.getTokenInfo(primaryTokenChange.mint);

      const trade: TradeData = {
        signature: tx.signature,
        timestamp: tx.blockTime * 1000,
        type,
        tokenMint: primaryTokenChange.mint,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        tokenLogoURI: tokenInfo.logoURI,
        tokenChange: primaryTokenChange.change,
        solAmount: Math.abs(solChange),
        usdValue,
        fee: fee / 1e9,
        allTokenChanges: tokenChanges.map(tc => ({
          mint: tc.mint,
          change: tc.change
        }))
      };

      console.log('✅ Valid trade found!');
      return trade;

    } catch (error) {
      console.error(`❌ Error processing transaction ${tx.signature}:`, error);
      return null;
    }
  }

  /**
   * Get all historical transactions for a specific token
   * Excludes transactions from the past 24 hours to avoid duplication
   */
  private async fetchAllHistoricalTrades(wallet: string, mint: string): Promise<TradeData[]> {
    try {
      console.log(`\n🔍 Starting complete historical fetch for token: ${mint}`);

      // Calculate cutoff time for 24 hours ago to avoid duplicating recent trades
      const cutoffTime = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
      console.log(`📅 Using cutoff time: ${new Date(cutoffTime * 1000).toISOString()} to avoid duplicating recent trades`);

      // 1. Initialize account queue with currently active ATAs
      const accountQueue = new Set<string>(await this.getTokenAccountsForMint(wallet, mint));
      console.log(`📂 Initial account queue size: ${accountQueue.size}`);

      // 2. Track processed accounts to avoid duplicates
      const processedAccounts = new Set<string>();

      // 3. Track all signatures we find
      const allSignatures = new Set<string>();

      // 4. Process accounts until queue is empty
      while (accountQueue.size > 0) {
        // Get next account to process
        const account = Array.from(accountQueue)[0];
        accountQueue.delete(account);

        if (processedAccounts.has(account)) {
          console.log(`⏭️ Skipping already processed account: ${account}`);
          continue;
        }

        console.log(`\n📑 Processing account: ${account}`);
        console.log(`📊 Remaining accounts in queue: ${accountQueue.size}`);

        let beforeSignature: string | null = null;
        let keepPaging = true;
        let pageCount = 0;

        while (keepPaging) {
          pageCount++;
          console.log(`📄 Page ${pageCount} (before: ${beforeSignature || 'start'})`);

          const params: [string, DRPCParams] = [
            account,
            {
              limit: 500, // Using 500 as a safe page size
              commitment: 'confirmed'
            }
          ];

          if (beforeSignature) {
            params[1].before = beforeSignature;
          }

          try {
            const response = await this.circuitBreaker.makeRequest(async () => {
              return await axios.post(this.DRPC_API_URL, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: params
              }, this.circuitBreaker.getAxiosConfig());
            }, `getSignaturesForAddress historical for ${account.slice(0, 8)}...`);

            const data = response.data as DRPCResponse;

            if (data.error) {
              console.error('DRPC Error:', data.error);
              break;
            }

            const signatures = data.result || [];
            console.log(`📊 Found ${signatures.length} signatures on this page`);

            if (signatures.length === 0) {
              console.log('No more signatures found');
              break;
            }

            // Add new signatures to our Set, filtering out those from the past 24 hours
            signatures.forEach((sig: { signature: string; blockTime: number }) => {
              // Only add signatures for transactions before our cutoff time
              if (sig.blockTime < cutoffTime) {
                allSignatures.add(sig.signature);
              } else {
                console.log(`⏭️ Skipping recent transaction from ${new Date(sig.blockTime * 1000).toISOString()} (after cutoff)`);
              }
            });

            // Process each transaction to discover new ATAs, but skip recent ones
            for (const sigInfo of signatures) {
              // Skip transactions from the past 24 hours
              if (sigInfo.blockTime >= cutoffTime) {
                continue;
              }

              try {
                const tx = await this.fetchTransaction(sigInfo.signature);
                if (!tx) continue;

                // Discover new ATAs from pre/post balances - be more aggressive
                if (tx.meta?.preTokenBalances) {
                  tx.meta.preTokenBalances.forEach((balance: any) => {
                    if (balance.owner === wallet && tx.transaction.message.accountKeys[balance.accountIndex]) {
                      const pubkey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey;
                      if (!processedAccounts.has(pubkey)) {
                        accountQueue.add(pubkey);
                        console.log(`   🔍 Discovered new ATA: ${pubkey} (pre-balance)`);
                      }
                    }
                  });
                }
                if (tx.meta?.postTokenBalances) {
                  tx.meta.postTokenBalances.forEach((balance: any) => {
                    if (balance.owner === wallet && tx.transaction.message.accountKeys[balance.accountIndex]) {
                      const pubkey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey;
                      if (!processedAccounts.has(pubkey)) {
                        accountQueue.add(pubkey);
                        console.log(`   🔍 Discovered new ATA: ${pubkey} (post-balance)`);
                      }
                    }
                  });
                }

                // Also check accountKeys for any potential ATAs
                tx.transaction.message.accountKeys.forEach((key: any) => {
                  if (key.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
                    if (!processedAccounts.has(key.pubkey)) {
                      accountQueue.add(key.pubkey);
                      console.log(`   🔍 Discovered potential ATA from accountKeys: ${key.pubkey}`);
                    }
                  }
                });

              } catch (error) {
                console.log(`⚠️ Error processing transaction ${sigInfo.signature}: ${error}`);
                continue;
              }
            }

            // Check if we need to continue paging
            const oldestBlock = signatures[signatures.length - 1].blockTime;
            console.log(`Oldest block in this page: ${new Date(oldestBlock * 1000).toISOString()}`);

            // We'll keep paging as long as we're finding signatures
            beforeSignature = signatures[signatures.length - 1].signature;
            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (error) {
            console.error(`Error fetching signatures page ${pageCount}:`, error);
            break;
          }
        }

        // Mark this account as processed
        processedAccounts.add(account);
        console.log(`✅ Finished processing account: ${account}`);
      }

      console.log(`\n📈 Total unique historical signatures found: ${allSignatures.size}`);
      console.log(`📈 Total unique ATAs processed: ${processedAccounts.size}`);

      // 5. Process all discovered transactions
      const trades: TradeData[] = [];
      let processedCount = 0;

      for (const signature of allSignatures) {
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`\n[${processedCount}/${allSignatures.size}] Processing historical trades...`);
        }

        try {
          const tx = await this.fetchTransaction(signature);
          if (!tx) continue;

          const trade = await this.processTransaction(tx, wallet);
          if (trade && trade.tokenMint === mint) {
            trades.push(trade);
            console.log(`✅ Found historical trade: ${trade.type} ${trade.tokenSymbol} (${trade.tokenMint})`);
          }
        } catch (error) {
          console.log(`⚠️ Error processing transaction ${signature}: ${error}`);
          continue;
        }
      }

      return trades;
    } catch (error) {
      console.error(`❌ Error fetching historical trades for mint ${mint}:`, error);
      return [];
    }
  }

  /**
   * Get token accounts for a specific mint owned by wallet
   */
  private async getTokenAccountsForMint(walletAddress: string, tokenMint: string): Promise<string[]> {
    try {
      const response = await this.circuitBreaker.makeRequest(async () => {
        return await axios.post(this.DRPC_API_URL, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            walletAddress,
            { mint: tokenMint },
            { encoding: 'jsonParsed' }
          ]
        }, this.circuitBreaker.getAxiosConfig());
      }, `getTokenAccountsByOwner for ${walletAddress.slice(0, 8)}... and ${tokenMint.slice(0, 8)}...`);

      if ((response.data as any)?.error) {
        console.error('Error fetching token accounts:', (response.data as any).error);
        return [];
      }

      const accounts = (response.data as any)?.result?.value || [];
      return accounts.map((account: any) => account.pubkey);
    } catch (error) {
      console.error('Error fetching token accounts:', error);
      return [];
    }
  }

  /**
   * Get historical SOL price from CoinGecko
   */
  private async getSOLPrice(dateKey: string): Promise<number> {
    if (solPriceCache.has(dateKey)) {
      console.log(`📋 Using cached SOL price for ${dateKey}`);
      return solPriceCache.get(dateKey)!;
    }

    try {
      // Calculate days ago for CoinGecko API
      const now = new Date();
      const targetDate = new Date(dateKey);
      const daysAgo = Math.ceil((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`🔍 Fetching historical SOL price for ${dateKey} (${daysAgo} days ago)`);

      const response = await axios.get<CoinGeckoResponse>(
        `${this.COINGECKO_API_URL}/coins/solana/market_chart?vs_currency=usd&days=${daysAgo}`,
        {
          headers: {
            'Accept': 'application/json',
            'x-cg-pro-api-key': process.env.COINGECKO_API_KEY || ''
          }
        }
      );

      if (!response.data?.prices?.length) {
        throw new Error('No price data from CoinGecko');
      }

      // Find closest price to our timestamp
      let closestPrice = response.data.prices[0];
      let minTimeDiff = Math.abs(targetDate.getTime() - closestPrice[0]);

      for (const pricePoint of response.data.prices) {
        const timeDiff = Math.abs(targetDate.getTime() - pricePoint[0]);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestPrice = pricePoint;
        }
      }

      const price = closestPrice[1];
      console.log(`✅ Found SOL price: $${price} at ${new Date(closestPrice[0]).toISOString()}`);

      solPriceCache.set(dateKey, price);
      return price;
    } catch (error) {
      console.error(`Error fetching SOL price for ${dateKey}:`, error);
      // Fallback to a reasonable default
      const fallbackPrice = 150;
      solPriceCache.set(dateKey, fallbackPrice);
      return fallbackPrice;
    }
  }

  /**
   * Get cached analysis result for a wallet
   * @param walletAddress The wallet address
   * @returns The cached analysis result or null if not found
   */
  getCachedAnalysisResult(walletAddress: string): AnalysisResult | null {
    const cached = walletAnalysisCache.get(walletAddress);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  /**
   * Clear cache for a specific wallet
   */
  clearWalletCache(walletAddress: string): void {
    walletAnalysisCache.delete(walletAddress);
    console.log(`🗑️ Cleared cache for wallet: ${walletAddress}`);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    walletAnalysisCache.clear();
    solPriceCache.clear();
    tokenInfoCache.clear();
    console.log('🗑️ Cleared all caches');
  }

  /**
   * @param tradeData The trade data to store
   * @returns Promise resolving to the stored trade data or null if operation failed
   */
  async storeTrade(tradeData: TradeData): Promise<any> {
    try {
      if (!this.walletAddress || this.walletAddress.trim() === '') {
        console.error('❌ Cannot store trade: wallet address is null or empty');
        return null;
      }

      // Validate signature and tokenMint are not null or empty
      if (!tradeData.signature || tradeData.signature.trim() === '') {
        console.error('❌ Cannot store trade: signature is null or empty');
        return null;
      }

      if (!tradeData.tokenMint || tradeData.tokenMint.trim() === '') {
        console.error('❌ Cannot store trade: token mint is null or empty');
        return null;
      }

      console.log(`📝 Checking if trade ${tradeData.signature} already exists`);

      // Enhanced duplicate checking - check by signature across all wallets
      const { data: existingTradeBySignature, error: existingTradeBySignatureError } = await supabase
        .from('trading_history')
        .select('id, wallet_address')
        .eq('signature', tradeData.signature)
        .limit(1);

      // Also check by wallet address and signature for this specific wallet
      const { data: existingTradeByWallet, error: existingTradeByWalletError } = await supabase
        .from('trading_history')
        .select('id')
        .eq('wallet_address', this.walletAddress)
        .eq('signature', tradeData.signature)
        .limit(1);

      // Combine the errors if any
      const existingTradeError = existingTradeBySignatureError || existingTradeByWalletError;

      // Use the wallet-specific result if available, otherwise use the signature-only result
      const existingTradeCheck = existingTradeByWallet && existingTradeByWallet.length > 0 
        ? existingTradeByWallet 
        : existingTradeBySignature;

      if (existingTradeError) {
        console.error('❌ Error checking for existing trade:', existingTradeError);
      } else if (existingTradeCheck && existingTradeCheck.length > 0) {
        // Log more details about the duplicate trade
        const duplicateWalletAddress = existingTradeBySignature && existingTradeBySignature.length > 0 
          ? existingTradeBySignature[0].wallet_address 
          : this.walletAddress;

        console.log(`⚠️ Trade ${tradeData.signature} already exists in the database for wallet ${duplicateWalletAddress}, skipping`);
        console.log(`⚠️ Duplicate trade details: Token=${tradeData.tokenMint}, Type=${tradeData.type}, Amount=${tradeData.tokenChange}`);

        return existingTradeCheck[0];
      }

      console.log(`📝 Storing trade ${tradeData.signature} for token ${tradeData.tokenMint}`);

      // Check if any trades with the same token are already starred
      const { data: starredData, error: starredError } = await supabase
        .from('trading_history')
        .select('starred')
        .eq('wallet_address', this.walletAddress)
        .eq('token_address', tradeData.tokenMint)
        .eq('starred', true)
        .limit(1);

      const isStarred = !starredError && starredData && starredData.length > 0;

      // Get token info from TokenInfoService
      let tokenSymbol = tradeData.tokenSymbol;
      let tokenLogoURI = tradeData.tokenLogoURI;

      try {
        console.log(`🔍 Getting token info for ${tradeData.tokenMint} from TokenInfoService`);
        const tokenInfo = await TokenInfoService.getTokenInfo(tradeData.tokenMint);

        // Use token info from TokenInfoService if available
        if (tokenInfo) {
          tokenSymbol = tokenInfo.symbol || tokenSymbol;
          tokenLogoURI = tokenInfo.logoURI || tokenLogoURI;
          console.log(`✅ Got token info from TokenInfoService: Symbol=${tokenSymbol}, Logo=${tokenLogoURI ? 'Present' : 'Null'}`);
        }
      } catch (error) {
        console.error(`❌ Error getting token info from TokenInfoService: ${error}`);
      }

      // Ensure we have valid values for required fields
      if (!tokenSymbol) {
        tokenSymbol = `Token-${tradeData.tokenMint.slice(0, 4)}...${tradeData.tokenMint.slice(-4)}`;
      }

      // For logo URI, use a generic placeholder if none is available
      if (!tokenLogoURI) {
        tokenLogoURI = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/unknown-token.png';
      }

      console.log(`🏷️ Storing trade with token data: Symbol=${tokenSymbol}, Logo=${tokenLogoURI}`);

      // Format data according to the trading_history table schema
      const tradeRecord = {
        id: uuidv4(),
        wallet_address: this.walletAddress,
        signature: tradeData.signature,
        timestamp: new Date(tradeData.timestamp),
        block_time: Math.floor(tradeData.timestamp / 1000),
        type: tradeData.type,
        token_symbol: tokenSymbol,
        token_address: tradeData.tokenMint,
        token_logo_uri: tokenLogoURI,
        decimals: 9, // Default decimals
        amount: tradeData.tokenChange,
        price_usd: tradeData.usdValue / Math.abs(tradeData.tokenChange),
        price_sol: tradeData.solAmount / Math.abs(tradeData.tokenChange),
        value_usd: tradeData.usdValue,
        value_sol: tradeData.solAmount,
        profit_loss: null, // Set to null as specified
        market_cap: null, // Set to null as specified
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        starred: isStarred, // Set based on existing starred status
        notes: null,
        tags: null,
        total_supply: null // Adding total_supply field with null default value
      };

      // Check if this trade already exists in the database
      const { data: existingTradeRecord, error: checkError } = await supabase
        .from('trading_history')
        .select('id')
        .eq('wallet_address', tradeRecord.wallet_address)
        .eq('signature', tradeRecord.signature)
        .eq('token_address', tradeRecord.token_address)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Error checking existing trade:', checkError);
        return null;
      }

      // Only insert if the trade doesn't already exist
      let data = null;
      let error = null;

      if (!existingTradeRecord) {
        const result = await supabase
          .from('trading_history')
          .insert(tradeRecord);

        data = result.data;
        error = result.error;
      } else {
        console.log('✅ Trade already exists, skipping insert');
      }

      if (error) {
        console.error('❌ Error storing trade:', error);
        return null;
      }

      console.log('✅ Trade stored successfully');
      return data;
    } catch (error) {
      console.error('❌ Error storing trade:', error);
      return null;
    }
  }

  /**
   * Store all trades from a completed scan
   * @param userId The user ID
   * @param trades The trades to store
   * @returns Promise resolving to true if successful, false otherwise
   */
  async storeAllTrades(userId: string, trades: TradeData[]): Promise<boolean> {
    try {
      if (!userId || userId.trim() === '') {
        console.error('❌ Cannot store trades: user ID is null or empty');
        return false;
      }

      if (!this.walletAddress || this.walletAddress.trim() === '') {
        console.error('❌ Cannot store trades: wallet address is null or empty');
        return false;
      }

      if (!trades || trades.length === 0) {
        console.log('ℹ️ No trades to store');
        return true;
      }

      console.log(`📝 Processing ${trades.length} trades for wallet ${this.walletAddress}`);
      console.log(`📝 Will rely on database's unique constraint to handle duplicates`);

      // Extract unique token mints
      const uniqueTokenMints = [...new Set(trades.map(trade => trade.tokenMint))];
      console.log(`🔍 Found ${uniqueTokenMints.length} unique tokens to process`);

      // Pre-fetch token info for all unique tokens
      const tokenInfoMap = new Map();
      for (const tokenMint of uniqueTokenMints) {
        try {
          console.log(`🔍 Getting token info for ${tokenMint} from TokenInfoService`);
          const tokenInfo = await TokenInfoService.getTokenInfo(tokenMint);
          tokenInfoMap.set(tokenMint, {
            symbol: tokenInfo.symbol,
            logoURI: tokenInfo.logoURI
          });
          console.log(`✅ Cached token info for ${tokenMint}: ${tokenInfo.symbol}`);
        } catch (error) {
          console.error(`❌ Error getting token info for ${tokenMint}: ${error}`);
          // Set fallback values
          tokenInfoMap.set(tokenMint, {
            symbol: `Token-${tokenMint.slice(0, 4)}...${tokenMint.slice(-4)}`,
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/unknown-token.png'
          });
        }
      }

      // Process trades using the pre-fetched token info
      const processedTrades = trades.map(trade => {
        // Get token info from our pre-fetched map
        const tokenInfo = tokenInfoMap.get(trade.tokenMint);
        const tokenSymbol = tokenInfo?.symbol || trade.tokenSymbol || `Token-${trade.tokenMint.slice(0, 4)}...${trade.tokenMint.slice(-4)}`;
        const tokenLogoURI = tokenInfo?.logoURI || trade.tokenLogoURI || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/unknown-token.png';

        return {
          signature: trade.signature,
          timestamp: trade.timestamp,
          type: trade.type,
          tokenSymbol: tokenSymbol,
          tokenAddress: trade.tokenMint,
          tokenLogoURI: tokenLogoURI,
          decimals: 9, // Default decimals
          amount: trade.tokenChange,
          priceUSD: trade.usdValue / Math.abs(trade.tokenChange),
          priceSOL: trade.solAmount / Math.abs(trade.tokenChange),
          valueUSD: trade.usdValue,
          valueSOL: trade.solAmount,
          profitLoss: 0, // Set to 0 to match ProcessedTrade type
          blockTime: Math.floor(trade.timestamp / 1000)
        };
      });

      // Use tradingHistoryService to store the trades
      await tradingHistoryService.cacheTrades(userId, this.walletAddress, processedTrades);

      console.log('✅ All trades stored successfully');
      return true;
    } catch (error) {
      console.error('❌ Error storing all trades:', error);
      return false;
    }
  }

  /**
   * Enhanced DRPC request wrapper with automatic backup switching
   */
  private async makeDRPCRequest<T>(requestData: any, context: string): Promise<T> {
    try {
      const response = await this.circuitBreaker.makeRequest(async () => {
        return await axios.post(this.DRPC_API_URL, requestData, this.circuitBreaker.getAxiosConfig());
      }, context);
      return response as T;
    } catch (error: any) {
      // If circuit breaker fails or we get repeated 408s, try switching to backup
      const is408Error = error.response?.status === 408 || error.code === 'ECONNABORTED';
      const isCircuitOpen = error.message?.includes('Circuit breaker is OPEN');

      if (is408Error || isCircuitOpen) {
        console.warn(`🔄 ${isCircuitOpen ? 'Circuit breaker is open' : '408 timeout error'}, attempting backup endpoint for ${context}`);
        this.switchToBackupDRPC();

        // Single retry with new endpoint
        try {
          const backupResponse = await this.circuitBreaker.makeRequest(async () => {
            return await axios.post(this.DRPC_API_URL, requestData, this.circuitBreaker.getAxiosConfig());
          }, context + ' (backup)');
          return backupResponse as T;
        } catch (backupError: any) {
          console.error(`❌ Backup endpoint also failed for ${context}:`, backupError.response?.status || backupError.code || backupError.message);
          throw backupError;
        }
      }
      throw error;
    }
  }

  /**
   * Try the next available DRPC endpoint if the current one is failing
   */
  private switchToBackupDRPC(): void {
    if (this.currentDRPCIndex < this.BACKUP_DRPC_URLS.length) {
      this.DRPC_API_URL = this.BACKUP_DRPC_URLS[this.currentDRPCIndex];
      this.currentDRPCIndex++;
      console.log(`🔄 Switching to backup DRPC endpoint: ${this.DRPC_API_URL}`);
    } else {
      console.warn('⚠️ All DRPC endpoints exhausted, resetting to primary');
      this.currentDRPCIndex = 0;
      this.DRPC_API_URL = process.env.NEXT_PUBLIC_DRPC_API_URL
        || 'https://lb.drpc.org/ogrpc?network=solana&dkey=AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF';
    }
  }
}

// Export an instance of the HistoricalPriceService
export const historicalPriceService = new HistoricalPriceService();
