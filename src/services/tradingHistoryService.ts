/**
 * CRITICAL DATA FLOW - DO NOT MODIFY WITHOUT TEAM REVIEW
 * ====================================================
 * This service handles the caching of trading history in Supabase.
 * The flow is:
 * 1. Check if wallet exists in tracked_wallets, create if not
 * 2. Check Supabase for cached trades
 * 3. Only fetch new trades from Helius/Jupiter if needed
 * 4. Cache new trades in Supabase
 * 
 * This process MUST be maintained to:
 * - Minimize API calls to Helius/Jupiter
 * - Ensure data consistency
 * - Maintain proper wallet tracking
 * - Preserve trading history
 * 
 * Any changes to this flow require thorough review and testing.
 */

import { supabase } from '../utils/supabaseClient';
import { ProcessedTrade } from './tradeProcessor';
import { drpcClient, Transaction, TokenBalance } from './drpcClient';
import { v4 as uuidv4 } from 'uuid';
import { jupiterApiService } from './jupiterApiService';
import { TokenInfoService } from './tokenInfoService';

export interface CachedTrade extends ProcessedTrade {
  wallet_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Helper function to mark a wallet as scanned in tracked_wallets
 * This is a critical operation that must succeed for proper wallet tracking
 */
async function markTrackedWalletScanned(userId: string, walletAddress: string) {
  console.log('🔍 STEP 1: Starting update for wallet:', { userId, walletAddress });

  try {
    const response = await fetch('/api/wallets/mark-scanned', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, walletAddress })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ API call failed:', result.error);
      throw new Error(result.error || 'Failed to mark wallet as scanned');
    }

    console.log('✅ API call succeeded:', result);
    return result.data;

  } catch (error) {
    console.error('💥 CRITICAL ERROR:', error);
    throw error;
  }
}

export class TradingHistoryService {
  /**
   * Ensure wallet exists in the tracked_wallets table and check initial scan status
   */
  async ensureWalletExists(userId: string, walletAddress: string): Promise<{
    walletId: string;
    initialScanComplete: boolean;
    lastUpdated: Date | null;
  }> {
    try {
      console.log('🔍 Checking wallet existence:', { userId, walletAddress });

      // First try to find existing wallet in tracked_wallets
      const { data: existingWallet, error: findError } = await supabase
        .from('tracked_wallets')
        .select('id, initial_scan_complete, updated_at')
        .eq('user_id', userId)
        .eq('wallet_address', walletAddress)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 error

      if (findError) {
        console.error('Error finding wallet:', findError);
        throw findError;
      }

      if (existingWallet) {
        console.log('📋 Found existing wallet:', existingWallet);
        return {
          walletId: existingWallet.id,
          initialScanComplete: existingWallet.initial_scan_complete,
          lastUpdated: existingWallet.updated_at ? new Date(existingWallet.updated_at) : null
        };
      }

      // If not found, create new tracked_wallet
      const walletId = uuidv4();
      console.log('📝 Creating new wallet with ID:', walletId);

      const { data: created, error: createError } = await supabase
        .from('tracked_wallets')
        .insert({
          id: walletId,
          user_id: userId,
          wallet_address: walletAddress,
          initial_scan_complete: false, // Set to false initially
          updated_at: new Date().toISOString()
        })
        .select('id, initial_scan_complete, updated_at')
        .maybeSingle(); // Use maybeSingle() instead of single()

      if (createError) {
        // If creation failed due to conflict, try to get the existing wallet
        if (createError.code === '23505') { // Unique violation
          console.log('⚠️ Wallet already exists, fetching existing record');
          const { data: conflictWallet, error: conflictError } = await supabase
            .from('tracked_wallets')
            .select('id, initial_scan_complete, updated_at')
            .eq('user_id', userId)
            .eq('wallet_address', walletAddress)
            .maybeSingle(); // Use maybeSingle() instead of single()

          if (conflictError) throw conflictError;
          if (!conflictWallet) throw new Error('Wallet not found after conflict');

          return {
            walletId: conflictWallet.id,
            initialScanComplete: conflictWallet.initial_scan_complete,
            lastUpdated: conflictWallet.updated_at ? new Date(conflictWallet.updated_at) : null
          };
        }
        throw createError;
      }

      if (!created) {
        throw new Error('No wallet created and no error returned');
      }

      console.log('✅ New wallet created:', created);
      return {
        walletId: created.id,
        initialScanComplete: created.initial_scan_complete,
        lastUpdated: created.updated_at ? new Date(created.updated_at) : null
      };

    } catch (error) {
      console.error('💥 Error in ensureWalletExists:', error);
      throw error;
    }
  }

