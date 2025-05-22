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
   * Ensure wallet exists in the database and check initial scan status
   */
  private async ensureWalletExists(userId: string, walletAddress: string): Promise<{
    walletId: string;
    initialScanComplete: boolean;
    lastUpdated: Date | null;
  }> {
    try {
      // First try to find existing wallet
      const { data: existingWallet } = await supabase
        .from('wallets')
        .select('id, initial_scan_complete, updated_at')
        .eq('user_id', userId)
        .eq('wallet_address', walletAddress)
        .single();

      if (existingWallet) {
        console.log('Found existing wallet:', existingWallet.id);
        return {
          walletId: existingWallet.id,
          initialScanComplete: existingWallet.initial_scan_complete,
          lastUpdated: existingWallet.updated_at ? new Date(existingWallet.updated_at) : null
        };
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

      return {
        walletId,
        initialScanComplete: false,
        lastUpdated: null
      };
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
   * Process a single transaction into a trade
   */
  private async processTransaction(tx: Transaction, walletId: string): Promise<ProcessedTrade | null> {
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

      // Set default values
      let tokenInfo = null;
      let priceData = {
        priceUsd: 0,
        priceSol: 0,
        timestamp: tx.blockTime
      };
      
      try {
        // Try to get token info
        tokenInfo = await jupiterApiService.fetchTokenInfo(tokenChange.tokenAddress);
      } catch (error) {
        console.error('Failed to fetch token info, using fallback values:', error);
      }
      
      try {
        // Try to get price data
        priceData = await jupiterApiService.fetchTokenPrice(tokenChange.tokenAddress, tx.blockTime);
      } catch (error) {
        console.error('Failed to fetch price data, using fallback values:', error);
      }
      
      // Calculate trade values
      const amount = Math.abs(tokenChange.uiAmount);
      const priceUSD = priceData.priceUsd || 0;
      const valueUSD = amount * priceUSD;
      const priceSOL = priceData.priceSol || 0;
      const valueSOL = amount * priceSOL;

      // Determine trade type based on SOL balance change
      const preBalance = tx.preBalances[0] || 0;
      const postBalance = tx.postBalances[0] || 0;
      const balanceChange = postBalance - preBalance;
      const type = balanceChange < 0 ? 'BUY' : 'SELL';

      // Calculate profit/loss
      const profitLoss = type === 'BUY' ? -valueUSD : valueUSD;

      // Add a delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

      return {
        id: `${tx.signature}-${tokenChange.tokenAddress}`,
        signature: tx.signature,
        timestamp: tx.blockTime * 1000,
        blockTime: tx.blockTime,
        type,
        tokenSymbol: tokenInfo?.symbol || tokenChange.tokenTicker || 'Unknown',
        tokenAddress: tokenChange.tokenAddress,
        tokenLogoURI: tokenInfo?.logoURI || tokenChange.logo || '',
        decimals: tokenChange.decimals,
        amount,
        price: priceSOL,
        priceUSD,
        value: valueSOL,
        valueUSD,
        profitLoss,
        marketCap: tokenInfo?.marketCap
      };
    } catch (error) {
      console.error('Error processing transaction:', error);
      return null;
    }
  }

  /**
   * Get trading history for a wallet, using cache and fetching new trades if needed
   */
  async getTradingHistory(
    userId: string,
    walletAddress: string,
    limit: number = 100,
    page: number = 1
  ): Promise<{
    trades: ProcessedTrade[];
    totalCount: number;
  }> {
    try {
      console.log('Getting trading history for wallet:', walletAddress);

      // First ensure the wallet exists and get its scan status
      const { walletId, initialScanComplete, lastUpdated } = await this.ensureWalletExists(userId, walletAddress);
      
      let transactions: Transaction[] = [];
      const BATCH_SIZE = 50;
      let lastSignature: string | undefined;
      let hasMore = true;
      let retryCount = 0;
      const MAX_RETRIES = 3;

      // If initial scan is not complete, fetch all historical transactions
      if (!initialScanComplete) {
        console.log('Initial scan not complete. Fetching all historical transactions...');
        
        while (hasMore && retryCount < MAX_RETRIES) {
          try {
            const response = await drpcClient.getTransactions(walletAddress, BATCH_SIZE, lastSignature);
            
            if (!response.transactions || response.transactions.length === 0) {
              hasMore = false;
              break;
            }

            transactions = [...transactions, ...response.transactions];
            lastSignature = response.lastSignature || undefined;

            if (response.transactions.length < BATCH_SIZE) {
              hasMore = false;
            }

            retryCount = 0;
          } catch (error) {
            console.error('Error fetching transaction batch:', error);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          }
        }

        // Mark initial scan as complete
        await supabase
          .from('wallets')
          .update({ initial_scan_complete: true })
          .eq('id', walletId);
      } 
      // If initial scan is complete, only fetch new transactions
      else if (lastUpdated) {
        console.log('Fetching new transactions since:', lastUpdated);
        
        while (hasMore && retryCount < MAX_RETRIES) {
          try {
            const response = await drpcClient.getTransactions(
              walletAddress, 
              BATCH_SIZE, 
              lastSignature,
              lastUpdated
            );
            
            if (!response.transactions || response.transactions.length === 0) {
              hasMore = false;
              break;
            }

            transactions = [...transactions, ...response.transactions];
            lastSignature = response.lastSignature || undefined;

            if (response.transactions.length < BATCH_SIZE) {
              hasMore = false;
            }

            retryCount = 0;
          } catch (error) {
            console.error('Error fetching new transactions:', error);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          }
        }
      }

      // Process transactions in batches
      const processedTrades: ProcessedTrade[] = [];
      const SUB_BATCH_SIZE = 5;

      for (let i = 0; i < transactions.length; i += SUB_BATCH_SIZE) {
        const batch = transactions.slice(i, i + SUB_BATCH_SIZE);
        
        for (const tx of batch) {
          const trade = await this.processTransaction(tx, walletId);
          if (trade) {
            processedTrades.push(trade);
          }
        }
        
        // Add delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Store trades in Supabase
      if (processedTrades.length > 0) {
        const tradesToInsert = processedTrades.map(trade => ({
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
        }));

        const { error } = await supabase
          .from('trading_history')
          .upsert(tradesToInsert, {
            onConflict: 'wallet_id,signature'
          });

        if (error) {
          console.error('Error storing trades:', error);
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
}

// Export a singleton instance
export const tradingHistoryService = new TradingHistoryService(); 