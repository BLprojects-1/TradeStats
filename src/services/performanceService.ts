import { supabase } from '../utils/supabaseClient';

export interface PerformanceDataPoint {
  timestamp: number;
  cumulativePnL: number;
  value: number;
}

export interface PerformanceMetrics {
  totalPnL: number;
  totalTrades: number;
  tokensTraded: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  totalVolume: number;
  averageTradeSize: number;
}

export interface PerformanceData {
  dataPoints: PerformanceDataPoint[];
  metrics: PerformanceMetrics;
}

export class PerformanceService {
  /**
   * Deduplicate trades based on signature
   * @param trades The trades to deduplicate
   * @returns An array of unique trades
   */
  private static deduplicateTrades(trades: any[]): any[] {
    console.log('🔄 Starting deduplication process for performance metrics...');

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

    console.log('📊 Performance deduplication stats:');
    console.log('  - Original trades count:', trades.length);
    console.log('  - Trades with signature:', tradesWithSignature);
    console.log('  - Trades without signature:', tradesWithoutSignature);
    console.log('  - Unique trades after deduplication:', uniqueTradesMap.size);

    return Array.from(uniqueTradesMap.values());
  }

  /**
   * Get performance data for the last 24 hours for a specific wallet
   */
  static async getPerformanceData(userId: string, walletId: string): Promise<PerformanceData> {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // Get trades from the last 24 hours for the specified wallet
      const { data: rawTrades, error: tradesError } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId)
        .gte('timestamp', twentyFourHoursAgo.toISOString())
        .order('timestamp', { ascending: true });

      if (tradesError) {
        console.error('Error fetching trades:', tradesError);
        throw tradesError;
      }

      if (!rawTrades || rawTrades.length === 0) {
        return {
          dataPoints: [],
          metrics: {
            totalPnL: 0,
            totalTrades: 0,
            tokensTraded: 0,
            winRate: 0,
            bestTrade: 0,
            worstTrade: 0,
            totalVolume: 0,
            averageTradeSize: 0
          }
        };
      }

      // Deduplicate trades to ensure we don't count the same trade multiple times
      const trades = this.deduplicateTrades(rawTrades);

      // Calculate performance data points
      const dataPoints: PerformanceDataPoint[] = [];
      let cumulativePnL = 0;

      // Group trades by hour to create smoother data points
      const tradesByHour = new Map<number, typeof trades>();

      trades.forEach(trade => {
        const tradeTime = new Date(trade.timestamp);
        const hourKey = Math.floor(tradeTime.getTime() / (1000 * 60 * 60)); // Round to hour

        if (!tradesByHour.has(hourKey)) {
          tradesByHour.set(hourKey, []);
        }
        tradesByHour.get(hourKey)!.push(trade);
      });

      // Convert to data points
      const sortedHours = Array.from(tradesByHour.keys()).sort();

      sortedHours.forEach(hourKey => {
        const hourTrades = tradesByHour.get(hourKey)!;
        const hourPnL = hourTrades.reduce((sum, trade) => {
          const type = trade.type?.toString().toUpperCase();
          const valueUSD = parseFloat(trade.value_usd?.toString() || '0');
          // For BUY trades, profit/loss is negative (money spent)
          // For SELL trades, profit/loss is positive (money received)
          const tradePnL = type === 'SELL' ? valueUSD : -valueUSD;
          return sum + tradePnL;
        }, 0);

        cumulativePnL += hourPnL;

        dataPoints.push({
          timestamp: hourKey * 1000 * 60 * 60, // Convert back to milliseconds
          cumulativePnL,
          value: Math.abs(hourPnL) // For visualization purposes
        });
      });

      // Calculate metrics
      // Calculate profit/loss for each trade based on type, amount, and price
      const tradesPnL = trades.map(t => {
        const type = t.type?.toString().toUpperCase();
        const amount = parseFloat(t.amount?.toString() || '0');
        const valueUSD = parseFloat(t.value_usd?.toString() || '0');

        // For BUY trades, profit/loss is negative (money spent)
        // For SELL trades, profit/loss is positive (money received)
        return type === 'SELL' ? valueUSD : -valueUSD;
      });

      const volumes = trades.map(t => parseFloat(t.value_usd?.toString() || '0'));

      const totalPnL = tradesPnL.reduce((sum, pnl) => sum + pnl, 0);
      const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
      const winningTrades = tradesPnL.filter(pnl => pnl > 0);
      const bestTrade = tradesPnL.length > 0 ? Math.max(...tradesPnL) : 0;
      const worstTrade = tradesPnL.length > 0 ? Math.min(...tradesPnL) : 0;
      const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
      const averageTradeSize = trades.length > 0 ? totalVolume / trades.length : 0;

      // Calculate unique tokens traded
      const uniqueTokens = new Set(trades.map(trade => trade.token_address)).size;

      return {
        dataPoints,
        metrics: {
          totalPnL,
          totalTrades: trades.length,
          tokensTraded: uniqueTokens,
          winRate,
          bestTrade,
          worstTrade,
          totalVolume,
          averageTradeSize
        }
      };
    } catch (error) {
      console.error('Error in getPerformanceData:', error);
      throw error;
    }
  }
} 
