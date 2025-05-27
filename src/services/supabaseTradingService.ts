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
      // Fetch all trades for the wallet
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId);

      if (error) {
        console.error('Error fetching trades:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group trades by token
      const tokenMap = new Map<string, TokenHolding>();

      for (const trade of data) {
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

      // Calculate net positions and filter for open positions
      const openPositions: TokenHolding[] = [];

      // Process each token holding
      for (const holding of tokenMap.values()) {
        holding.netPosition = holding.totalBought - holding.totalSold;

        // Only include if there's a remaining position (threshold for dust)
        if (Math.abs(holding.netPosition) > 0.001) {
          // Get the most recent trade for this token to get the historical price
          const mostRecentTrade = data
            .filter(trade => trade.token_address === holding.tokenAddress)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

          // Get the historical price from the most recent trade
          const historicalPriceUSD = mostRecentTrade?.price_usd || 0;

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

          openPositions.push(holding);
        }
      }

      return openPositions.sort((a, b) => b.totalValue - a.totalValue);
    } catch (error) {
      console.error('Error in getOpenTrades:', error);
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
      // Fetch all trades for the wallet
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId);

      if (error) {
        console.error('Error fetching trades:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group trades by token
      const tokenPerformance = new Map<string, TopTradeData>();

      for (const trade of data) {
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

      // Calculate durations and filter completed trades
      const completedTrades: TopTradeData[] = [];

      for (const [tokenAddress, performance] of tokenPerformance.entries()) {
        // Only include if both bought and sold (completed trade)
        if (performance.totalBought > 0 && performance.totalSold > 0) {
          // Calculate duration
          const tokenTrades = data
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
          }

          completedTrades.push(performance);
        }
      }

      return completedTrades.sort((a, b) => b.profitLoss - a.profitLoss);
    } catch (error) {
      console.error('Error in getTopTrades:', error);
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
      // Fetch all trades for the wallet
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId);

      if (error) {
        console.error('Error fetching trades:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Convert to TradeLogEntry objects
      const logEntries: TradeLogEntry[] = data.map(trade => ({
        signature: trade.signature,
        tokenAddress: trade.token_address,
        tokenSymbol: trade.token_symbol,
        tokenName: trade.token_symbol, // Use symbol as name if not available
        tokenLogoURI: trade.token_logo_uri,
        type: trade.type as 'BUY' | 'SELL',
        amount: Math.abs(trade.amount),
        totalVolume: trade.value_usd || 0,
        profitLoss: trade.type === 'BUY' ? -(trade.value_usd || 0) : (trade.value_usd || 0),
        timestamp: new Date(trade.timestamp).getTime(),
        starred: trade.starred
      }));

      return logEntries.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error in getTradeLog:', error);
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
      // Fetch all trades for the wallet
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId);

      if (error) {
        console.error('Error fetching trades:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Convert to ProcessedTrade objects
      const processedTrades: ProcessedTrade[] = data.map(trade => ({
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

      return processedTrades.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error in getTradingHistory:', error);
      throw error;
    }
  }

  /**
   * Toggle the starred status of a trade
   * @param walletId The wallet ID
   * @param signature The trade signature
   * @param starred The new starred status
   */
  async toggleStarredTrade(walletId: string, signature: string, starred: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('trading_history')
        .update({ starred })
        .eq('wallet_id', walletId)
        .eq('signature', signature);

      if (error) {
        console.error('Error toggling starred trade:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in toggleStarredTrade:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const supabaseTradingService = new SupabaseTradingService();
