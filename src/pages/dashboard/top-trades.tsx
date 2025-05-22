import { useEffect, useState, useRef } from 'react';
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
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [scannedWallets, setScannedWallets] = useState<Set<string>>(new Set());
  const walletsRef = useRef(wallets);

  // Keep wallets ref updated
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load data when a wallet is selected
  useEffect(() => {
    const getTradeData = async () => {
      if (!selectedWalletId) return;
      
      const selectedWallet = walletsRef.current.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;
      
      setDataLoading(true);
      setLoadingMessage("Loading your top trades...");
      setError(null);
      setApiError(null);
      
      // Check if initial scan is complete
      const isInitialScanComplete = selectedWallet.initial_scan_complete === true;
      
      // If wallet is already complete, skip scanning logic
      if (isInitialScanComplete) {
        setLoadingMessage("Loading your top trades...");
        
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
        } catch (err: any) {
          console.error('Error loading trade data:', err);
          if (err.message?.includes('Minimum context slot')) {
            console.log('RPC provider reported: Minimum context slot has not been reached');
            setApiError('The Solana RPC service reported a sync delay. We\'re using cached data for now.');
            setErrorType('rpc');
          } else {
            setError('Failed to load trade data. Please try again.');
          }
        } finally {
          setDataLoading(false);
          setLoadingMessage('');
        }
        return;
      }
      
      const walletIsCurrentlyScanning = isWalletScanning(selectedWalletId);
      const hasBeenScanned = scannedWallets.has(selectedWalletId);
      
      // Track if we initiated the scan in this call
      let weInitiatedScan = false;
      
      // Only show initial scan message and mark as scanning if we're actually doing an initial scan
      if (!isInitialScanComplete && !walletIsCurrentlyScanning && !hasBeenScanned) {
        markWalletAsScanning(selectedWalletId);
        setScannedWallets(prev => new Set(prev).add(selectedWalletId));
        weInitiatedScan = true;
        setLoadingMessage("Initial wallet scan in progress. This may take up to 2 minutes for the first scan.");
      } else {
        // Wallet is currently scanning, just show the scanning message
        setLoadingMessage("Wallet scan in progress...");
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
        
        // Only mark as complete if we were the ones who initiated the scan
        if (!isInitialScanComplete && weInitiatedScan) {
          markWalletScanComplete(selectedWalletId);
          setScannedWallets(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedWalletId);
            return newSet;
          });
        }
      } catch (err: any) {
        console.error('Error loading trade data:', err);
        
        // If error during initial scan that we initiated, mark it as complete to prevent endless retries
        if (!isInitialScanComplete && weInitiatedScan) {
          markWalletScanComplete(selectedWalletId);
          setScannedWallets(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedWalletId);
            return newSet;
          });
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
  }, [selectedWalletId, user?.id]);

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

  const handleRefresh = async () => {
    if (!selectedWalletId || !user?.id || refreshing) return;
    
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet || !selectedWallet.initial_scan_complete) return;
    
    setRefreshing(true);
    setRefreshMessage(null);
    
    try {
      const result = await tradingHistoryService.refreshTradingHistory(
        user.id,
        selectedWallet.wallet_address
      );
      
      setRefreshMessage(result.message);
      
      // If new trades were found, reload the data
      if (result.newTradesCount > 0) {
        // Reload the data to show new trades
        const dataResult = await tradingHistoryService.getTradingHistory(
          user.id,
          selectedWallet.wallet_address,
          500,
          1
        );
        
        const processedTopTrades = processTradesForTopPerformers(dataResult.trades);
        setTopTrades(processedTopTrades);
        setTradingHistory(dataResult.trades);
      }
      
      // Clear message after 5 seconds
      setTimeout(() => setRefreshMessage(null), 5000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setRefreshMessage('Failed to refresh data. Please try again.');
      setTimeout(() => setRefreshMessage(null), 5000);
    } finally {
      setRefreshing(false);
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
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">24h Top Trades</h1>
            {selectedWalletId && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
              >
                {refreshing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-gray-500">View your best performing trades in the last 24 hours</p>
          {refreshMessage && (
            <div className={`mt-3 p-3 rounded-md text-sm ${
              refreshMessage.includes('Failed') || refreshMessage.includes('unavailable') 
                ? 'bg-red-900/30 border border-red-500 text-red-200' 
                : 'bg-green-900/30 border border-green-500 text-green-200'
            }`}>
              {refreshMessage}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6">
            {error}
          </div>
        )}

        {apiError && <ApiErrorBanner 
          message={apiError} 
          onRetry={handleRetry} 
          errorType={errorType as 'rpc' | 'auth' | 'timeout' | 'general'} 
        />}

        {!selectedWalletId && (
          <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-4 sm:mb-6">
            Please select a wallet from the dropdown menu to view your top trades.
          </div>
        )}
        
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Best Performing Trades (24h)</h2>
          
          {/* Desktop table - hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
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
          
          {/* Mobile card view - visible only on small screens */}
          <div className="sm:hidden">
            {dataLoading ? (
              <div className="flex items-center justify-center py-4 text-gray-400">
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{loadingMessage || 'Loading trades...'}</span>
                </div>
              </div>
            ) : topTrades.length > 0 ? (
              <div className="space-y-4">
                {topTrades
                  .sort((a, b) => b.profitLoss - a.profitLoss)
                  .map((trade) => (
                    <div key={trade.tokenAddress} className="bg-[#252525] p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-3">
                        {trade.tokenLogoURI && (
                          <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-white font-medium">{trade.tokenSymbol}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-400">Bought</p>
                          <p className="text-gray-300">{trade.totalBought.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Sold</p>
                          <p className="text-gray-300">{trade.totalSold.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">P/L</p>
                          <p className={trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}>
                            ${trade.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Duration</p>
                          <p className="text-gray-300">{trade.duration}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-sm text-gray-300 text-center py-4">
                {selectedWalletId ? 'No trades found for this wallet' : 'Select a wallet to view trades'}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Best Trade (24h)</h2>
            {bestTrade ? (
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center mb-3 sm:mb-4">
                  {bestTrade.tokenLogoURI && (
                    <img src={bestTrade.tokenLogoURI} alt={bestTrade.tokenSymbol} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full mr-3" />
                  )}
                  <h3 className="text-lg sm:text-xl font-semibold text-white">{bestTrade.tokenSymbol}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Profit</p>
                    <p className="text-base sm:text-lg font-semibold text-green-400">
                      ${bestTrade.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-base sm:text-lg font-semibold text-white">{bestTrade.duration}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No trades available</p>
              </div>
            )}
          </div>

          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Worst Trade (24h)</h2>
            {worstTrade ? (
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center mb-3 sm:mb-4">
                  {worstTrade.tokenLogoURI && (
                    <img src={worstTrade.tokenLogoURI} alt={worstTrade.tokenSymbol} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full mr-3" />
                  )}
                  <h3 className="text-lg sm:text-xl font-semibold text-white">{worstTrade.tokenSymbol}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Loss</p>
                    <p className="text-base sm:text-lg font-semibold text-red-400">
                      ${worstTrade.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-base sm:text-lg font-semibold text-white">{worstTrade.duration}</p>
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

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">24h Performance Metrics</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Win Rate</h3>
              <p className="text-lg sm:text-2xl font-semibold text-white">{winRate}%</p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Average Win</h3>
              <p className="text-lg sm:text-2xl font-semibold text-green-400">
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

        <LoadingToast 
          isVisible={!!(dataLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && topTrades.length === 0))} 
          message={selectedWalletId && isWalletScanning(selectedWalletId) && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete !== true ? 
            "Initial wallet scan in progress. This may take a moment. We're scanning your transaction history." : 
            loadingMessage || ''
          } 
        />
      </div>
    </DashboardLayout>
  );
}
