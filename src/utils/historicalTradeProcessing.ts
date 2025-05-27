/**
 * Utility functions to process historical trading data for different dashboard pages
 */

interface TradeData {
  signature: string;
  timestamp: number;
  type: 'BUY' | 'SELL';
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI: string | null;
  tokenChange: number;
  solAmount: number;
  usdValue: number;
  fee: number;
  allTokenChanges?: Array<{
    mint: string;
    change: number;
  }>;
}

interface AnalysisResult {
  recentTrades: TradeData[];
  historicalTrades: Map<string, TradeData[]>;
  totalTrades: number;
  totalVolume: number;
  uniqueTokens: Set<string>;
}

// Types for different page requirements
export interface TokenHolding {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI: string | null;
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
  tokenName: string;
  tokenLogoURI: string | null;
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
  tokenName: string;
  tokenLogoURI: string | null;
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
  tokenLogoURI: string | null;
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

/**
 * Process trades into open positions/holdings
 */
export function processToOpenTrades(analysisResult: AnalysisResult): TokenHolding[] {
  const holdings = new Map<string, TokenHolding>();

  // Combine recent and historical trades
  const allTrades: TradeData[] = [
    ...analysisResult.recentTrades,
    ...Array.from(analysisResult.historicalTrades.values()).flat()
  ];

  // Group by token
  for (const trade of allTrades) {
    const key = trade.tokenMint;
    
    if (!holdings.has(key)) {
      holdings.set(key, {
        tokenAddress: trade.tokenMint,
        tokenSymbol: trade.tokenSymbol,
        tokenName: trade.tokenName,
        tokenLogoURI: trade.tokenLogoURI,
        totalBought: 0,
        totalSold: 0,
        netPosition: 0,
        totalValue: 0,
        profitLoss: 0,
        starred: false
      });
    }

    const holding = holdings.get(key)!;
    
    if (trade.type === 'BUY') {
      holding.totalBought += Math.abs(trade.tokenChange);
      holding.profitLoss -= trade.usdValue; // Cost
    } else {
      holding.totalSold += Math.abs(trade.tokenChange);
      holding.profitLoss += trade.usdValue; // Revenue
    }
  }

  // Calculate net positions and filter for open positions
  const openPositions: TokenHolding[] = [];
  
  for (const holding of holdings.values()) {
    holding.netPosition = holding.totalBought - holding.totalSold;
    
    // Only include if there's a remaining position (threshold for dust)
    if (Math.abs(holding.netPosition) > 0.001) {
      // Estimate current value (simplified - could be enhanced with current prices)
      holding.totalValue = Math.abs(holding.netPosition) * 0.01; // Placeholder
      openPositions.push(holding);
    }
  }

  return openPositions.sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Process trades into top performing trades
 */
export function processToTopTrades(analysisResult: AnalysisResult): TopTradeData[] {
  const tokenPerformance = new Map<string, TopTradeData>();

  // Combine recent and historical trades
  const allTrades: TradeData[] = [
    ...analysisResult.recentTrades,
    ...Array.from(analysisResult.historicalTrades.values()).flat()
  ];

  // Group by token and calculate performance
  for (const trade of allTrades) {
    const key = trade.tokenMint;
    
    if (!tokenPerformance.has(key)) {
      tokenPerformance.set(key, {
        tokenAddress: trade.tokenMint,
        tokenSymbol: trade.tokenSymbol,
        tokenName: trade.tokenName,
        tokenLogoURI: trade.tokenLogoURI,
        totalBought: 0,
        totalSold: 0,
        profitLoss: 0,
        duration: '0m',
        starred: false
      });
    }

    const performance = tokenPerformance.get(key)!;
    
    if (trade.type === 'BUY') {
      performance.totalBought += Math.abs(trade.tokenChange);
      performance.profitLoss -= trade.usdValue;
    } else {
      performance.totalSold += Math.abs(trade.tokenChange);
      performance.profitLoss += trade.usdValue;
    }
  }

  // Calculate durations and filter completed trades
  const completedTrades: TopTradeData[] = [];
  
  for (const performance of tokenPerformance.values()) {
    // Only include if both bought and sold (completed trade)
    if (performance.totalBought > 0 && performance.totalSold > 0) {
      // Calculate approximate duration (simplified)
      performance.duration = calculateTradeDuration(performance.tokenAddress, allTrades);
      completedTrades.push(performance);
    }
  }

  return completedTrades.sort((a, b) => b.profitLoss - a.profitLoss);
}

/**
 * Process trades into trade log entries
 */
export function processToTradeLog(analysisResult: AnalysisResult): TradeLogEntry[] {
  const logEntries: TradeLogEntry[] = [];

  // Combine recent and historical trades
  const allTrades: TradeData[] = [
    ...analysisResult.recentTrades,
    ...Array.from(analysisResult.historicalTrades.values()).flat()
  ];

  for (const trade of allTrades) {
    logEntries.push({
      signature: trade.signature,
      tokenAddress: trade.tokenMint,
      tokenSymbol: trade.tokenSymbol,
      tokenName: trade.tokenName,
      tokenLogoURI: trade.tokenLogoURI,
      type: trade.type,
      amount: Math.abs(trade.tokenChange),
      totalVolume: trade.usdValue,
      profitLoss: trade.type === 'BUY' ? -trade.usdValue : trade.usdValue,
      timestamp: trade.timestamp,
      starred: false
    });
  }

  return logEntries.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Process trades into trading history format (compatible with existing interface)
 */
export function processToTradingHistory(analysisResult: AnalysisResult): ProcessedTrade[] {
  const processedTrades: ProcessedTrade[] = [];

  // Combine recent and historical trades
  const allTrades: TradeData[] = [
    ...analysisResult.recentTrades,
    ...Array.from(analysisResult.historicalTrades.values()).flat()
  ];

  for (const trade of allTrades) {
    const tokenAmount = Math.abs(trade.tokenChange);
    const priceUSD = tokenAmount > 0 ? trade.usdValue / tokenAmount : 0;
    const priceSOL = tokenAmount > 0 ? trade.solAmount / tokenAmount : 0;

    processedTrades.push({
      signature: trade.signature,
      timestamp: trade.timestamp,
      type: trade.type,
      tokenSymbol: trade.tokenSymbol,
      tokenAddress: trade.tokenMint,
      tokenLogoURI: trade.tokenLogoURI,
      decimals: 9, // Default decimals
      amount: tokenAmount,
      priceUSD,
      priceSOL,
      valueUSD: trade.usdValue,
      valueSOL: trade.solAmount,
      profitLoss: trade.type === 'BUY' ? -trade.usdValue : trade.usdValue,
      blockTime: Math.floor(trade.timestamp / 1000),
      starred: false
    });
  }

  return processedTrades.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Helper function to calculate trade duration
 */
function calculateTradeDuration(tokenAddress: string, trades: TradeData[]): string {
  const tokenTrades = trades
    .filter(t => t.tokenMint === tokenAddress)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (tokenTrades.length < 2) return '0m';

  const firstTrade = tokenTrades[0];
  const lastTrade = tokenTrades[tokenTrades.length - 1];
  const durationMs = lastTrade.timestamp - firstTrade.timestamp;
  
  const minutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/**
 * Get all trades for a specific token (for modals)
 */
export function getTokenTrades(analysisResult: AnalysisResult, tokenAddress: string): TradeData[] {
  const allTrades: TradeData[] = [
    ...analysisResult.recentTrades,
    ...Array.from(analysisResult.historicalTrades.values()).flat()
  ];

  return allTrades
    .filter(trade => trade.tokenMint === tokenAddress)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Calculate portfolio summary statistics
 */
export function calculatePortfolioSummary(analysisResult: AnalysisResult) {
  const allTrades: TradeData[] = [
    ...analysisResult.recentTrades,
    ...Array.from(analysisResult.historicalTrades.values()).flat()
  ];

  const totalVolume = allTrades.reduce((sum, trade) => sum + trade.usdValue, 0);
  const totalPnL = allTrades.reduce((sum, trade) => {
    return sum + (trade.type === 'BUY' ? -trade.usdValue : trade.usdValue);
  }, 0);

  const buyTrades = allTrades.filter(t => t.type === 'BUY');
  const sellTrades = allTrades.filter(t => t.type === 'SELL');
  
  const winningTrades = sellTrades.filter(t => t.usdValue > 0);
  const winRate = sellTrades.length > 0 ? (winningTrades.length / sellTrades.length) * 100 : 0;

  return {
    totalTrades: allTrades.length,
    totalVolume,
    totalPnL,
    winRate,
    uniqueTokens: analysisResult.uniqueTokens.size,
    recentTrades: analysisResult.recentTrades.length,
    historicalTrades: Array.from(analysisResult.historicalTrades.values()).flat().length
  };
} 