  /**
   * Get cached trading history for a wallet from Supabase
   * This is the primary source of truth for trading data
   */
  async getCachedTradingHistory(
    walletId: string, 
    fromTimestamp?: Date,
    limit?: number,
    offset?: number
  ): Promise<CachedTrade[]> {
    try {
      console.log('Getting cached trading history for wallet:', walletId, {
        fromTimestamp,
        limit,
        offset
      });

      let query = supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId)
        .order('timestamp', { ascending: false });

      // Apply timestamp filter if provided
      if (fromTimestamp) {
        query = query.gt('timestamp', fromTimestamp.toISOString());
      }

      // Apply pagination if provided
      if (limit !== undefined) {
        query = query.limit(limit);
      }
      if (offset !== undefined) {
        query = query.range(offset, offset + (limit || 20) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching cached trading history:', error);
        throw error;
      }

      console.log('Retrieved cached trades:', data?.length || 0, 'trades');
      if (data?.length) {
        console.log('Sample trade:', data[0]);
      }

      // Map database columns to ProcessedTrade interface
      const trades = (data || []).map(trade => ({
        signature: trade.signature,
        timestamp: new Date(trade.timestamp).getTime(),
        type: trade.type as 'BUY' | 'SELL' | 'UNKNOWN',
        tokenAddress: trade.token_address,
        tokenSymbol: trade.token_symbol || 'Unknown',
        tokenLogoURI: trade.token_logo_uri || null,
        amount: trade.amount,
        decimals: trade.decimals || 9,
        priceUSD: trade.price_usd || 0,
        priceSOL: trade.price_sol || 0,
        valueUSD: trade.value_usd || 0,
        valueSOL: trade.value_sol || 0,
        profitLoss: 0, // Set to 0 to match ProcessedTrade type
        blockTime: trade.block_time,
        starred: trade.starred || false,
        notes: trade.notes || '',
        tags: trade.tags || '',
        wallet_id: trade.wallet_id,
        created_at: trade.created_at,
        updated_at: trade.updated_at
      }));

      // ✅ REFRESH HISTORICAL PRICES FOR CACHED TRADES!
      if (data && data.length > 0) {
        console.log('🔄 getCachedTradingHistory: Refreshing historical prices for cached trades...');
        const tradesWithFreshPrices = await this.refreshHistoricalPrices(data);

        // Convert to CachedTrade format (add metadata)
        const cachedTrades: CachedTrade[] = tradesWithFreshPrices.map(trade => {
          const originalTrade = data.find(d => d.signature === trade.signature);
          return {
            ...trade,
            wallet_id: originalTrade?.wallet_id || '',
            created_at: originalTrade?.created_at || '',
            updated_at: originalTrade?.updated_at || ''
          };
        });

        console.log(`✅ getCachedTradingHistory: Historical price refresh complete for ${cachedTrades.length} trades.`);
        return cachedTrades;
      }

      return [];
    } catch (error) {
      console.error('Error in getCachedTradingHistory:', error);
      throw error;
    }
  }

