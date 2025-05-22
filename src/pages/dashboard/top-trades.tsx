import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { getTrackedWallets, TrackedWallet } from '../../utils/userProfile';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import { ProcessedTrade } from '../../services/tradeProcessor';

// Modified TradeData interface that matches our processed trades
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

// Helper function to process trades and find top performers
const processTradesForTopPerformers = (trades: ProcessedTrade[]): TradeData[] => {
  // Group trades by token
  const tokenMap = new Map<string, {
    buys: { amount: number, timestamp: number, valueUSD: number }[],
    sells: { amount: number, timestamp: number, valueUSD: number }[],
    tokenSymbol: string,
    tokenLogoURI: string | null
  }>();
  
  // Process each trade
  for (const trade of trades) {
    // Skip trades without required data
    if (!trade.tokenAddress || !trade.amount) continue;
    
    // Get or create token entry
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
    
    // Add to buys or sells
    if (trade.type === 'BUY') {
      tokenData.buys.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD
      });
    } else if (trade.type === 'SELL') {
      tokenData.sells.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD
      });
    }
  }
  
  // Calculate metrics for each token
  const result: TradeData[] = [];
  
  for (const [tokenAddress, data] of tokenMap.entries()) {
    // Only include tokens that have both buys and sells
    if (data.buys.length === 0 || data.sells.length === 0) continue;
    
    // Calculate total bought/sold
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
};

