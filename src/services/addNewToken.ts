import { tradingHistoryService } from './tradingHistoryService';
import { TokenInfoService } from './tokenInfoService';
import { jupiterApiService } from './jupiterApiService';
import { supabase } from '../utils/supabaseClient';
import axios from 'axios';

export interface AddTokenResult {
  success: boolean;
  message: string;
  tradesFound: number;
  tokenSymbol?: string;
  error?: string;
}

// Interface for the untracked_tokens table
interface UntrackedTokenRecord {
  contract_address: string;
  symbol: string;
  wallet_address: string;
  present_trades: boolean;
  current_price?: number;
  total_supply?: number;
  token_uri?: string;
  created_at?: string;
  updated_at?: string;
}

// Add interfaces for trade detection (mirroring historicalPriceService)
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

interface DRPCParams {
  limit: number;
  commitment: string;
  before?: string;
  until?: string;
}

interface DRPCResponse {
  error?: any;
  result?: any;
}

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// DRPC Circuit Breaker and Retry Configuration (from historicalPriceService.ts)
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

    const maxRetries = 4;
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

        if (isRetryableError && attempt < maxRetries) {
          const baseDelay = (is408Error || isNetworkError) ? 3000 : 1000;
          const backoffDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
          const jitter = Math.random() * 1000;
          const waitTime = backoffDelay + jitter;

          console.warn(`⚠️ DRPC Request failed for ${context} (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(waitTime)}ms. Error: ${error.response?.status || error.code || error.message}`);
          await delay(waitTime);
          continue;
        }

        console.error(`❌ DRPC Request failed permanently for ${context} after ${attempt} attempts:`, error.response?.status || error.code || error.message);

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
      validateStatus: (status: number) => {
        return status < 600;
      }
    };
  }
}

export class AddNewTokenService {
  private DRPC_API_URL = process.env.NEXT_PUBLIC_DRPC_API_URL
    || 'https://lb.drpc.org/ogrpc?network=solana&dkey=AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF';
  private BACKUP_DRPC_URLS = [
    'https://solana-mainnet.g.alchemy.com/v2/' + (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'demo'),
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana'
  ];
  private circuitBreaker = DRPCCircuitBreaker.getInstance();
  private walletAddress: string = ''; // Track current wallet like historicalPriceService
  private currentDRPCIndex = 0; // Track which DRPC endpoint we're using

