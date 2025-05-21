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
import { drpcClient, Transaction } from './drpcClient';
import { v4 as uuidv4 } from 'uuid';
import { jupiterApiService } from './jupiterApiService';

export interface CachedTrade extends ProcessedTrade {
  wallet_id: string;
  created_at: string;
  updated_at: string;
}

export class TradingHistoryService {
  /**
   * Ensure wallet exists in the database
   */
  private async ensureWalletExists(userId: string, walletAddress: string): Promise<string> {
    try {
      // First try to find existing wallet
      const { data: existingWallet } = await supabase
        .from('wallets')
        .select('id, initial_scan_complete')
        .eq('user_id', userId)
        .eq('wallet_address', walletAddress)
        .single();

      if (existingWallet) {
        console.log('Found existing wallet:', existingWallet.id);
        return existingWallet.id;
      }

      // If not found, create new wallet
      const walletId = uuidv4();
      console.log('Creating new wallet with ID:', walletId);
      
      const { error } = await supabase
        .from('wallets')
        .upsert({
          id: walletId,
          user_id: userId,
          wallet_address: walletAddress,
          initial_scan_complete: false
        }, { 
          onConflict: 'user_id,wallet_address'
        });

      if (error) {
        console.error('Error upserting wallet:', error);
        throw error;
      }

      return walletId;
    } catch (error) {
      console.error('Error in ensureWalletExists:', error);
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
        id: `${trade.signature}-${trade.token_address}`,
        signature: trade.signature,
        timestamp: new Date(trade.timestamp).getTime(),
        blockTime: trade.block_time,
        type: trade.type,
        tokenSymbol: trade.token_symbol,
        tokenAddress: trade.token_address,
        tokenLogoURI: trade.token_logo_uri,
        decimals: trade.decimals,
        amount: trade.amount,
        price: trade.price_sol,
        priceUSD: trade.price_usd,
        value: trade.value_sol,
        valueUSD: trade.value_usd,
        profitLoss: trade.profit_loss,
        marketCap: trade.market_cap,
        wallet_id: trade.wallet_id,
        created_at: trade.created_at,
        updated_at: trade.updated_at
      }));

      return trades;
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
   * Cache new trades in Supabase
   */
  async cacheTrades(userId: string, walletAddress: string, trades: ProcessedTrade[]): Promise<void> {
    try {
      if (!trades.length) return;

      // First ensure the wallet exists and get its ID
      const walletId = await this.ensureWalletExists(userId, walletAddress);
      console.log('Caching trades for wallet:', walletId, 'Number of trades:', trades.length);

      // Convert ProcessedTrade to database format
      const tradesToInsert = trades.map(trade => {
        const dbTrade = {
          wallet_id: walletId,
          signature: trade.signature,
          timestamp: new Date(trade.timestamp).toISOString(),
          block_time: trade.blockTime,
          type: trade.type || 'UNKNOWN',
          token_symbol: trade.tokenSymbol || 'Unknown',
          token_address: trade.tokenAddress || '',
          token_logo_uri: trade.tokenLogoURI || '',
          decimals: trade.decimals || 0,
          amount: trade.amount || 0,
          price_sol: trade.price || 0,
          price_usd: trade.priceUSD || 0,
          value_sol: trade.value || 0,
          value_usd: trade.valueUSD || 0,
          profit_loss: trade.profitLoss || 0,
          market_cap: trade.marketCap || 0
        };

        console.log('Processing trade for caching:', {
          signature: dbTrade.signature,
          type: dbTrade.type,
          token: dbTrade.token_symbol,
          amount: dbTrade.amount,
          timestamp: dbTrade.timestamp
        });

        return dbTrade;
      });

      console.log('Inserting trades into Supabase:', tradesToInsert.length);

      // Use upsert to handle duplicates
      const { error } = await supabase
        .from('trading_history')
        .upsert(tradesToInsert, {
          onConflict: 'wallet_id,signature'
        });

      if (error) {
        console.error('Error caching trades:', error);
        throw error;
      }

      console.log('Successfully cached trades');
    } catch (error) {
      console.error('Error in cacheTrades:', error);
      throw error;
    }
  }

  /**
   * Get trading history for a wallet, using cache and fetching new trades if needed
   */
  async getTradingHistory(
    userId: string,
    walletAddress: string,
    limit: number = 100, // Increased default limit
    page: number = 1
  ): Promise<{
    trades: ProcessedTrade[];
    totalCount: number;
  }> {
    try {
      console.log('Getting trading history for wallet:', walletAddress, {
        userId,
        limit,
        page
      });

      // First ensure the wallet exists and get its ID
      const walletId = await this.ensureWalletExists(userId, walletAddress);
      
      // Check if we've done the initial historical scan
      const { data: walletData } = await supabase
        .from('wallets')
        .select('initial_scan_complete')
        .eq('id', walletId)
        .single();

      const initialScanComplete = walletData?.initial_scan_complete || false;

      if (!initialScanComplete) {
        console.log('Initial scan not complete, fetching all historical data...');
        
        // For initial scan, fetch in smaller batches to avoid timeouts
        const BATCH_SIZE = 50;
        let allTransactions: ProcessedTrade[] = [];
        let lastSignature: string | undefined;
        let hasMore = true;
        let retryCount = 0;
        const MAX_RETRIES = 3;

        while (hasMore && retryCount < MAX_RETRIES) {
          try {
            console.log('Fetching batch of transactions, lastSignature:', lastSignature);
            const response = await drpcClient.getTransactions(walletAddress, BATCH_SIZE, lastSignature);
            
            if (!response.transactions || response.transactions.length === 0) {
              hasMore = false;
              break;
            }

            // Process transactions in smaller sub-batches to avoid rate limits
            const SUB_BATCH_SIZE = 5;
            for (let i = 0; i < response.transactions.length; i += SUB_BATCH_SIZE) {
              const subBatch = response.transactions.slice(i, i + SUB_BATCH_SIZE);
              const processedTrades = await this.processAndStoreTrades(walletId, subBatch);
              allTransactions = [...allTransactions, ...processedTrades];
              
              // Add a small delay between sub-batches
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Update lastSignature for next batch
            lastSignature = response.lastSignature || undefined;
            
            // If we got fewer transactions than requested, we're done
            if (response.transactions.length < BATCH_SIZE) {
              hasMore = false;
            }

            // Reset retry count on successful fetch
            retryCount = 0;

          } catch (error) {
            console.error('Error fetching transaction batch:', error);
            retryCount++;
            // Add exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          }
        }

        // Mark initial scan as complete even if we hit retry limit
        await supabase
          .from('wallets')
          .update({ initial_scan_complete: true })
          .eq('id', walletId);

        // Return paginated results
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        return {
          trades: allTransactions.slice(startIndex, endIndex),
          totalCount: allTransactions.length
        };
      }

      // If initial scan is complete, just fetch new transactions since the last one
      const { data: latestTrade } = await supabase
        .from('trading_history')
        .select('timestamp')
        .eq('wallet_id', walletId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      const afterTimestamp = latestTrade ? new Date(latestTrade.timestamp) : undefined;
      console.log('Fetching new transactions after:', afterTimestamp);
      
      // Fetch new transactions in batches
      const BATCH_SIZE = 50;
      let newTransactions: Transaction[] = [];
      let lastSignature: string | undefined;
      let hasMore = true;
      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (hasMore && retryCount < MAX_RETRIES) {
        try {
          const response = await drpcClient.getTransactions(walletAddress, BATCH_SIZE, lastSignature, afterTimestamp);
          
          if (!response.transactions || response.transactions.length === 0) {
            break;
          }

          newTransactions = [...newTransactions, ...response.transactions];
          lastSignature = response.lastSignature || undefined;

          if (response.transactions.length < BATCH_SIZE) {
            hasMore = false;
          }

          // Reset retry count on successful fetch
          retryCount = 0;

        } catch (error) {
          console.error('Error fetching new transactions:', error);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }

      if (newTransactions.length > 0) {
        // Process new transactions in smaller batches
        const SUB_BATCH_SIZE = 5;
        for (let i = 0; i < newTransactions.length; i += SUB_BATCH_SIZE) {
          const subBatch = newTransactions.slice(i, i + SUB_BATCH_SIZE);
          await this.processAndStoreTrades(walletId, subBatch);
          // Add delay between sub-batches
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Get paginated results from database
      const { data: trades, error: fetchError, count } = await supabase
        .from('trading_history')
        .select('*', { count: 'exact' })
        .eq('wallet_id', walletId)
        .order('timestamp', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (fetchError) {
        throw fetchError;
      }

      return {
        trades: trades || [],
        totalCount: count || 0
      };
    } catch (error) {
      console.error('Error in getTradingHistory:', error);
      throw error;
    }
  }

  /**
   * Process and store trades in the database
   */
  private async processAndStoreTrades(walletId: string, transactions: Transaction[]): Promise<ProcessedTrade[]> {
    const processedTrades: ProcessedTrade[] = [];

    for (const tx of transactions) {
      try {
        // Process the transaction
        const trade = await this.processTransaction(tx);
        if (!trade) continue;

        // Add wallet ID to the trade and map to database columns
        const tradeRecord = {
          wallet_id: walletId,
          signature: trade.signature,
          timestamp: new Date(trade.timestamp).toISOString(),
          block_time: trade.blockTime,
          type: trade.type,
          token_symbol: trade.tokenSymbol,
          token_address: trade.tokenAddress,
          token_logo_uri: trade.tokenLogoURI,
          decimals: trade.decimals,
          amount: trade.amount,
          price_sol: trade.price,
          price_usd: trade.priceUSD,
          value_sol: trade.value,
          value_usd: trade.valueUSD,
          profit_loss: trade.profitLoss,
          market_cap: trade.marketCap
        };

        // Store in database
        const { error } = await supabase
          .from('trading_history')
          .upsert(tradeRecord, {
            onConflict: 'wallet_id,signature',
            ignoreDuplicates: true
          });

        if (error) {
          console.error('Error storing trade:', error);
          continue;
        }

        processedTrades.push(trade);
      } catch (error) {
        console.error('Error processing transaction:', error);
      }
    }

    return processedTrades;
  }

  /**
   * Process a single transaction into a trade
   */
  private async processTransaction(tx: Transaction): Promise<ProcessedTrade | null> {
    try {
      if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
        return null;
      }

      // Get token balances that changed
      const tokenChanges = tx.tokenBalanceChanges || [];
      if (tokenChanges.length === 0) {
        return null;
      }

      // Get the first significant token change
      const tokenChange = tokenChanges[0];
      if (!tokenChange) {
        return null;
      }

      let priceUsd = 0;
      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (retryCount < MAX_RETRIES) {
        try {
          // Try to get the token price
          const priceData = await jupiterApiService.fetchTokenPrice(
            tokenChange.tokenAddress,
            tx.blockTime
          );
          priceUsd = priceData.priceUsd || 0;
          break;
        } catch (error) {
          console.error(`Error fetching price (attempt ${retryCount + 1}):`, error);
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            // Add exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          }
        }
      }

      // Proceed with trade processing even if price fetch failed
      return {
        id: tx.signature,
        signature: tx.signature,
        timestamp: tx.blockTime * 1000,
        blockTime: tx.blockTime,
        type: tx.type || 'UNKNOWN',
        tokenSymbol: tokenChange.tokenTicker,
        tokenAddress: tokenChange.tokenAddress,
        tokenLogoURI: tokenChange.logo,
        decimals: tokenChange.decimals,
        amount: Math.abs(tokenChange.uiAmount),
        price: priceUsd,
        priceUSD: priceUsd,
        value: Math.abs(tokenChange.uiAmount) * priceUsd,
        valueUSD: Math.abs(tokenChange.uiAmount) * priceUsd,
        profitLoss: tokenChange.uiAmount * priceUsd
      };
    } catch (error) {
      console.error('Error processing transaction:', error);
      return null;
    }
  }
}

// Export a singleton instance
export const tradingHistoryService = new TradingHistoryService(); 