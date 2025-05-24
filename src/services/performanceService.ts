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
   * Get performance data for the last 24 hours for a specific wallet
   */
  static async getPerformanceData(userId: string, walletId: string): Promise<PerformanceData> {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // Get trades from the last 24 hours for the specified wallet
      const { data: trades, error: tradesError } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', walletId)
        .gte('timestamp', twentyFourHoursAgo.toISOString())
        .order('timestamp', { ascending: true });

      if (tradesError) {
        console.error('Error fetching trades:', tradesError);
        throw tradesError;
      }

      if (!trades || trades.length === 0) {
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
          return sum + (parseFloat(trade.profit_loss?.toString() || '0'));
        }, 0);
        
        cumulativePnL += hourPnL;
        
        dataPoints.push({
          timestamp: hourKey * 1000 * 60 * 60, // Convert back to milliseconds
          cumulativePnL,
          value: Math.abs(hourPnL) // For visualization purposes
        });
      });

      // Calculate metrics
      const profitLosses = trades.map(t => parseFloat(t.profit_loss?.toString() || '0'));
      const volumes = trades.map(t => parseFloat(t.value_usd?.toString() || '0'));
      
      const totalPnL = profitLosses.reduce((sum, pnl) => sum + pnl, 0);
      const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
      const winningTrades = profitLosses.filter(pnl => pnl > 0);
      const bestTrade = profitLosses.length > 0 ? Math.max(...profitLosses) : 0;
      const worstTrade = profitLosses.length > 0 ? Math.min(...profitLosses) : 0;
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

  /**
   * Generate sample data points for demonstration when no real data is available
   */
  static generateSampleData(): PerformanceData {
    const now = Date.now();
    const dataPoints: PerformanceDataPoint[] = [];
    let cumulativePnL = 0;

    // Generate 24 data points (one per hour)
    for (let i = 23; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000);
      const change = (Math.random() - 0.4) * 100; // Slightly biased toward positive
      cumulativePnL += change;
      
      dataPoints.push({
        timestamp,
        cumulativePnL,
        value: Math.abs(change)
      });
    }

    return {
      dataPoints,
      metrics: {
        totalPnL: cumulativePnL,
        totalTrades: 15,
        tokensTraded: 8,
        winRate: 66.7,
        bestTrade: 125.50,
        worstTrade: -45.20,
        totalVolume: 2847.32,
        averageTradeSize: 189.82
      }
    };
  }
} 