  constructor() {
    if (process.env.NEXT_PUBLIC_DRPC_API_URL) {
      this.DRPC_API_URL = process.env.NEXT_PUBLIC_DRPC_API_URL;
      console.log('🔧 Using custom DRPC API URL:', this.DRPC_API_URL);
    }
    console.log('🚀 AddNewTokenService initialized with enhanced DRPC handling');
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

  /**
   * Enhanced DRPC request wrapper with automatic backup switching (from historicalPriceService)
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
   * Fetch comprehensive token data from Jupiter API
   */
  private async fetchTokenDataFromJupiter(tokenAddress: string): Promise<{
    symbol: string;
    currentPrice: number;
    totalSupply: number;
    logoURI?: string;
    name?: string;
  }> {
    try {
      console.log(`🔍 Fetching comprehensive token data for ${tokenAddress}...`);

      // Get token info (symbol, logoURI)
      const tokenInfo = await TokenInfoService.getTokenInfo(tokenAddress);
      
      // Get current price in USD
      const currentPrice = await jupiterApiService.getTokenPriceInUSD(tokenAddress);
      
      // For now, we'll set totalSupply to 0 since we don't have a reliable way to get it
      // In the future, this could be enhanced with additional APIs or on-chain data fetching
      let totalSupply = 0;
      console.log(`📊 Token supply: ${totalSupply} (not currently available)`);

      const result = {
        symbol: tokenInfo?.symbol || `TOKEN-${tokenAddress.slice(0, 4)}...${tokenAddress.slice(-4)}`,
        currentPrice: currentPrice || 0,
        totalSupply,
        logoURI: tokenInfo?.logoURI || undefined,
        name: tokenInfo?.symbol // Use symbol as name since name is not available in TokenInfo
      };

      console.log(`✅ Jupiter token data:`, {
        symbol: result.symbol,
        currentPrice: result.currentPrice,
        totalSupply: result.totalSupply,
        hasLogo: !!result.logoURI
      });

      return result;
    } catch (error) {
      console.error(`❌ Error fetching token data from Jupiter:`, error);
      
      // Return fallback data
      return {
        symbol: `TOKEN-${tokenAddress.slice(0, 4)}...${tokenAddress.slice(-4)}`,
        currentPrice: 0,
        totalSupply: 0
      };
    }
  }

  /**
   * Check if token already exists in untracked_tokens table for this wallet
   */
  private async checkExistingUntrackedToken(
    walletAddress: string, 
    tokenAddress: string
  ): Promise<UntrackedTokenRecord | null> {
    try {
      const { data, error } = await supabase
        .from('untracked_tokens')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('contract_address', tokenAddress)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - this is expected for new tokens
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error checking existing untracked token:`, error);
      return null;
    }
  }

  /**
   * Insert or update token in untracked_tokens table
   */
  private async upsertUntrackedToken(tokenRecord: UntrackedTokenRecord): Promise<void> {
    try {
      console.log(`💾 Upserting token record:`, {
        contract_address: tokenRecord.contract_address,
        symbol: tokenRecord.symbol,
        wallet_address: tokenRecord.wallet_address,
        present_trades: tokenRecord.present_trades,
        current_price: tokenRecord.current_price
      });

      const { error } = await supabase
        .from('untracked_tokens')
        .upsert(
          {
            ...tokenRecord,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'wallet_address,contract_address',
            ignoreDuplicates: false
          }
        );

      if (error) {
        throw error;
      }

      console.log(`✅ Token record upserted successfully`);
    } catch (error) {
      console.error(`❌ Error upserting untracked token:`, error);
      throw error;
    }
  }

  /**
   * Get token accounts for a specific mint owned by wallet (from historicalPriceService)
   */
  private async getTokenAccountsForMint(walletAddress: string, tokenMint: string): Promise<string[]> {
    try {
      const response = await this.makeDRPCRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: tokenMint },
          { encoding: 'jsonParsed' }
        ]
      }, `getTokenAccountsByOwner for ${walletAddress.slice(0, 8)}... and ${tokenMint.slice(0, 8)}...`);

      const data = response as DRPCResponse;

      if (data.error) {
        console.error('DRPC Error:', data.error);
        return [];
      }

      const accounts = data.result?.value || [];
      return accounts.map((acc: any) => acc.pubkey);
    } catch (error) {
      console.error(`Error getting token accounts for mint ${tokenMint}:`, error);
      return [];
    }
  }

  /**
   * Fetch transaction from DRPC (exact copy from historicalPriceService)
   */
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
   * Process transaction to extract trade data (simplified from historicalPriceService)
   */
  private async processTransaction(tx: any, walletAddress: string, tokenMint: string): Promise<TradeData | null> {
    try {
      if (!tx || !tx.meta || !tx.transaction) return null;

      const signature = tx.transaction.signatures?.[0];
      const blockTime = tx.blockTime;
      const timestamp = blockTime * 1000;

      console.log(`\n🔍 Processing transaction: ${signature}`);
      console.log(`📅 Block time: ${new Date(timestamp).toISOString()}`);

      // 1. Must have token-balance changes
      if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
        console.log('❌ No token balance data found');
        return null;
      }

      // Check for token balance changes specifically for our target token
      const preBalances = tx.meta.preTokenBalances || [];
      const postBalances = tx.meta.postTokenBalances || [];
      
      // Build a map of token balances by account index and mint
      const tokenMap = new Map();

      // Process pre-balances for our target token only
      preBalances.forEach((balance: any) => {
        if (balance.mint === tokenMint && balance.owner === walletAddress) {
          const key = `${balance.accountIndex}-${balance.mint}`;
          tokenMap.set(key, { pre: balance, post: null });
        }
      });

      // Process post-balances for our target token only
      postBalances.forEach((balance: any) => {
        if (balance.mint === tokenMint && balance.owner === walletAddress) {
          const key = `${balance.accountIndex}-${balance.mint}`;
          if (tokenMap.has(key)) {
            tokenMap.get(key)!.post = balance;
          } else {
            tokenMap.set(key, { pre: null, post: balance });
          }
        }
      });

      console.log(`🔄 Found ${tokenMap.size} token balance entries for target token`);

      if (tokenMap.size === 0) {
        console.log('❌ No balance changes found for target token');
        return null;
      }

      // Calculate changes for our target token
      let tokenChange = 0;
      let hasTargetToken = false;
      const dustThreshold = 0.001;

      for (const [key, { pre, post }] of tokenMap.entries()) {
        if (!pre && !post) continue;
        
        const preAmount = pre ? parseFloat(pre.uiTokenAmount?.uiAmountString || pre.uiTokenAmount?.uiAmount || '0') : 0;
        const postAmount = post ? parseFloat(post.uiTokenAmount?.uiAmountString || post.uiTokenAmount?.uiAmount || '0') : 0;
        const change = postAmount - preAmount;

        console.log(`  Token ${tokenMint}: ${preAmount} → ${postAmount} (change: ${change})`);

        if (Math.abs(change) >= dustThreshold) {
          tokenChange += change; // Sum all changes for this token
          hasTargetToken = true;
        } else {
          console.log(`    ⚠️ Below dust threshold (${dustThreshold})`);
        }
      }

      if (!hasTargetToken || Math.abs(tokenChange) < dustThreshold) {
        console.log(`❌ No significant token changes found. Total change: ${tokenChange}`);
        return null;
      }

      console.log(`🎯 Target token change: ${tokenChange}`);

      // Calculate SOL balance change  
      const preBalance = tx.meta.preBalances[0] || 0;
      const postBalance = tx.meta.postBalances[0] || 0;
      const fee = tx.meta.fee || 0;
      const solChange = (postBalance - preBalance + fee) / 1e9; // Convert lamports to SOL

      console.log(`💰 SOL change: ${solChange} SOL (fee: ${fee / 1e9} SOL)`);

      // Determine trade type based on token change direction
      const type: 'BUY' | 'SELL' = tokenChange > 0 ? 'BUY' : 'SELL';
      console.log(`📊 Trade type: ${type} (token change: ${tokenChange})`);

      // Get token info
      const tokenInfo = await TokenInfoService.getTokenInfo(tokenMint);
      const tokenSymbol = tokenInfo?.symbol || `TOKEN-${tokenMint.slice(0, 4)}...${tokenMint.slice(-4)}`;

      // Calculate approximate values
      // For more accurate pricing, you could fetch historical price data here
      const approximateUsdValue = Math.abs(solChange) * 150; // Rough SOL price estimate
      const solAmount = Math.abs(solChange);

      const trade: TradeData = {
        signature,
        timestamp,
        type,
        tokenMint,
        tokenSymbol,
        tokenName: tokenSymbol,
        tokenLogoURI: tokenInfo?.logoURI || null,
        tokenChange: Math.abs(tokenChange),
        solAmount,
        usdValue: approximateUsdValue,
        fee: fee / 1e9
      };

      console.log('✅ Valid trade found!');
      console.log(`   Type: ${trade.type}`);
      console.log(`   Token: ${trade.tokenSymbol} (${trade.tokenMint})`);
      console.log(`   Amount: ${trade.tokenChange}`);
      console.log(`   SOL: ${trade.solAmount}`);
      console.log(`   USD: ${trade.usdValue}`);

      return trade;
    } catch (error) {
      console.error(`❌ Error processing transaction:`, error);
      return null;
    }
  }

  /**
   * Get account signatures with sophisticated logic (exact copy from historicalPriceService)
   */
  private async getAccountSignatures(account: string, cutoffTime: number = 0): Promise<Array<{ signature: string; blockTime: number }>> {
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

  /**
   * Fetch all historical trades for a specific token (exact copy from historicalPriceService)
   */
  private async fetchAllHistoricalTrades(walletAddress: string, tokenMint: string): Promise<TradeData[]> {
    try {
      // Set the wallet address for this instance
      this.walletAddress = walletAddress;
      
      console.log(`\n🔍 Starting complete historical fetch for token: ${tokenMint}`);

      // 1. Initialize account queue with currently active ATAs
      const accountQueue = new Set<string>(await this.getTokenAccountsForMint(walletAddress, tokenMint));
      console.log(`📂 Initial account queue size: ${accountQueue.size}`);

      // Add the main wallet to the queue (this is crucial!)
      accountQueue.add(walletAddress);
      console.log(`📂 Added main wallet to queue. Total queue size: ${accountQueue.size}`);

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

        // Use the sophisticated getAccountSignatures method
        const signatures = await this.getAccountSignatures(account, 0);
        console.log(`   Found ${signatures.length} signatures for account ${account}`);

        // Add all signatures to our set
        signatures.forEach(sig => {
          allSignatures.add(sig.signature);
        });

        // Process each transaction to discover new ATAs
        for (const sigInfo of signatures) {
          try {
            const tx = await this.fetchTransaction(sigInfo.signature);
            if (!tx) continue;

            // Check if this transaction involves our target token
            const preBalances = tx.meta?.preTokenBalances || [];
            const postBalances = tx.meta?.postTokenBalances || [];
            
            let involvesTargetToken = false;
            
            // Check if any balance involves our token mint
            for (const balance of [...preBalances, ...postBalances]) {
              if (balance.mint === tokenMint) {
                involvesTargetToken = true;
                break;
              }
            }

            if (involvesTargetToken) {
              console.log(`   🎯 Found transaction involving target token: ${sigInfo.signature}`);
              
              // Discover new ATAs from pre/post balances
              if (tx.meta?.preTokenBalances) {
                tx.meta.preTokenBalances.forEach((balance: any) => {
                  if (balance.owner === walletAddress && tx.transaction.message.accountKeys[balance.accountIndex]) {
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
                  if (balance.owner === walletAddress && tx.transaction.message.accountKeys[balance.accountIndex]) {
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
            }

          } catch (error) {
            console.log(`⚠️ Error processing transaction ${sigInfo.signature}: ${error}`);
            continue;
          }
        }

        // Mark this account as processed
        processedAccounts.add(account);
        console.log(`✅ Finished processing account: ${account}`);
      }

      console.log(`\n📈 Total unique signatures found: ${allSignatures.size}`);
      console.log(`📈 Total unique ATAs processed: ${processedAccounts.size}`);

      // 5. Process all discovered transactions to find trades
      const trades: TradeData[] = [];
      let processedCount = 0;

      for (const signature of allSignatures) {
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`\n[${processedCount}/${allSignatures.size}] Processing trades...`);
        }

        try {
          const tx = await this.fetchTransaction(signature);
          if (!tx) continue;

          const trade = await this.processTransaction(tx, walletAddress, tokenMint);
          if (trade) {
            trades.push(trade);
            console.log(`✅ Found trade: ${trade.type} ${trade.tokenSymbol} at ${new Date(trade.timestamp).toISOString()}`);
          }
        } catch (error) {
          console.log(`⚠️ Error processing transaction ${signature}: ${error}`);
          continue;
        }

        // Add delay every 10 processed transactions to be gentle on DRPC
        if (processedCount % 10 === 0) {
          await delay(100);
        }
      }

      console.log(`\n🎉 Found ${trades.length} total trades for token ${tokenMint}`);
      return trades;
    } catch (error) {
      console.error(`❌ Error fetching historical trades for mint ${tokenMint}:`, error);
      return [];
    }
  }

  /**
   * Add a new token by scanning for all its trades and starring them
   */
  async addNewToken(
    userId: string,
    walletAddress: string,
    tokenAddress: string
  ): Promise<AddTokenResult> {
    let tokenData: any = null;
    
    try {
      console.log(`🚀 Starting token addition process for ${tokenAddress}`);

      // Step 1: Fetch token data from Jupiter
      console.log(`🔍 Fetching token data from Jupiter...`);
      tokenData = await this.fetchTokenDataFromJupiter(tokenAddress);

      // Step 2: Ensure wallet exists and get wallet info
      const { walletId } = await tradingHistoryService.ensureWalletExists(userId, walletAddress);
      console.log(`✅ Wallet ensured: ${walletId}`);

      // Step 3: Check for existing trades in trading_history to determine scan strategy
      console.log(`🔍 Checking for existing trades in trading_history...`);
      const { data: existingTrades, error: tradesError } = await supabase
        .from('trading_history')
        .select('signature, timestamp')
        .eq('wallet_id', walletId)
        .eq('token_address', tokenAddress)
        .order('timestamp', { ascending: false }); // Get most recent first

      if (tradesError) {
        console.error(`❌ Error checking existing trades:`, tradesError);
        throw new Error(`Failed to check existing trades: ${tradesError.message}`);
      }

      const hasExistingTrades = existingTrades && existingTrades.length > 0;
      let mostRecentTradeTimestamp: Date | null = null;

      if (hasExistingTrades) {
        // Get the most recent trade timestamp to scan from
        mostRecentTradeTimestamp = new Date(existingTrades[0].timestamp);
        console.log(`📊 Found ${existingTrades.length} existing trades. Most recent: ${mostRecentTradeTimestamp.toISOString()}`);
        console.log(`🔄 Will perform incremental scan from ${mostRecentTradeTimestamp.toISOString()}...`);
      } else {
        console.log(`📊 No existing trades found - will perform full historical scan`);
      }

      let newTradesFound = 0;
      let wasRateLimited = false;

      // Step 4: Perform trade discovery (full scan or incremental based on existing trades)
      try {
        let discoveredTrades: TradeData[] = [];

        if (!hasExistingTrades) {
          // No existing trades - perform full historical scan
          console.log(`🔍 Performing comprehensive historical scan for all trades...`);
          discoveredTrades = await this.fetchAllHistoricalTrades(walletAddress, tokenAddress);
        } else {
          // Has existing trades - perform incremental scan from most recent timestamp
          console.log(`🔍 Performing incremental scan from ${mostRecentTradeTimestamp?.toISOString()}...`);
          discoveredTrades = await this.fetchIncrementalTrades(walletAddress, tokenAddress, mostRecentTradeTimestamp!);
        }

        newTradesFound = discoveredTrades.length;
        console.log(`✅ Found ${newTradesFound} ${hasExistingTrades ? 'new' : 'total'} trades for token ${tokenAddress}`);

        // Step 5: If trades found, store them and star them
        if (newTradesFound > 0) {
          console.log(`💾 Storing ${newTradesFound} discovered trades...`);
          
          // Convert TradeData to ProcessedTrade format for tradingHistoryService
          const processedTrades = discoveredTrades.map(trade => ({
            signature: trade.signature,
            timestamp: trade.timestamp,
            type: trade.type as 'BUY' | 'SELL' | 'UNKNOWN',
            tokenAddress: trade.tokenMint,
            tokenSymbol: trade.tokenSymbol,
            tokenLogoURI: trade.tokenLogoURI,
            amount: trade.tokenChange,
            decimals: 9, // Default decimals
            priceUSD: trade.usdValue / Math.abs(trade.tokenChange),
            priceSOL: trade.solAmount / Math.abs(trade.tokenChange),
            valueUSD: trade.usdValue,
            valueSOL: trade.solAmount,
            profitLoss: 0,
            blockTime: Math.floor(trade.timestamp / 1000),
            starred: false,
            notes: '',
            tags: ''
          }));

          // Store trades using tradingHistoryService
          await tradingHistoryService.cacheTrades(userId, walletAddress, processedTrades);

          // Star all trades for this token (both existing and new)
          console.log(`⭐ Starring all trades for token ${tokenAddress}...`);
          try {
            await tradingHistoryService.toggleStarredTrade(walletId, null, true, tokenAddress);
            console.log(`✅ All trades for ${tokenAddress} have been starred and will appear in Trade Log`);
          } catch (error) {
            console.error('❌ Error starring trades:', error);
            // Don't fail the entire operation if starring fails
          }
        }

      } catch (tradeDiscoveryError) {
        console.error(`❌ Error in trade discovery:`, tradeDiscoveryError);
        
        // Check if this is a rate limiting or timeout error
        const errorMessage = tradeDiscoveryError instanceof Error ? tradeDiscoveryError.message : String(tradeDiscoveryError);
        const isRateLimitError = errorMessage.includes('408') || 
                                errorMessage.includes('timeout') || 
                                errorMessage.includes('rate limit') ||
                                errorMessage.includes('free tier') ||
                                errorMessage.includes('Request timeout on the free tier');
        
        if (isRateLimitError) {
          console.log(`⚠️ DRPC rate limiting detected. Token will be added to watchlist, but trade discovery was limited.`);
          console.log(`💡 This is normal on the free tier. Future trades will still be tracked automatically.`);
          wasRateLimited = true;
        } else {
          console.log(`⚠️ Trade discovery failed with non-rate-limit error, but continuing to add token for future monitoring`);
        }
        
        // Don't fail the entire operation - we'll still add the token to untracked_tokens
      }

      // Step 6: Update token record in untracked_tokens table
      console.log(`💾 Updating token record in untracked_tokens...`);
      const totalTradesInDatabase = hasExistingTrades ? existingTrades.length + newTradesFound : newTradesFound;
      
      const tokenRecord: UntrackedTokenRecord = {
        contract_address: tokenAddress,
        symbol: tokenData.symbol,
        wallet_address: walletAddress,
        present_trades: totalTradesInDatabase > 0,
        current_price: tokenData.currentPrice,
        total_supply: tokenData.totalSupply,
        token_uri: tokenData.logoURI
      };

      await this.upsertUntrackedToken(tokenRecord);

      // Step 7: Generate appropriate success message
      let message: string;
      
      if (hasExistingTrades && newTradesFound === 0) {
        message = `Token ${tokenData.symbol} is up to date! Found ${existingTrades.length} existing trades, no new trades since ${mostRecentTradeTimestamp?.toLocaleDateString()}.`;
      } else if (hasExistingTrades && newTradesFound > 0) {
        message = `Token ${tokenData.symbol} updated! Found ${newTradesFound} new trades since ${mostRecentTradeTimestamp?.toLocaleDateString()}. Total trades: ${totalTradesInDatabase}.`;
      } else if (!hasExistingTrades && newTradesFound > 0) {
        message = `Successfully added ${tokenData.symbol}! Found ${newTradesFound} historical trades. All trades have been starred for your Trade Log.`;
      } else {
        // No trades found
        if (wasRateLimited) {
          message = `Token ${tokenData.symbol} added to your watchlist! 🚀\n\nHistorical trade scanning was limited due to DRPC free tier rate limits. Your token is now being tracked and all future trades will be automatically detected.\n\n💡 Tip: Consider upgrading your DRPC plan for faster historical scanning.`;
        } else {
          message = `Token ${tokenData.symbol} added to your watchlist! No historical trades found, but future trades will be automatically tracked.`;
        }
      }

      console.log(`🎉 Token addition completed successfully: ${message}`);

      return {
        success: true,
        message,
        tradesFound: newTradesFound,
        tokenSymbol: tokenData.symbol
      };

    } catch (error) {
      console.error('💥 Error in addNewToken:', error);
      
      // Provide more specific error messaging for DRPC timeouts
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeoutError = errorMessage.includes('408') || 
                            errorMessage.includes('timeout') || 
                            errorMessage.includes('free tier');
      
      if (isTimeoutError) {
        return {
          success: false,
          message: 'DRPC API timeout due to free tier limits. Please try again or consider upgrading your DRPC plan for better performance.',
          tradesFound: 0,
          tokenSymbol: tokenData?.symbol || undefined,
          error: 'DRPC_TIMEOUT'
        };
      }
      
      return {
        success: false,
        message: 'Failed to add token',
        tradesFound: 0,
        tokenSymbol: tokenData?.symbol || undefined,
        error: errorMessage
      };
    }
  }

  /**
   * Fetch incremental trades since a specific timestamp (adapted from historicalPriceService)
   */
  private async fetchIncrementalTrades(walletAddress: string, tokenMint: string, fromTimestamp: Date): Promise<TradeData[]> {
    try {
      // Set the wallet address for this instance
      this.walletAddress = walletAddress;
      
      console.log(`\n🔍 Starting incremental fetch for token: ${tokenMint} from ${fromTimestamp.toISOString()}`);
      
      const cutoffTime = Math.floor(fromTimestamp.getTime() / 1000);
      console.log(`📅 Using cutoff time: ${new Date(cutoffTime * 1000).toISOString()}`);

      // 1. Initialize account queue with currently active ATAs
      const accountQueue = new Set<string>(await this.getTokenAccountsForMint(walletAddress, tokenMint));
      console.log(`📂 Initial account queue size: ${accountQueue.size}`);

      // Add the main wallet to the queue (this is crucial!)
      accountQueue.add(walletAddress);
      console.log(`📂 Added main wallet to queue. Total queue size: ${accountQueue.size}`);

      // 2. Track processed accounts to avoid duplicates
      const processedAccounts = new Set<string>();

      // 3. Track all signatures we find (only after cutoff time)
      const allSignatures = new Set<string>();

      // 4. Process accounts until queue is empty
      while (accountQueue.size > 0) {
        const account = Array.from(accountQueue)[0];
        accountQueue.delete(account);

        if (processedAccounts.has(account)) {
          console.log(`⏭️ Skipping already processed account: ${account}`);
          continue;
        }

        console.log(`\n📑 Processing account: ${account}`);

        // Use the sophisticated getAccountSignatures method with cutoff time
        const signatures = await this.getAccountSignatures(account, cutoffTime);
        console.log(`   Found ${signatures.length} signatures after cutoff for account ${account}`);

        // Add signatures to our set
        signatures.forEach(sig => {
          allSignatures.add(sig.signature);
        });

        // Process each new transaction to discover ATAs
        for (const sigInfo of signatures) {
          if (sigInfo.blockTime <= cutoffTime) continue; // Skip old transactions

          try {
            const tx = await this.fetchTransaction(sigInfo.signature);
            if (!tx) continue;

            // Check if this transaction involves our target token and discover ATAs
            const preBalances = tx.meta?.preTokenBalances || [];
            const postBalances = tx.meta?.postTokenBalances || [];
            
            let involvesTargetToken = false;
            
            for (const balance of [...preBalances, ...postBalances]) {
              if (balance.mint === tokenMint) {
                involvesTargetToken = true;
                break;
              }
            }

            if (involvesTargetToken) {
              console.log(`   🎯 Found incremental transaction involving target token: ${sigInfo.signature}`);
              
              // Discover new ATAs from this transaction
              if (tx.meta?.preTokenBalances) {
                tx.meta.preTokenBalances.forEach((balance: any) => {
                  if (balance.owner === walletAddress && tx.transaction.message.accountKeys[balance.accountIndex]) {
                    const pubkey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey;
                    if (!processedAccounts.has(pubkey)) {
                      accountQueue.add(pubkey);
                      console.log(`   🔍 Discovered new ATA: ${pubkey} (incremental)`);
                    }
                  }
                });
              }
              if (tx.meta?.postTokenBalances) {
                tx.meta.postTokenBalances.forEach((balance: any) => {
                  if (balance.owner === walletAddress && tx.transaction.message.accountKeys[balance.accountIndex]) {
                    const pubkey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey;
                    if (!processedAccounts.has(pubkey)) {
                      accountQueue.add(pubkey);
                      console.log(`   🔍 Discovered new ATA: ${pubkey} (incremental)`);
                    }
                  }
                });
              }
            }

          } catch (error) {
            console.log(`⚠️ Error processing transaction ${sigInfo.signature}: ${error}`);
            continue;
          }
        }

        processedAccounts.add(account);
        console.log(`✅ Finished processing account: ${account}`);
      }

      console.log(`\n📈 Total new signatures found: ${allSignatures.size}`);

      // 5. Process all discovered transactions to find new trades
      const trades: TradeData[] = [];
      let processedCount = 0;

      for (const signature of allSignatures) {
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`\n[${processedCount}/${allSignatures.size}] Processing new trades...`);
        }

        try {
          const tx = await this.fetchTransaction(signature);
          if (!tx) continue;

          const trade = await this.processTransaction(tx, walletAddress, tokenMint);
          if (trade) {
            trades.push(trade);
            console.log(`✅ Found new trade: ${trade.type} ${trade.tokenSymbol} at ${new Date(trade.timestamp).toISOString()}`);
          }
        } catch (error) {
          console.log(`⚠️ Error processing transaction ${signature}: ${error}`);
          continue;
        }
      }

      console.log(`\n🎉 Found ${trades.length} new trades for token ${tokenMint} since ${fromTimestamp.toISOString()}`);
      return trades;
    } catch (error) {
      console.error(`❌ Error fetching incremental trades for mint ${tokenMint}:`, error);
      return [];
    }
  }
}

// Export a singleton instance
export const addNewTokenService = new AddNewTokenService(); 
