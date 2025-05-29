import { supabase } from '../utils/supabaseClient';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { jupiterApiService } from './jupiterApiService';

// Define the types for the processed data
export interface TokenHolding {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  tokenLogoURI?: string;
  totalBought: number;
  totalSold: number;
  netPosition: number;
  totalValue: number;
  profitLoss: number;
  starred: boolean;
}

export interface TopTradeData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  tokenLogoURI?: string;
  totalBought: number;
  totalSold: number;
  profitLoss: number;
  duration: string;
  starred: boolean;
}

export interface TradeLogEntry {
  signature: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  tokenLogoURI?: string;
  type: 'BUY' | 'SELL';
  amount: number;
  totalVolume: number;
  profitLoss: number;
  timestamp: number;
  starred: boolean;
  remainingBalance: number;
  estimatedValue: number;
}

export interface ProcessedTrade {
  signature: string;
  timestamp: number;
  type: 'BUY' | 'SELL';
  tokenSymbol: string;
  tokenAddress: string;
  tokenLogoURI?: string;
  decimals: number;
  amount: number;
  priceUSD: number;
  priceSOL: number;
  valueUSD: number;
  valueSOL: number;
  profitLoss: number;
  blockTime: number;
  starred: boolean;
}

class SupabaseTradingService {
  // Cache for token prices to avoid multiple API calls for the same token
  private tokenPriceCache: Map<string, { price: number, timestamp: number }> = new Map();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Deduplicate trades based on signature
   * @param trades The trades to deduplicate
   * @returns An array of unique trades
   */
  private deduplicateTrades(trades: any[]): any[] {
    console.log('🔄 Starting deduplication process...');

    // First, let's see what the signature field looks like
    const sampleTrade = trades[0];
    if (sampleTrade) {
      console.log('🔍 Sample trade signature field:', sampleTrade.signature);
      console.log('🔍 Sample trade keys:', Object.keys(sampleTrade));
    }

    // Use a Map to keep only the first occurrence of each signature
    const uniqueTradesMap = new Map();
    let tradesWithSignature = 0;
    let tradesWithoutSignature = 0;

    for (const trade of trades) {
      // Check if signature exists and is not null/empty
      if (trade.signature && trade.signature !== null && trade.signature !== '') {
        tradesWithSignature++;
        if (!uniqueTradesMap.has(trade.signature)) {
          uniqueTradesMap.set(trade.signature, trade);
        }
      } else {
        tradesWithoutSignature++;
        // For trades without signature, create a unique key using other fields
        const uniqueKey = `${trade.token_address}_${trade.timestamp}_${trade.type}_${trade.amount}_${trade.value_usd}`;
        if (!uniqueTradesMap.has(uniqueKey)) {
          uniqueTradesMap.set(uniqueKey, trade);
        }
      }
    }

    console.log('📊 Deduplication stats:');
    console.log('  - Trades with signature:', tradesWithSignature);
    console.log('  - Trades without signature:', tradesWithoutSignature);
    console.log('  - Unique trades after deduplication:', uniqueTradesMap.size);

    return Array.from(uniqueTradesMap.values());
  }

