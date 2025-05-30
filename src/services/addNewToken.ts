import { tradingHistoryService } from './tradingHistoryService';
import { TokenInfoService } from './tokenInfoService';
import { jupiterApiService } from './jupiterApiService';
import { supabase } from '../utils/supabaseClient';

export interface AddTokenResult {
  success: boolean;
  message: string;
  tradesFound: number;
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

export class AddNewTokenService {
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
   * Add a new token by scanning for all its trades and starring them
   */
  async addNewToken(
    userId: string,
    walletAddress: string,
    tokenAddress: string
  ): Promise<AddTokenResult> {
    try {
      console.log(`🚀 Starting token addition process for ${tokenAddress}`);

      // Step 1: Check if token already exists in untracked_tokens for this wallet
      console.log(`🔍 Checking if token already exists in untracked_tokens...`);
      const existingToken = await this.checkExistingUntrackedToken(walletAddress, tokenAddress);

      if (existingToken) {
        console.log(`ℹ️ Token already exists in untracked_tokens:`, {
          symbol: existingToken.symbol,
          present_trades: existingToken.present_trades,
          current_price: existingToken.current_price
        });

        // Update the existing token with fresh data
        console.log(`🔄 Updating existing token with fresh data...`);
        const tokenData = await this.fetchTokenDataFromJupiter(tokenAddress);

        const updatedTokenRecord: UntrackedTokenRecord = {
          contract_address: tokenAddress,
          symbol: tokenData.symbol,
          wallet_address: walletAddress,
          present_trades: existingToken.present_trades, // Keep existing trade status
          current_price: tokenData.currentPrice,
          total_supply: tokenData.totalSupply,
          token_uri: tokenData.logoURI
        };

        await this.upsertUntrackedToken(updatedTokenRecord);

        return {
          success: true,
          message: `Token ${tokenData.symbol} updated with fresh data!`,
          tradesFound: existingToken.present_trades ? -1 : 0 // -1 indicates existing trades, 0 means no trades
        };
      }

      // Step 2: Fetch token data from Jupiter
      console.log(`🔍 Fetching token data from Jupiter...`);
      const tokenData = await this.fetchTokenDataFromJupiter(tokenAddress);

      // Step 3: Ensure wallet exists and get wallet info
      const { walletId } = await tradingHistoryService.ensureWalletExists(userId, walletAddress);
      console.log(`✅ Wallet ensured: ${walletId}`);

      // Step 4: Check if this token has any existing trades in trading_history
      console.log(`🔍 Checking for existing trades in trading_history...`);
      const { data: existingTrades, error: tradesError } = await supabase
        .from('trading_history')
        .select('signature')
        .eq('wallet_id', walletId)
        .eq('token_address', tokenAddress)
        .limit(1);

      if (tradesError) {
        console.error(`❌ Error checking existing trades:`, tradesError);
        throw new Error(`Failed to check existing trades: ${tradesError.message}`);
      }

      const hasExistingTrades = existingTrades && existingTrades.length > 0;
      console.log(`📊 Existing trades found: ${hasExistingTrades ? 'YES' : 'NO'}`);

      let newTradesFound = 0;

      // Step 5: If no existing trades, use tradingHistoryService to discover trades
      if (!hasExistingTrades) {
        console.log(`🔍 Using tradingHistoryService.refreshTradingHistory to discover trades...`);

        try {
          // Temporarily set the wallet as updated long ago to force a full scan
          console.log(`⏰ Temporarily setting wallet last update to force full scan...`);
          
          // Set the last updated timestamp to a very old date to trigger a full scan
          const { error: updateError } = await supabase
            .from('tracked_wallets')
            .update({ 
              updated_at: new Date('2020-01-01').toISOString() // Set to old date to force full scan
            })
            .eq('user_id', userId)
            .eq('wallet_address', walletAddress);

          if (updateError) {
            console.warn(`⚠️ Could not update wallet timestamp:`, updateError);
            // Continue anyway - refreshTradingHistory might still work
          }

          // Use tradingHistoryService to discover and process trades
          const refreshResult = await tradingHistoryService.refreshTradingHistory(userId, walletAddress);
          
          console.log(`✅ Trade discovery completed:`, refreshResult);

          // After trade discovery, check how many trades were found for this specific token
          const { data: newTrades, error: newTradesError } = await supabase
            .from('trading_history')
            .select('signature')
            .eq('wallet_id', walletId)
            .eq('token_address', tokenAddress);

          if (newTradesError) {
            console.error(`❌ Error checking new trades after discovery:`, newTradesError);
          } else {
            newTradesFound = newTrades?.length || 0;
            console.log(`✅ Found ${newTradesFound} trades for token ${tokenAddress}`);
          }

          // Step 6: Star all trades for this token
          if (newTradesFound > 0) {
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
          
          // Check if this is a rate limiting error
          const errorMessage = tradeDiscoveryError instanceof Error ? tradeDiscoveryError.message : String(tradeDiscoveryError);
          const isRateLimitError = errorMessage.includes('408') || 
                                  errorMessage.includes('timeout') || 
                                  errorMessage.includes('rate limit') ||
                                  errorMessage.includes('free tier');
          
          if (isRateLimitError) {
            console.log(`⚠️ Rate limiting detected. Token will be added to watchlist, but trade discovery was skipped.`);
            console.log(`💡 Consider upgrading your DRPC plan for better rate limits.`);
          }
          
          // Don't fail the entire operation if trade discovery fails
          // We'll still add the token to untracked_tokens for future monitoring
          console.log(`⚠️ Trade discovery failed, but continuing to add token for future monitoring`);
        }
      } else {
        console.log(`ℹ️ Token already has trades in trading_history, skipping trade scan`);
      }

      // Step 7: Add/update token record in untracked_tokens table
      console.log(`💾 Adding/updating token record in untracked_tokens...`);
      const tokenRecord: UntrackedTokenRecord = {
        contract_address: tokenAddress,
        symbol: tokenData.symbol,
        wallet_address: walletAddress,
        present_trades: hasExistingTrades || newTradesFound > 0,
        current_price: tokenData.currentPrice,
        total_supply: tokenData.totalSupply,
        token_uri: tokenData.logoURI
      };

      await this.upsertUntrackedToken(tokenRecord);

      // Step 8: Generate appropriate success message
      let message: string;
      const totalTradesFound = hasExistingTrades ? -1 : newTradesFound; // -1 indicates existing trades

      if (hasExistingTrades) {
        message = `Token ${tokenData.symbol} is already being tracked with existing trades!`;
      } else if (newTradesFound > 0) {
        message = `Successfully found and added ${newTradesFound} trades for ${tokenData.symbol}! All trades have been starred for your Trade Log.`;
      } else {
        // Check if we had an error during trade discovery
        const hadTradeDiscoveryError = newTradesFound === 0 && !hasExistingTrades;
        if (hadTradeDiscoveryError) {
          message = `Token ${tokenData.symbol} added to your watchlist! Trade discovery was limited by API rate limits - future trades will be automatically tracked. Consider upgrading your DRPC plan for historical trade scanning.`;
        } else {
          message = `Token ${tokenData.symbol} added to your watchlist! No trades found yet, but future trades will be automatically tracked.`;
        }
      }

      console.log(`🎉 Token addition completed successfully: ${message}`);

      return {
        success: true,
        message,
        tradesFound: totalTradesFound
      };

    } catch (error) {
      console.error('💥 Error in addNewToken:', error);
      return {
        success: false,
        message: 'Failed to add token',
        tradesFound: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export a singleton instance
export const addNewTokenService = new AddNewTokenService(); 