  /**
   * Get the latest trade timestamp for a wallet
   */
  async getLatestTradeTimestamp(walletId: string): Promise<Date | null> {
    try {
      const { data, error } = await supabase
        .from('trading_history')
        .select('timestamp')
        .eq('wallet_id', walletId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      return new Date(data[0].timestamp);
    } catch (error) {
      console.error('Error in getLatestTradeTimestamp:', error);
      return null;
    }
  }

  /**
   * Save processed trades to Supabase
   */
  async cacheTrades(userId: string, walletAddress: string, trades: ProcessedTrade[]): Promise<void> {
    try {
      if (!userId || userId.trim() === '') {
        console.error('Error: user ID is null or empty');
        throw new Error('User ID is required');
      }

      if (!walletAddress || walletAddress.trim() === '') {
        console.error('Error: wallet address is null or empty');
        throw new Error('Wallet address is required');
      }

      if (!trades || trades.length === 0) {
        console.log('No trades to cache');
        return;
      }

      console.log(`Processing ${trades.length} trades for wallet ${walletAddress}`);
      console.log(`Will rely on database's unique constraint to handle duplicates`);

      // 1. Get wallet ID
      const { walletId, initialScanComplete } = await this.ensureWalletExists(userId, walletAddress);

      // Validate wallet ID is not null or empty
      if (!walletId || walletId.trim() === '') {
        console.error('Error: wallet ID is null or empty');
        throw new Error('Wallet ID is required');
      }

      // Check if any trades with the same tokens are already starred
      const tokenAddresses = [...new Set(trades.map(trade => trade.tokenAddress))];
      const starredTokensQuery = await supabase
        .from('trading_history')
        .select('token_address, starred')
        .eq('wallet_id', walletId)
        .in('token_address', tokenAddresses)
        .eq('starred', true);

      const starredTokens = new Set<string>();
      if (!starredTokensQuery.error && starredTokensQuery.data) {
        starredTokensQuery.data.forEach(item => {
          if (item.starred && item.token_address) {
            starredTokens.add(item.token_address);
          }
        });
      }

      // 2. Convert to database records
      const tradeRecords = trades.map(trade => ({
        id: uuidv4(),
        wallet_id: walletId,
        wallet_address: walletAddress, // Add wallet_address field
        signature: trade.signature,
        timestamp: new Date(trade.timestamp).toISOString(),
        block_time: trade.blockTime || 0,
        type: trade.type,
        token_symbol: trade.tokenSymbol,
        token_address: trade.tokenAddress,
        token_logo_uri: trade.tokenLogoURI || null,
        decimals: trade.decimals || 9,
        amount: Math.abs(trade.amount),
        price_sol: trade.priceSOL || 0,
        price_usd: trade.priceUSD || 0,
        value_sol: trade.valueSOL || 0,
        value_usd: trade.valueUSD || 0,
        profit_loss: 0, // Set to 0 to match ProcessedTrade type
        market_cap: null, // Set to null as specified
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        starred: starredTokens.has(trade.tokenAddress), // Check if this token is already starred
        notes: null,
        tags: null,
        total_supply: null // Adding total_supply field with null default value
      }));

      // 3. Insert trades to database - use a different approach to handle duplicates
      // First, check which trades already exist in the database
      const signatures = tradeRecords.map(record => record.signature);
      const tokenAddressesForCheck = tradeRecords.map(record => record.token_address);

      const { data: existingTrades, error: checkError } = await supabase
        .from('trading_history')
        .select('signature, token_address')
        .eq('wallet_address', walletAddress)
        .in('signature', signatures)
        .in('token_address', tokenAddressesForCheck);

      if (checkError) {
        console.error('Error checking existing trades:', checkError);
        throw checkError;
      }

      // Create a set of existing signature+token_address combinations
      const existingTradeKeys = new Set();
      if (existingTrades) {
        existingTrades.forEach(trade => {
          existingTradeKeys.add(`${trade.signature}:${trade.token_address}`);
        });
      }

      // Filter out trades that already exist
      const newTradeRecords = tradeRecords.filter(record => 
        !existingTradeKeys.has(`${record.signature}:${record.token_address}`)
      );

      console.log(`Filtered out ${tradeRecords.length - newTradeRecords.length} existing trades, inserting ${newTradeRecords.length} new trades`);

      // Only insert new trades
      const { error } = newTradeRecords.length > 0 
        ? await supabase.from('trading_history').insert(newTradeRecords)
        : { error: null };

      if (error) {
        console.error('Error caching trades:', error);
        throw error;
      }

      // 4. Update the tracked_wallet's status if this was the initial scan
      if (!initialScanComplete) {
        console.log('🚨 CALL SITE 1: Attempting to mark wallet as scanned');
        await markTrackedWalletScanned(userId, walletAddress);
        console.log('✅ CALL SITE 1: Completed');
        console.log(`Updated tracked_wallet ${walletAddress} to mark initial scan as complete`);
      } else {
        // 5. Update the tracked_wallet's recent_trade column with the most recent transaction timestamp
        // Find the most recent transaction timestamp from the trades array
        let mostRecentTimestamp = new Date().toISOString();
        if (trades.length > 0) {
          // Sort trades by timestamp (descending) and get the most recent one
          const sortedTrades = [...trades].sort((a, b) => b.timestamp - a.timestamp);
          mostRecentTimestamp = new Date(sortedTrades[0].timestamp).toISOString();
          console.log(`Most recent transaction timestamp: ${mostRecentTimestamp}`);
        }

        const { error: timestampUpdateError } = await supabase
          .from('tracked_wallets')
          .update({ 
            recent_trade: mostRecentTimestamp
            // Don't update updated_at here, let the database handle it with its default value
          })
          .eq('wallet_address', walletAddress)
          .eq('user_id', userId);

        if (timestampUpdateError) {
          console.error('Error updating tracked_wallet recent_trade timestamp:', timestampUpdateError);
          throw timestampUpdateError;
        }

        console.log(`Updated tracked_wallet ${walletAddress} recent_trade timestamp to most recent transaction: ${mostRecentTimestamp}`);
      }

      console.log(`Successfully cached ${trades.length} trades for wallet ${walletAddress}`);
    } catch (error) {
      console.error('Error in cacheTrades:', error);
      throw error;
    }
  }

  /**
   * Process a single transaction into a trade
   */
  private async processTransaction(tx: Transaction, walletAddress: string): Promise<ProcessedTrade | null> {
    try {
      // Skip failed transactions
      if (tx.status === 'failed') {
        return null;
      }

      // Get token balances that changed
      const tokenChanges = tx.tokenBalanceChanges || [];

      // If no token changes, check if it's a SOL transfer
      if (tokenChanges.length === 0) {
        const preBalance = tx.preBalances[0] || 0;
        const postBalance = tx.postBalances[0] || 0;
        const balanceChange = postBalance - preBalance;

        // Only process if there's a significant SOL change
        if (Math.abs(balanceChange) > 0.000001) {
          const type = balanceChange < 0 ? 'SELL' : 'BUY';
          const amount = Math.abs(balanceChange) / 1e9; // Convert lamports to SOL

          // Get SOL price at the time of the transaction
          const tradeTimestamp = tx.blockTime * 1000;
          let priceUSD = 0;
          try {
            priceUSD = await jupiterApiService.getTokenPriceInUSD('So11111111111111111111111111111111111111112', tradeTimestamp);
          } catch (error) {
            console.error('Failed to fetch SOL price:', error);
          }

          const valueUSD = amount * priceUSD;

          return {
            signature: tx.signature,
            timestamp: tradeTimestamp,
            type,
            tokenSymbol: 'SOL',
            tokenAddress: 'So11111111111111111111111111111111111111112',
            tokenLogoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
            decimals: 9,
            amount,
            priceUSD,
            priceSOL: 1, // SOL price in SOL is always 1
            valueUSD,
            valueSOL: amount,
            profitLoss: 0, // Set to 0 to match ProcessedTrade type
            blockTime: tx.blockTime
          };
        }
        return null;
      }

      // Get the first significant token change
      const tokenChange = tokenChanges[0];
      if (!tokenChange) {
        return null;
      }

      // Set default values
      let tokenInfo = null;
      let priceUSD = 0;
      let priceSOL = 0;

      try {
        // Get token info using TokenInfoService (which uses caching)
        console.log(`🔍 Getting token info for ${tokenChange.tokenAddress} from TokenInfoService`);
        tokenInfo = await TokenInfoService.getTokenInfo(tokenChange.tokenAddress);
      } catch (error) {
        console.error('Failed to fetch token info:', error);
      }

      try {
        // Get price data using new API methods
        const tradeTimestamp = tx.blockTime * 1000; // Convert to milliseconds
        console.log(`TradingHistoryService: Fetching historical price for ${tokenChange.tokenAddress} at timestamp ${tradeTimestamp}`);

        // Get historical price data using new API methods with timestamp
        [priceUSD, priceSOL] = await Promise.all([
          jupiterApiService.getTokenPriceInUSD(tokenChange.tokenAddress, tradeTimestamp),
          jupiterApiService.getTokenPriceInSOL(tokenChange.tokenAddress, tradeTimestamp)
        ]);
      } catch (error) {
        console.error('Failed to fetch price data:', error);
      }

      // Calculate trade values
      const amount = Math.abs(tokenChange.uiAmount);
      const valueUSD = amount * priceUSD;
      const valueSOL = amount * priceSOL;

      // Determine trade type based on SOL balance change
      const preBalance = tx.preBalances[0] || 0;
      const postBalance = tx.postBalances[0] || 0;
      const balanceChange = postBalance - preBalance;
      const type = balanceChange < 0 ? 'BUY' : 'SELL';

      // Add a delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

      // Ensure we have valid token symbol and logo URI
      const tokenSymbol = tokenInfo?.symbol || tokenChange.tokenTicker || `Token-${tokenChange.tokenAddress.slice(0, 4)}...${tokenChange.tokenAddress.slice(-4)}`;
      const tokenLogoURI = tokenInfo?.logoURI || tokenChange.logo || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/unknown-token.png';

      console.log(`🏷️ Using token info for ${tokenChange.tokenAddress}: Symbol=${tokenSymbol}, Logo=${tokenLogoURI}`);

      return {
        signature: tx.signature,
        timestamp: tx.blockTime * 1000,
        type,
        tokenSymbol,
        tokenAddress: tokenChange.tokenAddress,
        tokenLogoURI,
        decimals: tokenChange.decimals,
        amount,
        priceUSD,
        priceSOL,
        valueUSD,
        valueSOL: valueSOL,
        profitLoss: 0, // Set to 0 to match ProcessedTrade type
        blockTime: tx.blockTime
      };
    } catch (error) {
      console.error('Error processing transaction:', error);
      return null;
    }
  }

  /**
   * Get trading history for a wallet - ONLY fetches from database if already scanned, performs initial scan if not
   * @param userId The user ID
   * @param walletAddress The wallet address
   * @param limit The maximum number of results to return
   * @param page The page number (starting from 1)
   * @param minTimestamp Optional timestamp to filter trades (milliseconds since epoch)
   */
  async getTradingHistory(
    userId: string,
    walletAddress: string,
    limit: number = 50,
    page: number = 1,
    minTimestamp?: number
  ): Promise<{ trades: ProcessedTrade[], totalCount: number }> {
    try {
      console.log('🔍 Getting trading history for:', { userId, walletAddress, limit, page, minTimestamp });

      // First, ensure wallet exists and get its status
      const { walletId, initialScanComplete, lastUpdated } = await this.ensureWalletExists(userId, walletAddress);
      console.log('📋 Wallet status:', { walletId, initialScanComplete, lastUpdated });

      // Get all transactions from DRPC
      console.log('🔄 Fetching transactions from DRPC');
      const transactions = await drpcClient.getTransactionsByWallet(
        walletAddress,
        { 
          from: minTimestamp ? new Date(minTimestamp) : undefined,
          limit: 1000 // Assuming a large limit for initial scan
        }
      );

      // Extract all unique token addresses from transactions first
      console.log(`📦 Processing ${transactions.transactions.length} transactions`);
      const processedTrades: ProcessedTrade[] = [];
      const BATCH_SIZE = 50;

      // First, extract all unique token addresses from the transactions
      const uniqueTokenAddresses = new Set<string>();

      // Add SOL token address as it's commonly used
      uniqueTokenAddresses.add('So11111111111111111111111111111111111111112');

      // Extract token addresses from all transactions
      for (const tx of transactions.transactions) {
        if (tx.tokenBalanceChanges && tx.tokenBalanceChanges.length > 0) {
          for (const tokenChange of tx.tokenBalanceChanges) {
            if (tokenChange.tokenAddress) {
              uniqueTokenAddresses.add(tokenChange.tokenAddress);
            }
          }
        }
      }

      console.log(`🔍 Found ${uniqueTokenAddresses.size} unique tokens to pre-fetch`);

      // Pre-fetch token info for all unique tokens
      const tokenInfoMap = new Map();
      for (const tokenAddress of uniqueTokenAddresses) {
        try {
          console.log(`🔍 Pre-fetching token info for ${tokenAddress}`);
          const tokenInfo = await TokenInfoService.getTokenInfo(tokenAddress);
          tokenInfoMap.set(tokenAddress, tokenInfo);
          console.log(`✅ Pre-fetched token info for ${tokenAddress}: ${tokenInfo.symbol}`);
        } catch (error) {
          console.error(`❌ Error pre-fetching token info for ${tokenAddress}:`, error);
        }
      }

      // Now process transactions in batches with pre-fetched token info
      for (let i = 0; i < transactions.transactions.length; i += BATCH_SIZE) {
        const batch = transactions.transactions.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(tx => this.processTransaction(tx, walletAddress));
        const batchResults = await Promise.all(batchPromises);

        // Filter out null results and add to processed trades
        const validTrades = batchResults.filter((trade): trade is ProcessedTrade => trade !== null);
        processedTrades.push(...validTrades);

        // Add a small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < transactions.transactions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Cache all processed trades
      if (processedTrades.length > 0) {
        console.log(`💾 Caching ${processedTrades.length} trades`);
        await this.cacheTrades(userId, walletAddress, processedTrades);
      }

      // Return paginated results
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedTrades = processedTrades.slice(start, end);

      console.log('✅ Trading history processed successfully');
      return {
        trades: paginatedTrades,
        totalCount: processedTrades.length
      };

    } catch (error) {
      console.error('💥 Error in getTradingHistory:', error);
      throw error;
    }
  }

  /**
   * Scan full trading history for specific tokens
   * This is called after the initial 24-hour scan to get complete history for found tokens
   */
  private async scanFullHistoryForTokens(
    userId: string,
    walletAddress: string,
    tokenAddresses: string[],
    seenATAsByToken: Map<string, Set<string>>
  ): Promise<void> {
    try {
      console.log(`Starting full historical scan for ${tokenAddresses.length} tokens:`, tokenAddresses);

      // Get wallet ID
      const { walletId } = await this.ensureWalletExists(userId, walletAddress);

      // Process each token in parallel with rate limiting
      const BATCH_SIZE = 3; // Process 3 tokens at a time
      for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
        const tokenBatch = tokenAddresses.slice(i, i + BATCH_SIZE);
        const batchPromises = tokenBatch.map(async (tokenAddress) => {
          try {
            console.log(`Processing historical trades for token: ${tokenAddress}`);

            // Get current ATAs for this token
            const tokenAccounts = await drpcClient.getTokenAccountsByOwner(walletAddress, tokenAddress);
            const activeATAs = tokenAccounts.map(account => account.pubkey);

            // Get historic ATAs we saw during initial scan
            const historicATAs = seenATAsByToken.get(tokenAddress) || new Set<string>();

            // Combine current and historic ATAs
            const allATAs = Array.from(new Set([...activeATAs, ...historicATAs]));

            if (allATAs.length === 0) {
              console.log(`No token accounts found for token ${tokenAddress}`);
              return;
            }

            console.log(`Found ${allATAs.length} total token accounts for ${tokenAddress} (${activeATAs.length} active, ${historicATAs.size} historic)`);

            // Get all signatures for each ATA
            const allSignatures: string[] = [];
            for (const ATA of allATAs) {
              let beforeSignature: string | undefined;

              // Keep fetching signatures until we have all of them
              while (true) {
                const response = await drpcClient.getSignaturesForAddress(
                  ATA,
                  {
                    limit: 500,
                    before: beforeSignature
                  }
                );

                if (!response || response.length === 0) {
                  break;
                }

                const newSignatures = response.map(sig => sig.signature);
                allSignatures.push(...newSignatures);
                beforeSignature = response[response.length - 1].signature;

                // Add a small delay between fetches
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            console.log(`Found ${allSignatures.length} total signatures for token ${tokenAddress}`);

            // Process signatures in smaller batches
            const SIG_BATCH_SIZE = 50;
            const processedTrades: ProcessedTrade[] = [];

            for (let j = 0; j < allSignatures.length; j += SIG_BATCH_SIZE) {
              const sigBatch = allSignatures.slice(j, j + SIG_BATCH_SIZE);
              const txPromises = sigBatch.map(async (signature) => {
                try {
                  const tx = await drpcClient.getTransaction(signature);
                  if (tx) {
                    return this.processTransaction(tx, walletAddress);
                  }
                  return null;
                } catch (error) {
                  console.error(`Error fetching transaction ${signature}:`, error);
                  return null;
                }
              });

              const txResults = await Promise.all(txPromises);

              // Filter out null results and trades for other tokens
              const validTrades = txResults.filter((trade): trade is ProcessedTrade => 
                trade !== null && trade.tokenAddress === tokenAddress
              );

              processedTrades.push(...validTrades);

              // Add delay between signature batches
              if (j + SIG_BATCH_SIZE < allSignatures.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            // Cache the processed trades
            if (processedTrades.length > 0) {
              console.log(`Caching ${processedTrades.length} historical trades for token ${tokenAddress}`);
              await this.cacheTrades(userId, walletAddress, processedTrades);
            } else {
              console.log(`No valid trades found for token ${tokenAddress}`);
            }

          } catch (error) {
            console.error(`Error processing token ${tokenAddress}:`, error);
          }
        });

        // Wait for current batch to complete
        await Promise.all(batchPromises);

        // Add delay between token batches
        if (i + BATCH_SIZE < tokenAddresses.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('Completed full historical scan for all tokens');
    } catch (error) {
      console.error('Error in scanFullHistoryForTokens:', error);
      throw error;
    }
  }

  /**
   * Refresh trading history for a wallet - performs incremental scan from updated_at timestamp
   * @param userId The user ID
   * @param walletAddress The wallet address
   */
  async refreshTradingHistory(
    userId: string,
    walletAddress: string
  ): Promise<{ newTradesCount: number, message: string }> {
    try {
      // Get wallet info and last update time
      const { walletId, lastUpdated } = await this.ensureWalletExists(userId, walletAddress);

      if (!lastUpdated) {
        throw new Error('No last update time found for wallet');
      }

      // Get all transactions since last update
      const transactions = await drpcClient.getTransactionsByWallet(
        walletAddress,
        { 
          from: new Date(lastUpdated.getTime()),
          limit: 1000 // Assuming a large limit for refresh
        }
      );

      if (transactions.transactions.length === 0) {
        return {
          newTradesCount: 0,
          message: "You're up to date!"
        };
      }

      // Process new transactions
      const processedTrades: ProcessedTrade[] = [];
      const BATCH_SIZE = 50;

      // First, extract all unique token addresses from the transactions
      const uniqueTokenAddresses = new Set<string>();

      // Add SOL token address as it's commonly used
      uniqueTokenAddresses.add('So11111111111111111111111111111111111111112');

      // Extract token addresses from all transactions
      for (const tx of transactions.transactions) {
        if (tx.tokenBalanceChanges && tx.tokenBalanceChanges.length > 0) {
          for (const tokenChange of tx.tokenBalanceChanges) {
            if (tokenChange.tokenAddress) {
              uniqueTokenAddresses.add(tokenChange.tokenAddress);
            }
          }
        }
      }

      console.log(`🔍 Found ${uniqueTokenAddresses.size} unique tokens to pre-fetch for refresh`);

      // Pre-fetch token info for all unique tokens
      const tokenInfoMap = new Map();
      for (const tokenAddress of uniqueTokenAddresses) {
        try {
          console.log(`🔍 Pre-fetching token info for ${tokenAddress}`);
          const tokenInfo = await TokenInfoService.getTokenInfo(tokenAddress);
          tokenInfoMap.set(tokenAddress, tokenInfo);
          console.log(`✅ Pre-fetched token info for ${tokenAddress}: ${tokenInfo.symbol}`);
        } catch (error) {
          console.error(`❌ Error pre-fetching token info for ${tokenAddress}:`, error);
        }
      }

      // Now process transactions in batches with pre-fetched token info
      for (let i = 0; i < transactions.transactions.length; i += BATCH_SIZE) {
        const batch = transactions.transactions.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(tx => this.processTransaction(tx, walletAddress));
        const batchResults = await Promise.all(batchPromises);

        const validTrades = batchResults.filter((trade): trade is ProcessedTrade => trade !== null);
        processedTrades.push(...validTrades);

        if (i + BATCH_SIZE < transactions.transactions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Cache new trades
      await this.cacheTrades(userId, walletAddress, processedTrades);

      // No need to update last_updated timestamp in tracked_wallets
      // as cacheTrades already updates it with the most recent transaction timestamp

      return {
        newTradesCount: processedTrades.length,
        message: `Found ${processedTrades.length} new trades!`
      };
    } catch (error) {
      console.error('Error in refreshTradingHistory:', error);
      throw error;
    }
  }

  /**
   * Toggle starred status for a trade
   */
  async toggleStarredTrade(walletId: string, signature: string | null, starred: boolean, tokenAddress?: string): Promise<void> {
    try {
      let query = supabase
        .from('trading_history')
        .update({ starred })
        .eq('wallet_id', walletId);

      // Handle null signature case
      if (signature === null) {
        query = query.is('signature', null);
      } else {
        query = query.eq('signature', signature);
      }

      // Filter by token_address if provided
      if (tokenAddress) {
        query = query.eq('token_address', tokenAddress);
      }

      const { error } = await query;

      if (error) {
        console.error('Error toggling starred status:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in toggleStarredTrade:', error);
      throw error;
    }
  }

  /**
   * Update notes and tags for a trade
   * @param walletId The wallet ID
   * @param signature The signature of the trade (can be null)
   * @param notes The notes to save
   * @param tags Optional tags to save
   * @param tokenAddress Optional token address to filter by
   */
  async updateTradeNotes(walletId: string, signature: string | null, notes: string, tags?: string, tokenAddress?: string): Promise<void> {
    try {
      console.log(`Updating trade notes for wallet ${walletId}, signature: ${signature}, tokenAddress: ${tokenAddress || 'not specified'}`);

      let query = supabase
        .from('trading_history')
        .update({ 
          notes,
          tags: tags || ''
        })
        .eq('wallet_id', walletId);

      // Handle null signature case differently
      if (signature === null) {
        console.log('Handling null signature case');
        query = query.is('signature', null);
      } else {
        query = query.eq('signature', signature);
      }

      // Filter by token address if provided
      if (tokenAddress) {
        console.log('Filtering by token address:', tokenAddress);
        query = query.eq('token_address', tokenAddress);
      }

      const { error } = await query;

      if (error) {
        console.error('Error updating trade notes:', error);
        throw error;
      }

      console.log(`Successfully updated notes for trade with signature: ${signature}`);
    } catch (error) {
      console.error('Error in updateTradeNotes:', error);
      throw error;
    }
  }

  /**
   * Get starred trades for trade log
   */
  async getStarredTrades(
    userId: string,
    walletAddress?: string,
    limit?: number,
    offset?: number
  ): Promise<{ trades: ProcessedTrade[], totalCount: number }> {
    try {
      const { walletId } = await this.ensureWalletExists(userId, walletAddress || '');

      let query = supabase
        .from('trading_history')
        .select('*', { count: 'exact' })
        .eq('starred', true)
        .order('timestamp', { ascending: false });

      // If walletAddress is provided, filter by specific wallet
      if (walletAddress) {
        query = query.eq('wallet_id', walletId);
      } else {
        // Get all wallets for this user
        const { data: wallets } = await supabase
          .from('tracked_wallets')
          .select('id')
          .eq('user_id', userId);

        if (wallets && wallets.length > 0) {
          const walletIds = wallets.map(w => w.id);
          query = query.in('wallet_id', walletIds);
        }
      }

      // Apply pagination if provided
      if (limit !== undefined && offset !== undefined) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data: trades, error, count } = await query;

      if (error) {
        console.error('Error fetching starred trades:', error);
        throw error;
      }

      // Map to ProcessedTrade format
      const processedTrades: ProcessedTrade[] = (trades || []).map(trade => ({
        signature: trade.signature,
        timestamp: new Date(trade.timestamp).getTime(),
        type: trade.type as 'BUY' | 'SELL' | 'UNKNOWN',
        tokenAddress: trade.token_address,
        tokenSymbol: trade.token_symbol || 'Unknown',
        tokenLogoURI: trade.token_logo_uri || null,
        amount: trade.amount,
        decimals: trade.decimals || 9,
        priceUSD: trade.price_usd || 0,
        priceSOL: trade.price_sol || 0,
        valueUSD: trade.value_usd || 0,
        valueSOL: trade.value_sol || 0,
        profitLoss: trade.profit_loss || 0,
        blockTime: trade.block_time,
        starred: trade.starred || false,
        notes: trade.notes || '',
        tags: trade.tags || ''
      }));

      return {
        trades: processedTrades,
        totalCount: count || 0
      };
    } catch (error) {
      console.error('Error in getStarredTrades:', error);
      throw error;
    }
  }

  /**
   * Get all trades for a specific token address
   */
  async getAllTokenTrades(
    userId: string,
    walletAddress: string,
    tokenAddress: string
  ): Promise<{ trades: ProcessedTrade[], totalCount: number }> {
    try {
      const { walletId } = await this.ensureWalletExists(userId, walletAddress);

      const { data: trades, error, count } = await supabase
        .from('trading_history')
        .select('*', { count: 'exact' })
        .eq('wallet_id', walletId)
        .eq('token_address', tokenAddress)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching token trades:', error);
        throw error;
      }

      // Map to ProcessedTrade format
      const processedTrades: ProcessedTrade[] = (trades || []).map(trade => ({
        signature: trade.signature,
        timestamp: new Date(trade.timestamp).getTime(),
        type: trade.type as 'BUY' | 'SELL' | 'UNKNOWN',
        tokenAddress: trade.token_address,
        tokenSymbol: trade.token_symbol || 'Unknown',
        tokenLogoURI: trade.token_logo_uri || null,
        amount: trade.amount,
        decimals: trade.decimals || 9,
        priceUSD: trade.price_usd || 0,
        priceSOL: trade.price_sol || 0,
        valueUSD: trade.value_usd || 0,
        valueSOL: trade.value_sol || 0,
        profitLoss: trade.profit_loss || 0,
        blockTime: trade.block_time,
        starred: trade.starred || false,
        notes: trade.notes || '',
        tags: trade.tags || ''
      }));

      return {
        trades: processedTrades,
        totalCount: count || 0
      };
    } catch (error) {
      console.error('Error in getAllTokenTrades:', error);
      throw error;
    }
  }

  /**
   * Refresh historical prices for cached trades using their stored timestamps
   * This ensures we get accurate historical prices instead of relying on cached values
   */
  async refreshHistoricalPrices(trades: any[]): Promise<ProcessedTrade[]> {
    console.log(`Refreshing historical prices for ${trades.length} trades using stored timestamps`);

    const updatedTrades: ProcessedTrade[] = [];

    // Process in small batches to avoid rate limiting
    const BATCH_SIZE = 3;
    for (let i = 0; i < trades.length; i += BATCH_SIZE) {
      const batch = trades.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (trade) => {
        try {
          // Extract the stored timestamp from the database
          const storedTimestamp = new Date(trade.timestamp).getTime();
          console.log(`Fetching historical price for ${trade.token_address} at stored timestamp: ${new Date(storedTimestamp).toISOString()}`);

          // Fetch fresh historical prices using the stored timestamp
          const [freshPriceUSD, freshPriceSOL] = await Promise.all([
            jupiterApiService.getTokenPriceInUSD(trade.token_address, storedTimestamp),
            jupiterApiService.getTokenPriceInSOL(trade.token_address, storedTimestamp)
          ]);

          // Calculate updated values
          const amount = trade.amount;
          const freshValueUSD = amount * freshPriceUSD;
          const freshValueSOL = amount * freshPriceSOL;
          // No longer calculating profit/loss as it should be null

          console.log(`Historical price update for ${trade.token_symbol}: was $${trade.price_usd}, now $${freshPriceUSD}`);

          // Create updated trade object
          return {
            signature: trade.signature,
            timestamp: storedTimestamp,
            type: trade.type as 'BUY' | 'SELL' | 'UNKNOWN',
            tokenAddress: trade.token_address,
            tokenSymbol: trade.token_symbol || 'Unknown',
            tokenLogoURI: trade.token_logo_uri || null,
            amount: trade.amount,
            decimals: trade.decimals || 9,
            priceUSD: freshPriceUSD,  // ✅ Fresh historical price
            priceSOL: freshPriceSOL,  // ✅ Fresh historical price
            valueUSD: freshValueUSD,  // ✅ Recalculated with fresh price
            valueSOL: freshValueSOL,  // ✅ Recalculated with fresh price
            profitLoss: 0,  // Set to 0 to match ProcessedTrade type
            blockTime: trade.block_time,
            starred: trade.starred || false,
            notes: trade.notes || '',
            tags: trade.tags || ''
          };
        } catch (error) {
          console.error(`Error refreshing price for trade ${trade.signature}:`, error);

          // Fallback to cached data if fresh lookup fails
          return {
            signature: trade.signature,
            timestamp: new Date(trade.timestamp).getTime(),
            type: trade.type as 'BUY' | 'SELL' | 'UNKNOWN',
            tokenAddress: trade.token_address,
            tokenSymbol: trade.token_symbol || 'Unknown',
            tokenLogoURI: trade.token_logo_uri || null,
            amount: trade.amount,
            decimals: trade.decimals || 9,
            priceUSD: trade.price_usd || 0,  // Fallback to cached
            priceSOL: trade.price_sol || 0,  // Fallback to cached
            valueUSD: trade.value_usd || 0,  // Fallback to cached
            valueSOL: trade.value_sol || 0,  // Fallback to cached
            profitLoss: 0,  // Set to 0 to match ProcessedTrade type
            blockTime: trade.block_time,
            starred: trade.starred || false,
            notes: trade.notes || '',
            tags: trade.tags || ''
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      updatedTrades.push(...batchResults);

      // Add delay between batches to prevent rate limiting
      if (i + BATCH_SIZE < trades.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Completed historical price refresh for ${updatedTrades.length} trades`);
    return updatedTrades;
  }

  async getHistoricalDataForTokens(
    userId: string,
    walletAddress: string,
    tokenAddresses: string[]
  ): Promise<Record<string, ProcessedTrade[]>> {
    try {
      // First ensure wallet exists and get wallet ID
      const { walletId } = await this.ensureWalletExists(userId, walletAddress);

      // Get all trades for these specific tokens from our database
      const { data: cachedTrades, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId)
        .in('token_address', tokenAddresses)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching cached trades:', error);
        throw new Error('Failed to fetch cached trades');
      }

      // Group trades by token address
      const tradesByToken = cachedTrades.reduce((acc, trade) => {
        const tokenAddress = trade.token_address;
        if (!acc[tokenAddress]) {
          acc[tokenAddress] = [];
        }
        acc[tokenAddress].push({
          signature: trade.signature,
          tokenAddress: trade.token_address,
          tokenSymbol: trade.token_symbol,
          tokenLogoURI: trade.token_logo_uri,
          type: trade.type,
          amount: trade.amount,
          priceUSD: trade.price_usd,
          valueUSD: trade.value_usd,
          timestamp: new Date(trade.timestamp).getTime(),
          profitLoss: trade.profit_loss,
          starred: trade.starred,
          notes: trade.notes,
          tags: trade.tags
        });
        return acc;
      }, {} as Record<string, ProcessedTrade[]>);

      // For each token, ensure we have all historical trades
      for (const tokenAddress of tokenAddresses) {
        if (!tradesByToken[tokenAddress]) {
          tradesByToken[tokenAddress] = [];
        }

        // Get all trades for this specific token from DRPC
        const allTokenTrades = await this.getAllTokenTrades(userId, walletAddress, tokenAddress);

        if (allTokenTrades.trades.length > 0) {
          // Cache all trades - rely on the database's unique constraint to handle duplicates
          console.log(`Caching ${allTokenTrades.trades.length} trades for token ${tokenAddress} - will rely on database's unique constraint to handle duplicates`);
          await this.cacheTrades(userId, walletAddress, allTokenTrades.trades);

          // Merge with cached trades
          const existingSignatures = new Set(tradesByToken[tokenAddress].map((t: ProcessedTrade) => t.signature));
          const newTradesToMemory = allTokenTrades.trades.filter((t: ProcessedTrade) => !existingSignatures.has(t.signature));
          tradesByToken[tokenAddress] = [...tradesByToken[tokenAddress], ...newTradesToMemory];
        }
      }

      return tradesByToken;
    } catch (error) {
      console.error('Error in getHistoricalDataForTokens:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const tradingHistoryService = new TradingHistoryService(); 