export default function TopTrades() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, setSelectedWalletId, isWalletScanning, markWalletAsScanning, markWalletScanComplete } = useWalletSelection();
  const router = useRouter();
  const [topTrades, setTopTrades] = useState<TradeData[]>([]);
  const [tradingHistory, setTradingHistory] = useState<ProcessedTrade[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load data when a wallet is selected
  useEffect(() => {
    const getTradeData = async () => {
      if (!selectedWalletId) return;
      
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;
      
      setDataLoading(true);
      setLoadingMessage("Loading your top trades...");
      setError(null);
      setApiError(null);
      
      // Check if initial scan is complete
      const isInitialScanComplete = selectedWallet.initial_scan_complete === true;
      const walletIsCurrentlyScanning = isWalletScanning(selectedWalletId);
      
      // If initial scan is not complete and wallet is not already being scanned, mark it as scanning
      if (!isInitialScanComplete && !walletIsCurrentlyScanning) {
        markWalletAsScanning(selectedWalletId);
        setLoadingMessage("Performing initial wallet scan. This may take a moment...");
      } else {
        // Show more detailed loading messages to set user expectations
        setTimeout(() => {
          if (dataLoading) {
            setLoadingMessage("Connecting to Solana RPC services...");
          }
        }, 1500);
        
        setTimeout(() => {
          if (dataLoading) {
            setLoadingMessage("Analyzing trade performance...");
          }
        }, 3000);
        
        setTimeout(() => {
          if (dataLoading) {
            setLoadingMessage("Calculating profit and loss...");
          }
        }, 5000);
      }
      
      try {
        // Use the tradingHistoryService to get all trading history
        const result = await tradingHistoryService.getTradingHistory(
          user!.id,
          selectedWallet.wallet_address,
          500, // Get a larger number of trades for better analysis
          1
        );
        
        // Process the trades to find top performers
        const processedTopTrades = processTradesForTopPerformers(result.trades);
        setTopTrades(processedTopTrades);
        setTradingHistory(result.trades);
        
        // If this was an initial scan, mark it as complete in our context
        if (!isInitialScanComplete) {
          markWalletScanComplete(selectedWalletId);
        }
      } catch (err: any) {
        console.error('Error loading trade data:', err);
        
        // If error during initial scan, still mark it as complete to prevent endless retries
        if (!isInitialScanComplete) {
          markWalletScanComplete(selectedWalletId);
        }
        
        // Enhanced error handling with more specific messages
        if (err.message?.includes('Minimum context slot')) {
          // This is a known DRPC API limitation
          console.log('RPC provider reported: Minimum context slot has not been reached');
          setApiError('The Solana RPC service reported a sync delay. We\'re using cached data for now.');
          setErrorType('rpc');
        } else if (err.message?.includes('TRANSACTION_FETCH_ERROR') || err.message?.includes('getTransaction')) {
          setApiError('Unable to fetch transaction data. Our systems are working to resolve this issue.');
          setErrorType('rpc');
        } else if (err.message?.includes('Service Unavailable') || err.message?.includes('503')) {
          setApiError('The Solana RPC service is currently unavailable. Please try again in a few moments.');
          setErrorType('rpc');
        } else if (err.message?.includes('NOT_FOUND')) {
          // This is a legitimate response for transactions that don't exist or were pruned
          console.log('Some transactions were not found in the ledger. This is normal for older transactions.');
          // Don't show an error banner for this case
        } else if (err.message?.includes('API key') || err.message?.includes('403') || err.message?.includes('401')) {
          setApiError('Authentication issue with Solana RPC providers. Our team has been notified.');
          setErrorType('auth');
        } else if (err.message?.includes('timeout') || err.message?.includes('ECONNABORTED')) {
          setApiError('Request timeout. The Solana network may be experiencing high traffic.');
          setErrorType('timeout');
        } else if (err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
          // Handle rate limiting specifically for Jupiter API
          console.log('Rate limit hit on Jupiter API, using rate-limited service which will retry automatically');
          // Our rate-limited service will handle this internally with exponential backoff
        } else {
          setError('Failed to load trade data. Please try again.');
        }
      } finally {
        setDataLoading(false);
        setLoadingMessage('');
      }
    };
    
    getTradeData();
  }, [selectedWalletId, wallets, user?.id, dataLoading, isWalletScanning, markWalletAsScanning, markWalletScanComplete]);

  // Calculate best and worst trades
  const bestTrade = topTrades.length > 0 
    ? topTrades.reduce((best, trade) => trade.profitLoss > best.profitLoss ? trade : best, topTrades[0])
    : null;
    
  const worstTrade = topTrades.length > 0 
    ? topTrades.reduce((worst, trade) => trade.profitLoss < worst.profitLoss ? trade : worst, topTrades[0])
    : null;

  // Calculate performance metrics
  const winningTrades = topTrades.filter(trade => trade.profitLoss > 0);
  const losingTrades = topTrades.filter(trade => trade.profitLoss < 0);
  const winRate = topTrades.length > 0 ? (winningTrades.length / topTrades.length * 100).toFixed(1) : '0';
  const avgWin = winningTrades.length > 0 
    ? winningTrades.reduce((sum, trade) => sum + trade.profitLoss, 0) / winningTrades.length 
    : 0;
  const avgLoss = losingTrades.length > 0 
    ? Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profitLoss, 0) / losingTrades.length)
    : 0;
  const profitFactor = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '0.00';

  const handleRetry = () => {
    if (selectedWalletId) {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (selectedWallet) {
        setApiError(null);
        const getTradeData = async () => {
          try {
            setDataLoading(true);
            setLoadingMessage("Retrying...");
            
            // Use the tradingHistoryService to get all trading history
            const result = await tradingHistoryService.getTradingHistory(
              user!.id,
              selectedWallet.wallet_address,
              500,
              1
            );
            
            // Process the trades to find top performers
            const processedTopTrades = processTradesForTopPerformers(result.trades);
            setTopTrades(processedTopTrades);
            setTradingHistory(result.trades);
            
          } catch (err) {
            console.error('Error retrying trade data fetch:', err);
          } finally {
            setDataLoading(false);
            setLoadingMessage('');
          }
        };
        getTradeData();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-indigo-400 text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout 
      title="Top Trades"
    >
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2 text-white">24h Top Trades</h1>
          <p className="text-gray-500">View your best performing trades in the last 24 hours</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {apiError && <ApiErrorBanner 
          message={apiError} 
          onRetry={handleRetry} 
          errorType={errorType as 'rpc' | 'auth' | 'timeout' | 'general'} 
        />}

        {!selectedWalletId && (
          <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-6">
            Please select a wallet from the dropdown menu to view your top trades.
          </div>
        )}
        
        {selectedWalletId && isWalletScanning(selectedWalletId) && (
          <div className="bg-[#23232b] border border-blue-500/20 text-blue-200 px-4 py-3 rounded mb-4">
            <p className="font-bold">Initial wallet scan in progress</p>
            <p>This may take up to 2 minutes for the first scan. Subsequent updates will be much faster.</p>
            <p className="mt-2 text-sm">We're scanning your wallet's transaction history and processing trades. Please wait...</p>
          </div>
        )}

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-indigo-200 mb-6">Best Performing Trades (24h)</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Bought</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P/L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {topTrades.length > 0 ? (
                  topTrades
                    .sort((a, b) => b.profitLoss - a.profitLoss) // Sort by profit (highest first)
                    .map((trade) => (
                      <tr key={trade.tokenAddress}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex items-center space-x-2">
                            {trade.tokenLogoURI && (
                              <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-5 h-5 rounded-full" />
                            )}
                            <span>{trade.tokenSymbol}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {trade.totalBought.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {trade.totalSold.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${trade.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {trade.duration}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                      {selectedWalletId ? 'No trades found for this wallet' : 'Select a wallet to view trades'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-indigo-200 mb-6">Best Trade (24h)</h2>
            {bestTrade ? (
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center mb-4">
                  {bestTrade.tokenLogoURI && (
                    <img src={bestTrade.tokenLogoURI} alt={bestTrade.tokenSymbol} className="w-8 h-8 rounded-full mr-3" />
                  )}
                  <h3 className="text-xl font-semibold text-white">{bestTrade.tokenSymbol}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Profit</p>
                    <p className="text-lg font-semibold text-green-400">
                      ${bestTrade.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-lg font-semibold text-white">{bestTrade.duration}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No trades available</p>
              </div>
            )}
          </div>

          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-indigo-200 mb-6">Worst Trade (24h)</h2>
            {worstTrade ? (
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center mb-4">
                  {worstTrade.tokenLogoURI && (
                    <img src={worstTrade.tokenLogoURI} alt={worstTrade.tokenSymbol} className="w-8 h-8 rounded-full mr-3" />
                  )}
                  <h3 className="text-xl font-semibold text-white">{worstTrade.tokenSymbol}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Loss</p>
                    <p className="text-lg font-semibold text-red-400">
                      ${worstTrade.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-lg font-semibold text-white">{worstTrade.duration}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No trades available</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-indigo-200 mb-6">24h Performance Metrics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">24h Win Rate</h3>
              <p className="text-2xl font-semibold text-white">{winRate}%</p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">24h Average Win</h3>
              <p className="text-2xl font-semibold text-green-400">
                ${avgWin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">24h Average Loss</h3>
              <p className="text-2xl font-semibold text-red-400">
                ${avgLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">24h Profit Factor</h3>
              <p className="text-2xl font-semibold text-white">{profitFactor}</p>
            </div>
          </div>
        </div>
      </div>

      <LoadingToast isVisible={dataLoading} message={loadingMessage} />
    </DashboardLayout>
  );
}
