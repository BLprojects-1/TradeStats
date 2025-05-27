//this script now finds the prices and all needed data. 
//next i need to implement supabase agin
// ready for sb implementation

/**
 * Historical Price Service
 * Production service based on test-historical-pricing.js
 * Handles comprehensive trading data analysis with caching
 */

import axios from 'axios';
import { isValidSolanaAddress } from '../utils/userProfile';

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

export class HistoricalPriceService {
  private DRPC_API_URL = process.env.NEXT_PUBLIC_DRPC_API_URL
    || 'https://lb.drpc.org/ogrpc?network=solana&dkey=AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF';
  private COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
  private JUPITER_TOKEN_API_BASE = 'https://lite-api.jup.ag/tokens/v1';
  private tokenAccountTracker = new TokenAccountTracker();
  private walletAddress: string = '';

  constructor() {
    // Initialize with environment variables if available
    if (process.env.NEXT_PUBLIC_DRPC_API_URL) {
      this.DRPC_API_URL = process.env.NEXT_PUBLIC_DRPC_API_URL;
    }
  }

  /**
   * Main method to analyze wallet trading history
   */
  async analyzeWalletTrades(walletAddress: string): Promise<AnalysisResult> {
    try {
      this.walletAddress = walletAddress; // Set the wallet address
      console.log('\n🚀 Starting Historical Pricing Analysis');
      console.log('Wallet:', walletAddress);

      // Validate wallet address
      if (!isValidSolanaAddress(walletAddress)) {
        throw new Error('Invalid Solana wallet address format');
      }

      // Check cache first
      const cached = walletAnalysisCache.get(walletAddress);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('📋 Using cached analysis result');
        return cached.data;
      }

      // Step 1: Deep scan to discover all ATAs and fetch all trades
      const cutoffTime = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
      console.log(`\n⏰ Cutoff time (24h ago): ${new Date(cutoffTime * 1000).toISOString()}`);

      // Deep scan to discover all ATAs recursively
      const allATAs = await this.deepScanATAs(walletAddress);
      console.log(`\n📂 Total ATAs discovered: ${allATAs.size}`);
      allATAs.forEach(ata => console.log(`   ATA: ${ata}`));

      // Add the main wallet to the list of accounts to check
      allATAs.add(walletAddress);

      // Fetch all signatures from all accounts (no cutoff in paging)
      const allSignatures = new Map<string, { signature: string; blockTime: number }>();
      for (const account of allATAs) {
        console.log(`\n📡 Fetching signatures for account: ${account}`);
        const signatures = await this.getAccountSignatures(account, 0); // get all
        signatures.forEach(sig => {
          allSignatures.set(sig.signature, sig);
        });
        console.log(`   Found ${signatures.length} signatures`);
      }

      console.log(`\n📈 Total unique signatures found (all time): ${allSignatures.size}`);

      // Filter by cutoffTime
      const filteredSignatures = Array.from(allSignatures.values()).filter(sig => sig.blockTime >= cutoffTime);
      console.log(`⏰ Found ${filteredSignatures.length} signatures in last 24 hours`);

      // Step 2: Process each transaction to extract trade data
      const trades: TradeData[] = [];
      const uniqueTokens = new Set<string>();

      for (let i = 0; i < filteredSignatures.length; i++) {
        const sigInfo = filteredSignatures[i];
        if (i % 10 === 0) {
          console.log(`\n[${i + 1}/${filteredSignatures.length}] Processing transactions...`);
        }
        try {
          const tx = await this.fetchTransaction(sigInfo.signature);
          if (!tx) {
            console.log(`⚠️ Skipped transaction (no tx data): ${sigInfo.signature}`);
            continue;
          }
          const trade = await this.processTransaction(tx, walletAddress);
          if (trade) {
            trades.push(trade);
            uniqueTokens.add(trade.tokenMint);
            if (trade.allTokenChanges) {
              trade.allTokenChanges.forEach(tc => uniqueTokens.add(tc.mint));
            }
            console.log(`✅ Found trade: ${trade.type} ${trade.tokenSymbol}`);
          } else {
            console.log(`⚠️ Skipped transaction (not a trade): ${sigInfo.signature}`);
          }
        } catch (error) {
          console.log(`⚠️ Error processing transaction ${sigInfo.signature}: ${error}`);
          continue;
        }
      }

      console.log(`\n📊 Found ${trades.length} valid trades`);
      console.log(`🎯 Found ${uniqueTokens.size} unique tokens`);

      // Step 3: For historical analysis, group trades by token
      const historicalTrades = new Map<string, TradeData[]>();
      for (const tokenMint of uniqueTokens) {
        historicalTrades.set(tokenMint, trades.filter(t => t.tokenMint === tokenMint));
      }

      // Step 4: Compile results
      const result: AnalysisResult = {
        recentTrades: trades,
        historicalTrades,
        totalTrades: trades.length,
        totalVolume: trades.reduce((sum, trade) => sum + trade.usdValue, 0),
        uniqueTokens
      };

      // Cache the result
      walletAnalysisCache.set(walletAddress, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error('❌ Analysis failed:', error);
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
      
      // Get token accounts for this wallet
      const response = await axios.post(this.DRPC_API_URL, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          account,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { encoding: 'jsonParsed' }
        ]
      });

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
        const response = await axios.post(this.DRPC_API_URL, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: params
        });

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
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`Error fetching signatures:`, error);
        break;
      }
    }

    return allSignatures;
  }

  private async fetchTransaction(signature: string) {
    try {
      console.log(`Fetching transaction ${signature}`);
      
      const resp = await axios.post(this.DRPC_API_URL, {
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
      });

      const data = resp.data as { error?: any; result?: any };
      
      if (data.error) {
        console.error('DRPC Error:', data.error);
        // If we get a 500 error, try again with a different encoding
        if (data.error.code === -32603) {
          console.log('Retrying with base64 encoding...');
          const retryResp = await axios.post(this.DRPC_API_URL, {
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
          });
          
          const retryData = retryResp.data as { error?: any; result?: any };
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
      // If we get a 500 error, wait a bit and try one more time
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 500) {
        console.log('Got 500 error, waiting 1 second before retry...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const retryResp = await axios.post(this.DRPC_API_URL, {
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
          });
          
          const retryData = retryResp.data as { error?: any; result?: any };
          if (retryData.error) {
            throw new Error(`DRPC Error: ${JSON.stringify(retryData.error)}`);
          }
          return retryData.result;
        } catch (retryError) {
          console.error(`Retry failed for transaction ${signature}:`, retryError);
          throw retryError;
        }
      }
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
      const preBalance = tx.meta.preBalances[0] || 0; // First account is usually the wallet
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
      const usdValue = Math.abs(solChange) * solPrice;

      console.log(`💵 Historical SOL price: $${solPrice}`);
      console.log(`💵 USD value: $${usdValue.toFixed(2)}`);

      // Fetch token info from Jupiter API (cached to avoid rate limiting)
      console.log(`🔍 Fetching token info for ${primaryTokenChange.mint}...`);
      const tokenInfo = await this.getTokenInfo(primaryTokenChange.mint);

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
   */
  private async fetchAllHistoricalTrades(wallet: string, mint: string): Promise<TradeData[]> {
    try {
      console.log(`\n🔍 Starting complete historical fetch for token: ${mint}`);
      
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
            const response = await axios.post(this.DRPC_API_URL, {
              jsonrpc: '2.0',
              id: 1,
              method: 'getSignaturesForAddress',
              params: params
            });

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

            // Add new signatures to our Set
            signatures.forEach((sig: { signature: string; blockTime: number }) => {
              allSignatures.add(sig.signature);
            });

            // Process each transaction to discover new ATAs
            for (const sigInfo of signatures) {
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
      const response = await axios.post(this.DRPC_API_URL, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: tokenMint },
          { encoding: 'jsonParsed' }
        ]
      });

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
   * Get token information from Jupiter API
   */
  private async getTokenInfo(tokenMint: string): Promise<TokenInfo> {
    if (tokenInfoCache.has(tokenMint)) {
      console.log(`📋 Using cached token info for ${tokenMint}`);
      return tokenInfoCache.get(tokenMint)!;
    }

    try {
      // Try direct token lookup first
      try {
        const response = await axios.get<JupiterTokenResponse>(`${this.JUPITER_TOKEN_API_BASE}/token/${tokenMint}`, {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 10000
        });

        if (response.data) {
          const tokenInfo: TokenInfo = {
            name: response.data.name || 'Unknown Token',
            symbol: response.data.symbol || 'UNKNOWN',
            logoURI: response.data.logoURI || null
          };
          console.log(`✅ Found token info: ${tokenInfo.symbol} (${tokenInfo.name})`);
          tokenInfoCache.set(tokenMint, tokenInfo);
          return tokenInfo;
        }
      } catch (directError) {
        console.log(`⚠️ Direct lookup failed for ${tokenMint}, trying tradable tokens list...`);
        
        // Fallback to tradable tokens list
        try {
          const response = await axios.get<JupiterTradableToken[]>(`${this.JUPITER_TOKEN_API_BASE}/mints/tradable`, {
            headers: {
              'Accept': 'application/json'
            },
            timeout: 15000
          });

          if (response.data && Array.isArray(response.data)) {
            const tokenInfo = response.data.find(token => token.address === tokenMint);
            
            if (tokenInfo) {
              const result: TokenInfo = {
                name: tokenInfo.name || 'Unknown Token',
                symbol: tokenInfo.symbol || 'UNKNOWN',
                logoURI: tokenInfo.logoURI || null
              };
              console.log(`✅ Found token in tradable list: ${result.symbol} (${result.name})`);
              tokenInfoCache.set(tokenMint, result);
              return result;
            }
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback lookup also failed for ${tokenMint}:`, fallbackError);
        }
      }

      // If all lookups fail, return default info
      console.log(`⚠️ Could not find token info for ${tokenMint}, using defaults`);
      const fallbackInfo: TokenInfo = {
        name: 'Unknown Token',
        symbol: tokenMint.substring(0, 8) + '...',
        logoURI: null
      };
      
      tokenInfoCache.set(tokenMint, fallbackInfo);
      return fallbackInfo;

    } catch (error) {
      console.error(`Error fetching token info for ${tokenMint}:`, error);
      
      const fallbackInfo: TokenInfo = {
        symbol: `${tokenMint.substring(0, 8)}...`,
        name: 'Unknown Token',
        logoURI: null
      };
      
      tokenInfoCache.set(tokenMint, fallbackInfo);
      return fallbackInfo;
    }
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
}

// Export singleton instance
export const historicalPriceService = new HistoricalPriceService(); 