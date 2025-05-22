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
import { TokenInfoService } from './tokenInfoService';

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
   * Save processed trades to Supabase
   */
  async cacheTrades(userId: string, walletAddress: string, trades: ProcessedTrade[]): Promise<void> {
    try {
      if (!trades || trades.length === 0) {
        console.log('No trades to cache');
        return;
      }

      console.log(`Caching ${trades.length} trades for wallet ${walletAddress}`);

      // 1. Get wallet ID
      const { walletId, initialScanComplete } = await this.ensureWalletExists(userId, walletAddress);

      // 2. Convert to database records
      const tradeRecords = trades.map(trade => ({
        id: uuidv4(),
        wallet_id: walletId,
        signature: trade.signature,
        timestamp: new Date(trade.timestamp).toISOString(),
        block_time: trade.blockTime || 0,
        type: trade.type,
        token_symbol: trade.tokenSymbol,
        token_address: trade.tokenAddress,
        token_logo_uri: trade.tokenLogoURI || null,
        decimals: trade.decimals || 9,
        amount: trade.amount,
        price_sol: trade.priceSOL || 0,
        price_usd: trade.priceUSD || 0,
        value_sol: trade.valueSOL || 0,
        value_usd: trade.valueUSD || 0,
        profit_loss: trade.profitLoss || 0,
        market_cap: 0, // We don't have market cap data
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // 3. Upsert to database
      const { error } = await supabase
        .from('trading_history')
        .upsert(tradeRecords, {
          onConflict: 'wallet_id,signature'
        });

      if (error) {
        console.error('Error caching trades:', error);
        throw error;
      }

      // 4. Update the wallet's status if this was the initial scan
      if (!initialScanComplete) {
        const { error: walletUpdateError } = await supabase
          .from('wallets')
          .update({ 
            initial_scan_complete: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', walletId);

        if (walletUpdateError) {
          console.error('Error updating wallet status:', walletUpdateError);
          throw walletUpdateError;
        }
        
        console.log(`Updated wallet ${walletId} to mark initial scan as complete`);
      } else {
        // 5. Always update the wallet's updated_at timestamp after saving trades
        const { error: timestampUpdateError } = await supabase
          .from('wallets')
          .update({ 
            updated_at: new Date().toISOString()
          })
          .eq('id', walletId);

        if (timestampUpdateError) {
          console.error('Error updating wallet timestamp:', timestampUpdateError);
          throw timestampUpdateError;
        }
        
        console.log(`Updated wallet ${walletId} timestamp after saving trades`);
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
      let priceUSD = 0;
      let priceSOL = 0;
      
      try {
        // Get token info using new API method
        tokenInfo = await jupiterApiService.getTokenInfo(tokenChange.tokenAddress);
      } catch (error) {
        console.error('Failed to fetch token info:', error);
      }
      
      try {
        // Get price data using new API methods
        [priceUSD, priceSOL] = await Promise.all([
          jupiterApiService.getTokenPriceInUSD(tokenChange.tokenAddress),
          jupiterApiService.getTokenPriceInSOL(tokenChange.tokenAddress)
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

      // Calculate profit/loss
      const profitLoss = type === 'BUY' ? -valueUSD : valueUSD;

      // Add a delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

      return {
        signature: tx.signature,
        timestamp: tx.blockTime * 1000,
        type,
        tokenSymbol: tokenInfo?.symbol || tokenChange.tokenTicker || 'Unknown',
        tokenAddress: tokenChange.tokenAddress,
        tokenLogoURI: tokenInfo?.logoURI || tokenChange.logo || null,
        decimals: tokenChange.decimals,
        amount,
        priceUSD,
        priceSOL,
        valueUSD,
        valueSOL: valueSOL,
        profitLoss,
        blockTime: tx.blockTime
      };
    } catch (error) {
      console.error('Error processing transaction:', error);
      return null;
    }
  }

  /**
   * Get trading history for a wallet
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
      // Calculate offset
      const offset = (page - 1) * limit;

      // Check wallet status and ensure it exists
      const { walletId, initialScanComplete, lastUpdated } = await this.ensureWalletExists(userId, walletAddress);
      
      console.log('Wallet status:', {
        walletId,
        initialScanComplete,
        lastUpdated: lastUpdated ? lastUpdated.toISOString() : null
      });

      // Fetch trades from DRPC based on wallet status
      let newTradesProcessed = false;
      
      if (!initialScanComplete || !lastUpdated) {
        // For initial scan, fetch last 7 days of trades
        console.log('Performing initial scan for wallet:', walletAddress);
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        try {
          // Get transactions from DRPC for the last 7 days
          const transactions = await drpcClient.getTransactionsByWallet(
            walletAddress,
            { from: sevenDaysAgo }
          );
          
          console.log(`Retrieved ${transactions.length} transactions for initial scan`);
          
          // Process transactions into trades
          const processedTrades: ProcessedTrade[] = [];
          
          for (const tx of transactions) {
            const trade = await this.processTransaction(tx, walletId);
            if (trade) {
              processedTrades.push(trade);
            }
          }
          
          // Cache processed trades
          if (processedTrades.length > 0) {
            await this.cacheTrades(userId, walletAddress, processedTrades);
            newTradesProcessed = true;
          } else {
            // Even if no trades were found, mark the wallet as scanned to prevent constant rescanning
            const { error: walletUpdateError } = await supabase
              .from('wallets')
              .update({ 
                initial_scan_complete: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', walletId);
              
            if (walletUpdateError) {
              console.error('Error updating wallet status after empty scan:', walletUpdateError);
            }
          }
          
        } catch (error) {
          console.error('Error during initial scan:', error);
          
          // If the error is related to "Minimum context slot", we can still proceed
          // This is a known limitation with some RPC providers
          if (error instanceof Error && 
              (error.message.includes('Minimum context slot') || 
               error.message.includes('TRANSACTION_FETCH_ERROR'))) {
            console.log('Continuing despite RPC error during initial scan');
            
            // Mark the wallet as scanned anyway to prevent constant rescanning
            const { error: walletUpdateError } = await supabase
              .from('wallets')
              .update({ 
                initial_scan_complete: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', walletId);
              
            if (walletUpdateError) {
              console.error('Error updating wallet status after failed scan:', walletUpdateError);
            }
          } else {
            // For other errors, we might want to rethrow or handle differently
            console.error('Unexpected error during initial scan:', error);
          }
          // Continue to return cached data even if the scan fails
        }
      } else {
        // For subsequent scans, fetch only trades since last update
        console.log('Performing incremental scan since:', lastUpdated.toISOString());
        
        try {
          // Get transactions from DRPC since the last update
          const transactions = await drpcClient.getTransactionsByWallet(
            walletAddress,
            { from: lastUpdated }
          );
          
          console.log(`Retrieved ${transactions.length} transactions since last update`);
          
          // Process transactions into trades
          const processedTrades: ProcessedTrade[] = [];
          
          for (const tx of transactions) {
            const trade = await this.processTransaction(tx, walletId);
            if (trade) {
              processedTrades.push(trade);
            }
          }
          
          // Cache processed trades
          if (processedTrades.length > 0) {
            await this.cacheTrades(userId, walletAddress, processedTrades);
            newTradesProcessed = true;
          } else {
            // Even if no new trades, update the last update timestamp
            const { error: timestampUpdateError } = await supabase
              .from('wallets')
              .update({ 
                updated_at: new Date().toISOString()
              })
              .eq('id', walletId);
              
            if (timestampUpdateError) {
              console.error('Error updating wallet timestamp after empty scan:', timestampUpdateError);
            }
          }
          
        } catch (error) {
          console.error('Error during incremental scan:', error);
          
          // If the error is related to "Minimum context slot", we can still proceed
          if (error instanceof Error && 
              (error.message.includes('Minimum context slot') || 
               error.message.includes('TRANSACTION_FETCH_ERROR'))) {
            console.log('Continuing despite RPC error during incremental scan');
            
            // Update the wallet timestamp anyway to prevent repeated scanning
            const { error: timestampUpdateError } = await supabase
              .from('wallets')
              .update({ 
                updated_at: new Date().toISOString()
              })
              .eq('id', walletId);
              
            if (timestampUpdateError) {
              console.error('Error updating wallet timestamp after failed scan:', timestampUpdateError);
            }
          } else {
            // For other errors, we might want to rethrow or handle differently
            console.error('Unexpected error during incremental scan:', error);
          }
          // Continue to return cached data even if the scan fails
        }
      }

      // Fetch trades from database with pagination
      let query = supabase
        .from('trading_history')
        .select('*', { count: 'exact' })
        .eq('wallet_id', walletId);
        
      // Apply timestamp filter if provided
      if (minTimestamp) {
        const minTimestampIso = new Date(minTimestamp).toISOString();
        console.log(`Filtering trades after timestamp: ${minTimestampIso}`);
        query = query.gte('timestamp', minTimestampIso);
      }
      
      // Apply sorting and pagination
      query = query
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: trades, error, count } = await query;

      if (error) throw error;
      if (!trades) return { trades: [], totalCount: 0 };

      // Update token information for trades that need it
      const tradesNeedingUpdate = trades.filter(trade => 
        !trade.token_symbol || 
        !trade.price_usd || 
        !trade.value_usd
      );

      if (tradesNeedingUpdate.length > 0) {
        console.log(`Updating token info for ${tradesNeedingUpdate.length} trades`);
        await TokenInfoService.updateBatchTransactionTokenInfo(tradesNeedingUpdate);
        
        // Fetch updated trades
        const { data: updatedTrades, error: refetchError } = await supabase
          .from('trading_history')
          .select('*')
          .in('signature', tradesNeedingUpdate.map(t => t.signature));

        if (refetchError) throw refetchError;
        if (updatedTrades) {
          // Replace old trades with updated ones
          updatedTrades.forEach(updatedTrade => {
            const index = trades.findIndex(t => t.signature === updatedTrade.signature);
            if (index !== -1) {
              trades[index] = updatedTrade;
            }
          });
        }
      }

      // Map to ProcessedTrade format
      const processedTrades: ProcessedTrade[] = trades.map(trade => ({
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
        blockTime: trade.block_time
      }));

      return {
        trades: processedTrades,
        totalCount: count || 0
      };
    } catch (error) {
      console.error('Error fetching trading history:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const tradingHistoryService = new TradingHistoryService(); 