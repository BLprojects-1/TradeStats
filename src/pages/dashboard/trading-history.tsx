import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { getTrackedWallets, TrackedWallet } from '../../utils/userProfile';
import LoadingToast from '../../components/LoadingToast';
import { ProcessedTrade } from '../../services/tradeProcessor';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import { jupiterApiService } from '../../services/jupiterApiService';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatMarketCap, formatSmallPrice, formatDate, formatTime } from '../../utils/formatters';
import NotificationToast from '../../components/NotificationToast';
import { useRefreshButton } from '../../hooks/useRefreshButton';

const TRADES_PER_PAGE = 10; // Reduce to 10 trades per page

// Cache object to store trades data between page navigations
const tradesCache = new Map<string, {
  trades: ProcessedTrade[],
  totalCount: number,
  timestamp: number
}>();

// Helper function to apply discrepancy checking to trades
const applyDiscrepancyChecking = async (trades: ProcessedTrade[], userId: string, walletAddress: string): Promise<ProcessedTrade[]> => {
  // Group trades by token to check for discrepancies
  const tokenMap = new Map<string, {
    buys: { amount: number, timestamp: number, valueUSD: number }[],
    sells: { amount: number, timestamp: number, valueUSD: number }[],
    tokenSymbol: string
  }>();
  
  // Process each trade to group by token
  for (const trade of trades) {
    if (!trade.tokenAddress || !trade.amount) continue;
    
    let tokenData = tokenMap.get(trade.tokenAddress);
    if (!tokenData) {
      tokenData = {
        buys: [],
        sells: [],
        tokenSymbol: trade.tokenSymbol
      };
      tokenMap.set(trade.tokenAddress, tokenData);
    }
    
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
  
  // Check for discrepancies and fetch all-time data if needed
  const tokensToUpdate = new Set<string>();
  
  for (const [tokenAddress, data] of tokenMap.entries()) {
    if (data.buys.length === 0 || data.sells.length === 0) continue;
    
    const totalBought = data.buys.reduce((sum, buy) => sum + buy.amount, 0);
    const totalSold = data.sells.reduce((sum, sell) => sum + sell.amount, 0);
    
    // Check for 2.5% discrepancy
    const netPosition = Math.abs(totalBought - totalSold);
    const maxAmount = Math.max(totalBought, totalSold);
    const discrepancyPercent = maxAmount > 0 ? (netPosition / maxAmount) * 100 : 0;
    
    if (discrepancyPercent > 2.5) {
      console.log(`Discrepancy detected for ${data.tokenSymbol}: ${discrepancyPercent.toFixed(2)}% - triggering all-time scrape`);
      tokensToUpdate.add(tokenAddress);
    }
  }
  
  // Fetch all-time data for tokens with discrepancies
  if (tokensToUpdate.size > 0) {
    for (const tokenAddress of tokensToUpdate) {
      try {
        const allTimeResult = await tradingHistoryService.getAllTokenTrades(
          userId,
          walletAddress,
          tokenAddress
        );
        console.log(`Fetched ${allTimeResult.trades.length} all-time trades for ${tokenAddress}`);
        // Note: The all-time data will be available for the TradeInfoModal
      } catch (error) {
        console.error(`Error fetching all-time trades for ${tokenAddress}:`, error);
      }
    }
  }
  
  return trades; // Return original trades as the main list should still show 24h data
};

export default function TradingHistory() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, setSelectedWalletId, isWalletScanning, markWalletAsScanning, markWalletScanComplete, getWalletCache, setWalletCache, isCacheValid } = useWalletSelection();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [trades, setTrades] = useState<ProcessedTrade[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [tokenFilter, setTokenFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTrades, setTotalTrades] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [lastSignature, setLastSignature] = useState<string | null>(null);

  const [errorType, setErrorType] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreTrades, setHasMoreTrades] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [scannedWallets, setScannedWallets] = useState<Set<string>>(new Set());
  const walletsRef = useRef(wallets);
  const [starringTrade, setStarringTrade] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'type' | 'amount' | 'priceUSD' | 'valueUSD' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number>(0);

  const {
    isLoading: isRefreshing,
    isOnCooldown,
    cooldownTimeLeft: refreshCooldownTimeLeft,
    showNotification: refreshShowNotification,
    notificationType: refreshNotificationType,
    notificationMessage: refreshNotificationMessage,
    handleRefresh: handleRefreshButton,
    handleDismissNotification: handleDismissRefreshNotification
  } = useRefreshButton({
    onRefresh: async () => {
      if (!user?.id || !selectedWalletId) {
        throw new Error('Please select a wallet first.');
      }

      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) {
        throw new Error('Selected wallet not found.');
      }

      return tradingHistoryService.refreshTradingHistory(
        user.id,
        selectedWallet.wallet_address
      );
    }
  });

  // Keep wallets ref updated
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  // Cooldown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cooldownTimeLeft > 0) {
      interval = setInterval(() => {
        setCooldownTimeLeft(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cooldownTimeLeft]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load data when a wallet is selected
  useEffect(() => {
    const getTradeHistory = async () => {
      if (!selectedWalletId) return;
      
      const selectedWallet = walletsRef.current.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;

      // Check if we have cached data first
      const cachedData = getWalletCache(selectedWalletId);
      if (cachedData && isCacheValid(selectedWalletId)) {
        console.log('Using cached data for trading history');
        setTrades(cachedData);
        setTotalTrades(cachedData.length);
        setTotalPages(Math.ceil(cachedData.length / TRADES_PER_PAGE));
        return;
      }
      
      setDataLoading(true);
      setLoadingMessage("Loading your trading history...");
      setError(null);
      setApiError(null);
      
      // Check if initial scan is complete first - use explicit comparison to ensure boolean value
      const isInitialScanComplete = selectedWallet.initial_scan_complete === true;
      console.log(`Wallet ${selectedWallet.wallet_address} initial_scan_complete:`, isInitialScanComplete);
      
      // Only set initial scan in progress if scan is NOT complete AND not already scanning
      const walletIsCurrentlyScanning = isWalletScanning(selectedWalletId);
      
      // Check if we've already initiated scanning for this wallet in this session
      const hasBeenScanned = scannedWallets.has(selectedWalletId);
      
      // Track if we initiated the scan in this call
      let weInitiatedScan = false;
      
      // Only mark as scanning and show initial scan message if we're actually doing an initial scan
      if (!isInitialScanComplete && !walletIsCurrentlyScanning && !hasBeenScanned) {
        markWalletAsScanning(selectedWalletId);
        setScannedWallets(prev => new Set(prev).add(selectedWalletId));
        weInitiatedScan = true;
        setLoadingMessage("Initial wallet scan in progress. This may take up to 2 minutes for the first scan.");
      } else if (isInitialScanComplete) {
        // For wallets that are already scanned, show normal loading message
        setLoadingMessage("Loading trade history from database...");
      } else {
        // Wallet is currently scanning, just show the scanning message
        setLoadingMessage("Wallet scan in progress...");
      }
      
      try {
        console.log(`Loading trades for wallet: ${selectedWallet.wallet_address}, initialScanComplete: ${isInitialScanComplete}`);
        
        // Reset pagination when filters change
        setCurrentPage(1);
        
        // Calculate timestamp for 24 hours ago
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);
        
        try {
          // Use tradingHistoryService to get trade history
          // The service will now handle the logic to either:
          // 1. Pull data directly from Supabase if initial_scan_complete is TRUE
          // 2. Process data from DRPC/Jupiter and update Supabase if initial_scan_complete is FALSE
          let result = await tradingHistoryService.getTradingHistory(
            user!.id,
            selectedWallet.wallet_address,
            TRADES_PER_PAGE,
            1,
            oneDayAgo.getTime() // Pass the 24 hour timestamp to filter trades
          );
          
          // Apply discrepancy checking to trades
          if (result && result.trades.length > 0) {
            const processedTrades = await applyDiscrepancyChecking(result.trades, user!.id, selectedWallet.wallet_address);
            result = { ...result, trades: processedTrades };
          }
          
          if (result && result.trades.length > 0) {
            setTrades(result.trades);
            setTotalTrades(result.totalCount);
            setTotalPages(Math.ceil(result.totalCount / TRADES_PER_PAGE));
            
            // Cache the result for future use
            tradesCache.set(selectedWalletId, {
              trades: result.trades,
              totalCount: result.totalCount,
              timestamp: Date.now()
            });
            
            console.log(`Loaded ${result.trades.length} trades from database`);
          } else {
            console.log('No trades found for this wallet in the last 24 hours');
            setTrades([]);
            setTotalTrades(0);
            
            // Cache empty result to prevent unnecessary requests
            tradesCache.set(selectedWalletId, {
              trades: [],
              totalCount: 0,
              timestamp: Date.now()
            });
          }
          
          // Only mark as complete if we were the ones who initiated the scan AND wallet isn't already complete
          if (!isInitialScanComplete && weInitiatedScan) {
            markWalletScanComplete(selectedWalletId);
            // Remove from scanned wallets since it's now complete
            setScannedWallets(prev => {
              const newSet = new Set(prev);
              newSet.delete(selectedWalletId);
              return newSet;
            });
          }
        } catch (apiError) {
          console.error('Error loading trades:', apiError);
          setApiError('Unable to load trading history. Please try again later.');
          setErrorType('rpc');
          
          // If error during initial scan that we initiated, mark it as complete to prevent endless retries
          if (!isInitialScanComplete && weInitiatedScan) {
            markWalletScanComplete(selectedWalletId);
            // Remove from scanned wallets since we're marking it complete
            setScannedWallets(prev => {
              const newSet = new Set(prev);
              newSet.delete(selectedWalletId);
              return newSet;
            });
          }
        }
      } catch (err) {
        console.error('Error loading trade history:', err);
        setError('Failed to load trading history. Please try again.');
        
        // If error during initial scan that we initiated, mark it as complete to prevent endless retries
        if (!isInitialScanComplete && weInitiatedScan) {
          markWalletScanComplete(selectedWalletId);
          // Remove from scanned wallets since we're marking it complete
          setScannedWallets(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedWalletId);
            return newSet;
          });
        }
      } finally {
        setDataLoading(false);
        setLoadingMessage('');
      }
    };
    
    if (selectedWalletId) {
      getTradeHistory();
    }
  }, [selectedWalletId, user?.id, currentPage]);

  // Update the loadMoreTrades function to use tradingHistoryService instead
  const loadMoreTrades = async () => {
    if (!selectedWalletId || !user?.id || loadingMore) return;
    
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet) return;
    
    // Check if initial scan is complete - use explicit comparison
    const isInitialScanComplete = selectedWallet.initial_scan_complete === true;
    
    // Check cache first for next page
    const nextPage = currentPage + 1;
    const cacheKey = `${selectedWalletId}_${nextPage}`;
    const cachedData = tradesCache.get(cacheKey);
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    if (cachedData && cachedData.timestamp > fiveMinutesAgo && isInitialScanComplete) {
      // Use cached data for next page
      setTrades(prev => [...prev, ...cachedData.trades]);
      setTotalTrades(cachedData.totalCount);
      setCurrentPage(nextPage);
      setTotalPages(Math.ceil(cachedData.totalCount / TRADES_PER_PAGE));
      setHasMoreTrades(nextPage < Math.ceil(cachedData.totalCount / TRADES_PER_PAGE));
      console.log(`Loaded ${cachedData.trades.length} more trades from cache`);
      return;
    }
    
    setLoadingMore(true);
    
    // Only show loading message if initial scan isn't complete
    if (!isInitialScanComplete) {
      setLoadingMessage("Loading more trades...");
    }
    
    try {
      // Calculate 24 hours ago
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      
      // Load next page
      const result = await tradingHistoryService.getTradingHistory(
        user.id,
        selectedWallet.wallet_address,
        TRADES_PER_PAGE,
        nextPage,
        oneDayAgo.getTime() // Filter by last 24 hours
      );
      
      if (result && result.trades.length > 0) {
        // Append new trades to existing ones
        setTrades(prev => [...prev, ...result.trades]);
        setTotalTrades(result.totalCount);
        setCurrentPage(nextPage);
        setTotalPages(Math.ceil(result.totalCount / TRADES_PER_PAGE));
        setHasMoreTrades(nextPage < Math.ceil(result.totalCount / TRADES_PER_PAGE));
        
        // Cache the result
        tradesCache.set(cacheKey, {
          trades: result.trades,
          totalCount: result.totalCount,
          timestamp: now
        });
        
        console.log(`Loaded ${result.trades.length} more trades from page ${nextPage}`);
      } else {
        setHasMoreTrades(false);
        
        // Cache empty result
        tradesCache.set(cacheKey, {
          trades: [],
          totalCount: totalTrades, // Keep the same total count
          timestamp: now
        });
      }
    } catch (error) {
      console.error('Error loading more trades:', error);
      setApiError('Failed to load more trades. Please try again.');
      setErrorType('general');
    } finally {
      setLoadingMore(false);
      setLoadingMessage('');
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet) return;
    
    await loadMoreTrades();
  };

  const handleRetry = () => {
    if (selectedWalletId) {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (selectedWallet) {
        setApiError(null);
        loadMoreTrades();
      }
    }
  };

  const handleStarTrade = async (trade: ProcessedTrade) => {
    if (!user?.id || !selectedWalletId) return;
    
    setStarringTrade(trade.signature);
    try {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;

      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, selectedWallet.wallet_address);
      await tradingHistoryService.toggleStarredTrade(walletId, trade.signature, !trade.starred);
      
      // Update local state
      setTrades(prev => prev.map(t => 
        t.signature === trade.signature 
          ? { ...t, starred: !trade.starred }
          : t
      ));
    } catch (err) {
      console.error('Error starring trade:', err);
      setError('Failed to star trade. Please try again.');
    } finally {
      setStarringTrade(null);
    }
  };

  // Filter trades based on the selected token filter
  const filteredTrades = trades.filter(trade => {
    if (tokenFilter === 'all') return true;
    return trade.tokenSymbol.toLowerCase() === tokenFilter.toLowerCase();
  });

  // Sort trades if a sort field is selected
  const sortedTrades = sortField ? [...filteredTrades].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    
    if (sortField === 'type') {
      aValue = aValue || '';
      bValue = bValue || '';
    } else {
      aValue = aValue || 0;
      bValue = bValue || 0;
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  }) : filteredTrades;

  // Calculate pagination based on sorted and filtered trades
  const paginatedTrades = sortedTrades.slice(
    (currentPage - 1) * TRADES_PER_PAGE,
    currentPage * TRADES_PER_PAGE
  );
  const totalFilteredPages = Math.ceil(sortedTrades.length / TRADES_PER_PAGE);

  const handleSort = (field: 'type' | 'amount' | 'priceUSD' | 'valueUSD') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const getSortIcon = (field: 'type' | 'amount' | 'priceUSD' | 'valueUSD') => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      );
    }
    
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
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
      title="Trading History"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">24h Trading History</h1>
            <button
              onClick={handleRefreshButton}
              disabled={isRefreshing || isOnCooldown}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg
                ${isRefreshing || isOnCooldown
                  ? 'bg-indigo-800 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
                }
                transition-colors duration-200
              `}
            >
              <svg
                className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>
                {isRefreshing
                  ? 'Refreshing...'
                  : isOnCooldown
                  ? `Wait ${Math.ceil(refreshCooldownTimeLeft / 1000)}s`
                  : 'Refresh'
                }
              </span>
            </button>
          </div>
          <p className="text-gray-500">View your recent Solana trading activity (last 24 hours)</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6" role="alert">
            <p>{error}</p>
          </div>
        )}
        
        {apiError && <ApiErrorBanner 
          message={apiError} 
          onRetry={handleRetry}
          errorType={errorType as 'rpc' | 'auth' | 'timeout' | 'general'} 
        />}

        {!selectedWalletId && (
          <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-4 sm:mb-6">
            Please select a wallet from the dropdown menu to view your trading history.
          </div>
        )}

        <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
            <div className="flex items-center">
              <h2 className="text-lg sm:text-xl font-semibold text-indigo-200">Recent Trades</h2>
              <span className="ml-2 text-sm text-indigo-400">(Last 24 hours)</span>
            </div>
            <div className="flex gap-4">
              <select 
                className="w-full sm:w-auto bg-[#23232b] text-gray-300 rounded-md px-3 py-2 text-sm border border-gray-700"
                value={tokenFilter}
                onChange={(e) => {
                  setTokenFilter(e.target.value);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
                disabled={dataLoading}
              >
                <option value="all">All Tokens</option>
                {Array.from(new Set(trades.map(trade => trade.tokenSymbol)))
                  .filter(symbol => symbol)
                  .sort()
                  .map(symbol => (
                    <option key={symbol} value={symbol.toLowerCase()}>
                      {symbol}
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
          
          {/* Desktop Table - Hidden on Mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Star</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Token
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <button 
                      onClick={() => handleSort('type')} 
                      className="flex items-center space-x-1 hover:text-white transition-colors"
                    >
                      <span>Type</span>
                      {getSortIcon('type')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <button 
                      onClick={() => handleSort('amount')} 
                      className="flex items-center space-x-1 hover:text-white transition-colors"
                    >
                      <span>Amount</span>
                      {getSortIcon('amount')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <button 
                      onClick={() => handleSort('priceUSD')} 
                      className="flex items-center space-x-1 hover:text-white transition-colors"
                    >
                      <span>Price (USD)</span>
                      {getSortIcon('priceUSD')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <button 
                      onClick={() => handleSort('valueUSD')} 
                      className="flex items-center space-x-1 hover:text-white transition-colors"
                    >
                      <span>Value (USD)</span>
                      {getSortIcon('valueUSD')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {dataLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{loadingMessage || 'Loading transactions...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedTrades.length > 0 ? (
                  paginatedTrades.map((trade) => (
                    <tr key={trade.signature} className="bg-[#1a1a1a] hover:bg-[#23232b] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <button
                          onClick={() => handleStarTrade(trade)}
                          disabled={starringTrade === trade.signature}
                          className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                          aria-label={trade.starred ? 'Unstar trade' : 'Star trade'}
                        >
                          {starringTrade === trade.signature ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg 
                              className={`h-4 w-4 ${trade.starred ? 'text-yellow-400 fill-current' : 'text-gray-400'}`} 
                              xmlns="http://www.w3.org/2000/svg" 
                              fill={trade.starred ? 'currentColor' : 'none'} 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex items-center space-x-2">
                          {trade.tokenLogoURI && (
                            <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-5 h-5 rounded-full" />
                          )}
                          <span className="flex flex-col">
                            <span>{trade.tokenSymbol || 'Unknown'}</span>
                            {trade.tokenAddress && (
                              <span className="text-xs text-gray-500">
                                {`${trade.tokenAddress.substring(0, 4)}...${trade.tokenAddress.substring(trade.tokenAddress.length - 4)}`}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {trade.type || 'UNKNOWN'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {trade.amount ? formatTokenAmount(trade.amount, trade.decimals) : '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {trade.priceUSD ? formatSmallPrice(trade.priceUSD) : '$0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {trade.valueUSD ? formatSmallPrice(trade.valueUSD) : '$0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDate(trade.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatTime(trade.timestamp)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">
                      {selectedWalletId ? 'No trades found for this wallet' : 'Select a wallet to view trade history'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Card View - Visible Only on Small Screens */}
          <div className="sm:hidden">
            {dataLoading ? (
              <div className="flex items-center justify-center py-4 text-gray-400">
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{loadingMessage || 'Loading transactions...'}</span>
                </div>
              </div>
            ) : paginatedTrades.length > 0 ? (
              <div className="space-y-4">
                {paginatedTrades.map((trade) => (
                  <div key={trade.signature} className="bg-[#252525] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {trade.tokenLogoURI && (
                          <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-6 h-6 rounded-full" />
                        )}
                        <div>
                          <span className="text-white font-medium">{trade.tokenSymbol || 'Unknown'}</span>
                          {trade.tokenAddress && (
                            <div className="text-xs text-gray-500">
                              {`${trade.tokenAddress.substring(0, 4)}...${trade.tokenAddress.substring(trade.tokenAddress.length - 4)}`}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleStarTrade(trade)}
                        disabled={starringTrade === trade.signature}
                        className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                        aria-label={trade.starred ? 'Unstar trade' : 'Star trade'}
                      >
                        {starringTrade === trade.signature ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg 
                            className={`h-5 w-5 ${trade.starred ? 'text-yellow-400 fill-current' : 'text-gray-400'}`} 
                            xmlns="http://www.w3.org/2000/svg" 
                            fill={trade.starred ? 'currentColor' : 'none'} 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div>
                        <p className="text-gray-400">Type</p>
                        <p className="text-gray-300">{trade.type || 'UNKNOWN'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Amount</p>
                        <p className="text-gray-300">{trade.amount ? formatTokenAmount(trade.amount, trade.decimals) : '0'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Price (USD)</p>
                        <p className="text-gray-300">{trade.priceUSD ? formatSmallPrice(trade.priceUSD) : '$0'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Value (USD)</p>
                        <p className="text-gray-300">{trade.valueUSD ? formatSmallPrice(trade.valueUSD) : '$0'}</p>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400 border-t border-gray-700 pt-2 flex justify-between">
                      <span>{formatDate(trade.timestamp)}</span>
                      <span>{formatTime(trade.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-300 text-center py-4">
                {selectedWalletId ? 'No trades found for this wallet' : 'Select a wallet to view trade history'}
              </div>
            )}
          </div>
          
          {/* Add load more button */}
          {hasMoreTrades && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMoreTrades}
                disabled={loadingMore}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span>Load More</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Pagination Controls */}
          {totalFilteredPages >= 1 && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-400">
                Showing {((currentPage - 1) * TRADES_PER_PAGE) + 1} to {Math.min(currentPage * TRADES_PER_PAGE, sortedTrades.length)} of {sortedTrades.length} trades
                {tokenFilter !== 'all' && ` (filtered by ${tokenFilter.toUpperCase()})`}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-500 text-white text-sm"
                >
                  First
                </button>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-500 text-white text-sm"
                >
                  Previous
                </button>
                
                <span className="px-3 py-1 text-sm text-gray-300">
                  Page {currentPage} of {totalFilteredPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalFilteredPages, prev + 1))}
                  disabled={currentPage === totalFilteredPages}
                  className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-500 text-white text-sm"
                >
                  Next
                </button>
                
                <button
                  onClick={() => setCurrentPage(totalFilteredPages)}
                  disabled={currentPage === totalFilteredPages}
                  className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-500 text-white text-sm"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Trades{tokenFilter !== 'all' ? ` (${tokenFilter.toUpperCase()})` : ''}</h3>
            <p className="text-lg sm:text-2xl font-semibold text-white">{sortedTrades.length}</p>
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Volume{tokenFilter !== 'all' ? ` (${tokenFilter.toUpperCase()})` : ''}</h3>
            <p className="text-lg sm:text-2xl font-semibold text-white">
              {formatSmallPrice(sortedTrades.reduce((sum, trade) => sum + (trade.valueUSD || 0), 0))}
            </p>
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h P/L{tokenFilter !== 'all' ? ` (${tokenFilter.toUpperCase()})` : ''}</h3>
            <p className="text-lg sm:text-2xl font-semibold text-white">
              {formatSmallPrice(sortedTrades.reduce((sum, trade) => {
                const value = trade.valueUSD || 0;
                return sum + (trade.type === 'BUY' ? -value : value);
              }, 0))}
            </p>
          </div>
        </div>

        <LoadingToast 
          isVisible={!!(dataLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && trades.length === 0))} 
          message={selectedWalletId && isWalletScanning(selectedWalletId) && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete !== true ? 
            "Initial wallet scan in progress. This may take a moment. We're scanning your transaction history." : 
            loadingMessage || ''
          } 
        />

        <NotificationToast
          isVisible={refreshShowNotification}
          message={refreshNotificationMessage}
          type={refreshNotificationType}
          onDismiss={handleDismissRefreshNotification}
        />
      </div>
    </DashboardLayout>
  );
}
