import { ProcessedTrade } from '../services/tradeProcessor';
import { jupiterApiService } from '../services/jupiterApiService';

export interface TokenData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
  totalBought: number;
  totalSold: number;
  remaining: number;
  totalValue: number;
  currentPrice?: number;
  profitLoss?: number;
  lastTransactionTimestamp: number;
  starred?: boolean;
}

export interface TradeData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
  totalBought: number;
  totalSold: number;
  profitLoss: number;
  duration: string;
  firstBuyTimestamp?: number;
  lastSellTimestamp?: number;
  starred?: boolean;
}

export interface TokenTradeData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
  type: 'BUY' | 'SELL';
  amount: number;
  totalVolume: number;
  profitLoss: number;
  timestamp: number;
  starred?: boolean;
}

// Helper function to calculate duration between timestamps
const calculateDuration = (start: number, end: number): string => {
  if (!start || !end) return 'Unknown';
  
  const durationMs = end - start;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
};

/**
 * Process trades into token holdings for open positions view
 */
export async function processTradesToHoldings(trades: ProcessedTrade[]): Promise<TokenData[]> {
  // Group trades by token
  const tokenMap = new Map<string, {
    tokenSymbol: string,
    tokenLogoURI: string | null,
    buys: { amount: number, timestamp: number, valueUSD: number }[],
    sells: { amount: number, timestamp: number, valueUSD: number }[],
    buyValue: number,
    sellValue: number,
    latestTimestamp: number
  }>();
  
  // Process each trade
  for (const trade of trades) {
    if (!trade.tokenAddress || !trade.amount) continue;
    
    let tokenData = tokenMap.get(trade.tokenAddress);
    if (!tokenData) {
      tokenData = {
        tokenSymbol: trade.tokenSymbol,
        tokenLogoURI: trade.tokenLogoURI,
        buys: [],
        sells: [],
        buyValue: 0,
        sellValue: 0,
        latestTimestamp: 0
      };
      tokenMap.set(trade.tokenAddress, tokenData);
    }
    
    if (trade.timestamp > tokenData.latestTimestamp) {
      tokenData.latestTimestamp = trade.timestamp;
    }
    
    if (trade.type === 'BUY') {
      tokenData.buys.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD || 0
      });
      tokenData.buyValue += trade.valueUSD || 0;
    } else if (trade.type === 'SELL') {
      tokenData.sells.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD || 0
      });
      tokenData.sellValue += trade.valueUSD || 0;
    }
  }
  
  // Calculate remaining tokens and fetch current prices
  const holdings: TokenData[] = [];
  const tokensToFetch: {tokenData: TokenData, tokenAddress: string, timestamp: number}[] = [];
  
  for (const [tokenAddress, data] of tokenMap.entries()) {
    const totalBought = data.buys.reduce((sum, buy) => sum + buy.amount, 0);
    const totalSold = data.sells.reduce((sum, sell) => sum + sell.amount, 0);
    const remaining = totalBought - totalSold;
    
    // Only include tokens with a positive remaining balance
    if (remaining <= 0) continue;
    
    const tokenData: TokenData = {
      tokenAddress,
      tokenSymbol: data.tokenSymbol,
      tokenLogoURI: data.tokenLogoURI || undefined,
      totalBought,
      totalSold,
      remaining,
      totalValue: 0, // Will be calculated after getting price
      lastTransactionTimestamp: data.latestTimestamp
    };
    
    holdings.push(tokenData);
    tokensToFetch.push({
      tokenData, 
      tokenAddress, 
      timestamp: data.latestTimestamp
    });
  }
  
  // Now fetch prices in small batches to avoid rate limiting
  const BATCH_SIZE = 5;
  for (let i = 0; i < tokensToFetch.length; i += BATCH_SIZE) {
    const batch = tokensToFetch.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(({tokenData, tokenAddress}) => {
      return jupiterApiService.getTokenPriceInUSD(tokenAddress)
        .then(price => {
          tokenData.currentPrice = price;
          tokenData.totalValue = tokenData.remaining * price;
          const buyValue = tokenMap.get(tokenAddress)?.buyValue || 0;
          const sellValue = tokenMap.get(tokenAddress)?.sellValue || 0;
          tokenData.profitLoss = tokenData.totalValue - (buyValue - sellValue);
        })
        .catch(err => {
          console.error(`Error fetching current price for ${tokenAddress}:`, err);
          tokenData.currentPrice = 0;
          tokenData.totalValue = 0;
        });
    });
    
    await Promise.all(batchPromises);
    
    if (i + BATCH_SIZE < tokensToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return holdings.sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Process trades for top performers view
 */
export function processTradesForTopPerformers(trades: ProcessedTrade[]): TradeData[] {
  // Group trades by token
  const tokenMap = new Map<string, {
    buys: { amount: number, timestamp: number, valueUSD: number }[],
    sells: { amount: number, timestamp: number, valueUSD: number }[],
    tokenSymbol: string,
    tokenLogoURI: string | null
  }>();
  
  // Process each trade
  for (const trade of trades) {
    if (!trade.tokenAddress || !trade.amount) continue;
    
    let tokenData = tokenMap.get(trade.tokenAddress);
    if (!tokenData) {
      tokenData = {
        buys: [],
        sells: [],
        tokenSymbol: trade.tokenSymbol,
        tokenLogoURI: trade.tokenLogoURI
      };
      tokenMap.set(trade.tokenAddress, tokenData);
    }
    
    if (trade.type === 'BUY') {
      tokenData.buys.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD || 0
      });
    } else if (trade.type === 'SELL') {
      tokenData.sells.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD || 0
      });
    }
  }
  
  // Calculate metrics for each token
  const result: TradeData[] = [];
  
  for (const [tokenAddress, data] of tokenMap.entries()) {
    // Only include tokens that have both buys and sells
    if (data.buys.length === 0 || data.sells.length === 0) continue;
    
    const totalBought = data.buys.reduce((sum, buy) => sum + buy.amount, 0);
    const totalSold = data.sells.reduce((sum, sell) => sum + sell.amount, 0);
    
    // Calculate profit/loss
    const totalBuyValue = data.buys.reduce((sum, buy) => sum + buy.valueUSD, 0);
    const totalSellValue = data.sells.reduce((sum, sell) => sum + sell.valueUSD, 0);
    const profitLoss = totalSellValue - totalBuyValue;
    
    // Find first buy and last sell
    const firstBuy = data.buys.reduce(
      (earliest, buy) => buy.timestamp < earliest.timestamp ? buy : earliest, 
      data.buys[0]
    );
    
    const lastSell = data.sells.reduce(
      (latest, sell) => sell.timestamp > latest.timestamp ? sell : latest, 
      data.sells[0]
    );
    
    // Calculate duration
    const duration = calculateDuration(firstBuy.timestamp, lastSell.timestamp);
    
    result.push({
      tokenAddress,
      tokenSymbol: data.tokenSymbol,
      tokenLogoURI: data.tokenLogoURI || undefined,
      totalBought,
      totalSold,
      profitLoss,
      duration,
      firstBuyTimestamp: firstBuy.timestamp,
      lastSellTimestamp: lastSell.timestamp
    });
  }
  
  // Sort by profit (highest first)
  return result.sort((a, b) => b.profitLoss - a.profitLoss);
}

/**
 * Process trades for the trade log view - returns individual trade entries
 */
export function processTradesForLog(trades: ProcessedTrade[]): TokenTradeData[] {
  const result: TokenTradeData[] = [];
  
  for (const trade of trades) {
    if (!trade.tokenAddress || !trade.amount || !trade.type) continue;
    
    result.push({
      tokenAddress: trade.tokenAddress,
      tokenSymbol: trade.tokenSymbol,
      tokenLogoURI: trade.tokenLogoURI || undefined,
      type: trade.type as 'BUY' | 'SELL',
      amount: trade.amount,
      totalVolume: trade.valueUSD || 0,
      profitLoss: 0, // Individual trades don't have P/L, this would be calculated across all trades for a token
      timestamp: trade.timestamp,
      starred: trade.starred || false
    });
  }
  
  // Sort by timestamp (newest first)
  return result.sort((a, b) => b.timestamp - a.timestamp);
} 