  /**
   * Get the current price of a token, using cache if available
   * @param tokenAddress The token address
   * @returns The token price in USD
   */
  private async getCurrentTokenPrice(tokenAddress: string): Promise<number> {
    try {
      // Check if we have a cached price that's still valid
      const cached = this.tokenPriceCache.get(tokenAddress);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        return cached.price;
      }

      // Fetch the current price from Jupiter API
      const price = await jupiterApiService.getTokenPriceInUSD(tokenAddress);

      // Cache the price
      this.tokenPriceCache.set(tokenAddress, {
        price,
        timestamp: Date.now()
      });

      return price;
    } catch (error) {
      console.error(`Error fetching current price for token ${tokenAddress}:`, error);
      return 0; // Return 0 if we can't get the price
    }
  }
  /**
   * Get open trades from Supabase
   * @param walletId The wallet ID
   * @returns An array of TokenHolding objects
   */
  async getOpenTrades(walletId: string): Promise<TokenHolding[]> {
    try {
      console.log('🔍 getOpenTrades - Fetching trades for wallet:', walletId);

      // Fetch all trades for the wallet
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId);

      if (error) {
        console.error('❌ Error fetching trades:', error);
        throw error;
      }

      console.log('📊 Raw data fetched:', data?.length || 0, 'records');

      if (!data || data.length === 0) {
        console.log('⚠️ No data found for wallet');
        return [];
      }

      // Deduplicate trades based on signature
      const uniqueTrades = this.deduplicateTrades(data);
      console.log('🔄 After deduplication:', uniqueTrades.length, 'unique trades');

      // Group trades by token
      const tokenMap = new Map<string, TokenHolding>();

      for (const trade of uniqueTrades) {
        const key = trade.token_address;

        if (!tokenMap.has(key)) {
          tokenMap.set(key, {
            tokenAddress: trade.token_address,
            tokenSymbol: trade.token_symbol,
            tokenName: trade.token_symbol, // Use symbol as name if not available
            tokenLogoURI: trade.token_logo_uri,
            totalBought: 0,
            totalSold: 0,
            netPosition: 0,
            totalValue: 0,
            profitLoss: 0,
            starred: trade.starred
          });
        }

        const holding = tokenMap.get(key)!;

        // Update starred status if any trade for this token is starred
        if (trade.starred) {
          holding.starred = true;
        }

        if (trade.type === 'BUY') {
          holding.totalBought += Math.abs(trade.amount);
          holding.profitLoss -= trade.value_usd || 0; // Cost
        } else {
          holding.totalSold += Math.abs(trade.amount);
          holding.profitLoss += trade.value_usd || 0; // Revenue
        }
      }

      console.log('📋 Grouped by token:', tokenMap.size, 'unique tokens');

      // Calculate net positions and filter for open positions
      const openPositions: TokenHolding[] = [];

      // Process each token holding
      for (const holding of tokenMap.values()) {
        holding.netPosition = holding.totalBought - holding.totalSold;

        console.log(`💰 ${holding.tokenSymbol}: bought=${holding.totalBought}, sold=${holding.totalSold}, net=${holding.netPosition}`);

        // Reduce threshold to 0.000001 to include more positions and add value threshold
        if (Math.abs(holding.netPosition) > 0.000001) {
          // Get the most recent trade for this token to get the historical price
          const mostRecentTrade = uniqueTrades
            .filter(trade => trade.token_address === holding.tokenAddress)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

          // Get the historical price from the most recent trade
          const historicalPriceUSD = mostRecentTrade?.price_usd || 0;

          try {
            // Get the current price from Jupiter API
            const currentPriceUSD = await this.getCurrentTokenPrice(holding.tokenAddress);

            // Calculate the current value of the position
            const currentValue = Math.abs(holding.netPosition) * currentPriceUSD;
            holding.totalValue = currentValue;

            // Calculate the unrealized P/L
            // This is (current value - cost basis)
            // Cost basis is (totalBought * historicalPriceUSD - totalSold * historicalPriceUSD)
            const costBasis = (holding.totalBought - holding.totalSold) * historicalPriceUSD;
            const unrealizedPL = currentValue - costBasis;

            // Add the unrealized P/L to the existing P/L
            holding.profitLoss = unrealizedPL;

            console.log(`💎 ${holding.tokenSymbol}: currentPrice=$${currentPriceUSD}, value=$${currentValue}, P/L=$${unrealizedPL}`);

            // Only filter out if value is less than $0.01 (1 cent)
            if (currentValue >= 0.01) {
              openPositions.push(holding);
            } else {
              console.log(`🚫 Filtered out ${holding.tokenSymbol} - value too low: $${currentValue}`);
            }
          } catch (priceError) {
            console.error(`❌ Error getting price for ${holding.tokenSymbol}:`, priceError);
            // Still add the position even if we can't get the price
            holding.totalValue = 0;
            holding.profitLoss = holding.profitLoss; // Keep the realized P/L
            openPositions.push(holding);
          }
        } else {
          console.log(`🚫 Filtered out ${holding.tokenSymbol} - net position too small: ${holding.netPosition}`);
        }
      }

      console.log('✅ Final open positions:', openPositions.length);
      return openPositions.sort((a, b) => b.totalValue - a.totalValue);
    } catch (error) {
      console.error('❌ Error in getOpenTrades:', error);
      throw error;
    }
  }

  /**
   * Get top trades from Supabase
   * @param walletId The wallet ID
   * @returns An array of TopTradeData objects
   */
  async getTopTrades(walletId: string): Promise<TopTradeData[]> {
    try {
      console.log('🔍 getTopTrades - Fetching trades for wallet:', walletId);

      // Fetch all trades for the wallet
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId);

      if (error) {
        console.error('❌ Error fetching trades:', error);
        throw error;
      }

      console.log('📊 Raw data fetched:', data?.length || 0, 'records');

      if (!data || data.length === 0) {
        console.log('⚠️ No data found for wallet');
        return [];
      }

      // Deduplicate trades based on signature
      const uniqueTrades = this.deduplicateTrades(data);
      console.log('🔄 After deduplication:', uniqueTrades.length, 'unique trades');

      // Group trades by token
      const tokenPerformance = new Map<string, TopTradeData>();

      for (const trade of uniqueTrades) {
        const key = trade.token_address;

        if (!tokenPerformance.has(key)) {
          tokenPerformance.set(key, {
            tokenAddress: trade.token_address,
            tokenSymbol: trade.token_symbol,
            tokenName: trade.token_symbol, // Use symbol as name if not available
            tokenLogoURI: trade.token_logo_uri,
            totalBought: 0,
            totalSold: 0,
            profitLoss: 0,
            duration: '0m',
            starred: trade.starred
          });
        }

        const performance = tokenPerformance.get(key)!;

        // Update starred status if any trade for this token is starred
        if (trade.starred) {
          performance.starred = true;
        }

        if (trade.type === 'BUY') {
          performance.totalBought += Math.abs(trade.amount);
          performance.profitLoss -= trade.value_usd || 0;
        } else {
          performance.totalSold += Math.abs(trade.amount);
          performance.profitLoss += trade.value_usd || 0;
        }
      }

      console.log('📋 Grouped by token:', tokenPerformance.size, 'unique tokens');

      // Calculate durations and filter completed trades
      const completedTrades: TopTradeData[] = [];

      for (const [tokenAddress, performance] of tokenPerformance.entries()) {
        console.log(`💰 ${performance.tokenSymbol}: bought=${performance.totalBought}, sold=${performance.totalSold}, P/L=$${performance.profitLoss}`);

        // Include trades where user has at least partially sold OR if the trade is profitable
        // This makes it more lenient than requiring both bought and sold
        if (performance.totalBought > 0 && (performance.totalSold > 0 || Math.abs(performance.profitLoss) > 0.01)) {
          // Calculate duration
          const tokenTrades = uniqueTrades
            .filter(trade => trade.token_address === tokenAddress)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          if (tokenTrades.length >= 2) {
            const firstTrade = tokenTrades[0];
            const lastTrade = tokenTrades[tokenTrades.length - 1];
            const durationMs = new Date(lastTrade.timestamp).getTime() - new Date(firstTrade.timestamp).getTime();

            const minutes = Math.floor(durationMs / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) performance.duration = `${days}d`;
            else if (hours > 0) performance.duration = `${hours}h`;
            else performance.duration = `${minutes}m`;
          } else {
            performance.duration = '1m'; // Default for single trades
          }

          console.log(`✅ Including ${performance.tokenSymbol} in top trades`);
          completedTrades.push(performance);
        } else {
          console.log(`🚫 Filtered out ${performance.tokenSymbol} - not enough trading activity`);
        }
      }

      console.log('✅ Final top trades:', completedTrades.length);
      return completedTrades.sort((a, b) => b.profitLoss - a.profitLoss);
    } catch (error) {
      console.error('❌ Error in getTopTrades:', error);
      throw error;
    }
  }

  /**
   * Get trade log from Supabase
   * @param walletId The wallet ID
   * @returns An array of TradeLogEntry objects
   */
  async getTradeLog(walletId: string): Promise<TradeLogEntry[]> {
    try {
      console.log('🔍 getTradeLog - Fetching trades for wallet:', walletId);

      // Fetch all trades for the wallet
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId);

      if (error) {
        console.error('❌ Error fetching trades:', error);
        throw error;
      }

      console.log('📊 Raw data fetched:', data?.length || 0, 'records');

      if (!data || data.length === 0) {
        console.log('⚠️ No data found for wallet');
        return [];
      }

      // Deduplicate trades based on signature
      const uniqueTrades = this.deduplicateTrades(data);
      console.log('🔄 After deduplication:', uniqueTrades.length, 'unique trades');

      // Group trades by token address
      const tradesByToken = new Map<string, any[]>();
      for (const trade of uniqueTrades) {
        const tokenAddress = trade.token_address;
        if (!tradesByToken.has(tokenAddress)) {
          tradesByToken.set(tokenAddress, []);
        }
        tradesByToken.get(tokenAddress)!.push(trade);
      }

      // Process each token's trades to calculate remaining balance
      const logEntries: TradeLogEntry[] = [];

      for (const [tokenAddress, tokenTrades] of tradesByToken.entries()) {
        // Sort trades by timestamp (oldest first)
        tokenTrades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Calculate cumulative balance
        let cumulativeBalance = 0;

        // Get current token price for estimated value calculation
        const currentPrice = await this.getCurrentTokenPrice(tokenAddress);

        // Process each trade
        for (const trade of tokenTrades) {
          const amount = Math.abs(trade.amount);
          const type = trade.type as 'BUY' | 'SELL';

          // Update cumulative balance
          if (type === 'BUY') {
            cumulativeBalance += amount;
          } else if (type === 'SELL') {
            // Ensure we don't sell more than we've bought
            if (amount > cumulativeBalance) {
              console.warn(`⚠️ Warning: Attempted to sell more than available balance for ${trade.token_symbol} (${tokenAddress})`);
              console.warn(`   Sell amount: ${amount}, Available balance: ${cumulativeBalance}`);
              // Adjust the sell amount to the available balance
              trade.amount = cumulativeBalance;
            }
            cumulativeBalance -= Math.min(amount, cumulativeBalance);
          }

          // Calculate estimated value
          const estimatedValue = cumulativeBalance * currentPrice;

          // Create TradeLogEntry
          logEntries.push({
            signature: trade.signature,
            tokenAddress: trade.token_address,
            tokenSymbol: trade.token_symbol,
            tokenName: trade.token_symbol, // Use symbol as name if not available
            tokenLogoURI: trade.token_logo_uri,
            type: type,
            amount: Math.abs(trade.amount),
            totalVolume: trade.value_usd || 0,
            profitLoss: type === 'BUY' ? -(trade.value_usd || 0) : (trade.value_usd || 0),
            timestamp: new Date(trade.timestamp).getTime(),
            starred: trade.starred,
            remainingBalance: cumulativeBalance,
            estimatedValue: estimatedValue
          });
        }
      }

      console.log('✅ Final trade log entries:', logEntries.length);
      return logEntries.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('❌ Error in getTradeLog:', error);
      throw error;
    }
  }

  /**
   * Get trading history from Supabase
   * @param walletId The wallet ID
   * @returns An array of ProcessedTrade objects
   */
  async getTradingHistory(walletId: string): Promise<ProcessedTrade[]> {
    try {
      console.log('🔍 getTradingHistory - Fetching trades for wallet:', walletId);

      // Fetch all trades for the wallet
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId);

      if (error) {
        console.error('❌ Error fetching trades:', error);
        throw error;
      }

      console.log('📊 Raw data fetched:', data?.length || 0, 'records');

      if (!data || data.length === 0) {
        console.log('⚠️ No data found for wallet');
        return [];
      }

      // Deduplicate trades based on signature
      const uniqueTrades = this.deduplicateTrades(data);
      console.log('🔄 After deduplication:', uniqueTrades.length, 'unique trades');

      // Convert to ProcessedTrade objects
      const processedTrades: ProcessedTrade[] = uniqueTrades.map(trade => ({
        signature: trade.signature,
        timestamp: new Date(trade.timestamp).getTime(),
        type: trade.type as 'BUY' | 'SELL',
        tokenSymbol: trade.token_symbol,
        tokenAddress: trade.token_address,
        tokenLogoURI: trade.token_logo_uri,
        decimals: trade.decimals || 9,
        amount: Math.abs(trade.amount),
        priceUSD: trade.price_usd || 0,
        priceSOL: trade.price_sol || 0,
        valueUSD: trade.value_usd || 0,
        valueSOL: trade.value_sol || 0,
        profitLoss: trade.type === 'BUY' ? -(trade.value_usd || 0) : (trade.value_usd || 0),
        blockTime: trade.block_time || Math.floor(new Date(trade.timestamp).getTime() / 1000),
        starred: trade.starred
      }));

      console.log('✅ Final processed trades:', processedTrades.length);
      return processedTrades.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('❌ Error in getTradingHistory:', error);
      throw error;
    }
  }

  /**
   * Toggle the starred status of a trade
   * @param walletId The wallet ID
   * @param signature The trade signature
   * @param starred The new starred status
   * @param tokenAddress Optional token address to filter by
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
        console.error('Error toggling starred trade:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in toggleStarredTrade:', error);
      throw error;
    }
  }

  /**
   * Test method to verify database connection and data structure
   * @param walletId The wallet ID to test
   */
  async testDatabaseConnection(walletId: string): Promise<void> {
    try {
      console.log('🧪 Testing database connection for wallet:', walletId);

      const { data, error, count } = await supabase
        .from('trading_history')
        .select('*', { count: 'exact' })
        .eq('wallet_id', walletId)
        .limit(5);

      if (error) {
        console.error('❌ Database connection error:', error);
        throw error;
      }

      console.log('✅ Database connection successful');
      console.log('📊 Total records:', count);
      console.log('📋 Sample data (first 5 records):', data);

      if (data && data.length > 0) {
        const sampleRecord = data[0];
        console.log('🔍 Sample record structure:', Object.keys(sampleRecord));
        console.log('🔍 Sample record values:', sampleRecord);
      }
    } catch (error) {
      console.error('❌ Database test failed:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const supabaseTradingService = new SupabaseTradingService();
