import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice, formatPriceWithTwoDecimals } from '../../utils/formatters';
import TradeInfoModal from '../../components/TradeInfoModal';
import { useRefreshButton } from '../../hooks/useRefreshButton';
import NotificationToast from '../../components/NotificationToast';
import { useProcessedTradingData } from '../../hooks/useProcessedTradingData';
import { TopTradeData } from '../../utils/historicalTradeProcessing';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import { supabase } from '../../utils/supabaseClient';
import { jupiterApiService } from '../../services/jupiterApiService';
import WalletScanModal from '../../components/WalletScanModal';
import TrafficInfoModal from '../../components/TrafficInfoModal';

// Interface for Faded Runners data
interface FadedRunnerData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  tokenLogoURI?: string;
  firstBuyPrice: number;
  currentPrice: number;
  priceIncrease: number;
  actualProfitLoss: number;
  potentialProfitLoss: number;
  totalBought: number;
  totalSold: number;
}

export default function TopTrades() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning } = useWalletSelection();
  const router = useRouter();

  // Use our processed trading data hook
  const {
    data: initialTopTrades,
    loading: dataLoading,
    error,
    refreshData
  } = useProcessedTradingData({
    autoLoad: false, // Don't auto-load data to prevent historicalPriceService from running on refresh
    dataType: 'topTrades'
  });

  // Create a local state to manage the top trades data
  const [topTrades, setTopTrades] = useState<TopTradeData[]>([]);
  // Create a local state to manage the faded runners data
  const [fadedRunners, setFadedRunners] = useState<FadedRunnerData[]>([]);
  const [loadingFadedRunners, setLoadingFadedRunners] = useState<boolean>(false);

  // Add sorting state
  const [sortField, setSortField] = useState<'time' | 'value' | 'size'>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Function to fetch and process faded runners
  const fetchFadedRunners = useCallback(async () => {
    if (!selectedWalletId) {
      setFadedRunners([]);
      return;
    }

    setLoadingFadedRunners(true);
    try {
      // Fetch all trades for the wallet
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', selectedWalletId);

      if (error) {
        console.error('Error fetching trades for faded runners:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        setFadedRunners([]);
        return;
      }

      // Group trades by token
      const tokenMap = new Map<string, {
        trades: any[],
        tokenSymbol: string,
        tokenLogoURI?: string,
        totalBought: number,
        totalSold: number,
        actualProfitLoss: number
      }>();

      // Process all trades
      for (const trade of data) {
        const key = trade.token_address;

        if (!tokenMap.has(key)) {
          tokenMap.set(key, {
            trades: [],
            tokenSymbol: trade.token_symbol,
            tokenLogoURI: trade.token_logo_uri,
            totalBought: 0,
            totalSold: 0,
            actualProfitLoss: 0
          });
        }

        const tokenData = tokenMap.get(key)!;
        tokenData.trades.push(trade);

        if (trade.type === 'BUY') {
          tokenData.totalBought += Math.abs(trade.amount);
          tokenData.actualProfitLoss -= trade.value_usd || 0;
        } else {
          tokenData.totalSold += Math.abs(trade.amount);
          tokenData.actualProfitLoss += trade.value_usd || 0;
        }
      }

      // Process each token to find faded runners
      const fadedRunnersData: FadedRunnerData[] = [];

      for (const [tokenAddress, tokenData] of tokenMap.entries()) {
        // Only consider tokens where the user has completely exited the position
        // (totalSold is approximately equal to totalBought, allowing for small dust amounts)
        if (Math.abs(tokenData.totalBought - tokenData.totalSold) < 10) {
          // Sort trades by timestamp to find the first buy
          const sortedTrades = tokenData.trades.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          // Find the first BUY trade
          const firstBuyTrade = sortedTrades.find(trade => trade.type === 'BUY');

          if (firstBuyTrade) {
            try {
              // Get the first buy price
              const firstBuyPrice = firstBuyTrade.price_usd || 0;

              // Get the current price using Jupiter API
              const currentPrice = await jupiterApiService.getTokenPriceInUSD(tokenAddress);

              // Calculate price increase percentage
              const priceIncrease = firstBuyPrice > 0 ? ((currentPrice - firstBuyPrice) / firstBuyPrice) * 100 : 0;

              // Only include tokens that have increased by 1000% or more
              if (priceIncrease >= 1000) {
                // Calculate potential profit if user never sold
                const potentialValue = tokenData.totalBought * currentPrice;
                const initialInvestment = tokenData.totalBought * firstBuyPrice;
                const potentialProfitLoss = potentialValue - initialInvestment;

                fadedRunnersData.push({
                  tokenAddress,
                  tokenSymbol: tokenData.tokenSymbol,
                  tokenLogoURI: tokenData.tokenLogoURI,
                  firstBuyPrice,
                  currentPrice,
                  priceIncrease,
                  actualProfitLoss: tokenData.actualProfitLoss,
                  potentialProfitLoss,
                  totalBought: tokenData.totalBought,
                  totalSold: tokenData.totalSold
                });
              }
            } catch (error) {
              console.error(`Error processing faded runner for token ${tokenAddress}:`, error);
            }
          }
        }
      }

      // Sort by potential profit (highest first)
      setFadedRunners(fadedRunnersData.sort((a, b) => b.potentialProfitLoss - a.potentialProfitLoss));
    } catch (error) {
      console.error('Error fetching faded runners:', error);
    } finally {
      setLoadingFadedRunners(false);
    }
  }, [selectedWalletId]);

  // Update local state when data from the hook changes
  useEffect(() => {
    if (initialTopTrades) {
      setTopTrades(initialTopTrades);
      // When top trades data is updated, fetch faded runners
      fetchFadedRunners();
    }
  }, [initialTopTrades, fetchFadedRunners]);

  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [starringTrade, setStarringTrade] = useState<string | null>(null);
  const [swingPlans, setSwingPlans] = useState<Map<string, string>>(new Map());
  const [starNotification, setStarNotification] = useState<{ show: boolean; tokenSymbol: string; isUnstarring?: boolean }>({ show: false, tokenSymbol: '' });

  // Modal state
  const [selectedTradeModal, setSelectedTradeModal] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenLogoURI?: string;
  } | null>(null);

  // Get the wallet address from the selected wallet
  const selectedWallet = wallets.find(w => w.id === selectedWalletId);
  const walletAddress = selectedWallet?.wallet_address || '';

  const {
    isLoading: isRefreshing,
    isOnCooldown,
    cooldownTimeLeft: refreshCooldownTimeLeft,
    showNotification,
    notificationType,
    notificationMessage,
    handleRefresh,
    handleDismissNotification,
    showWalletScanModal,
    setShowWalletScanModal,
    handleWalletScanSuccess
  } = useRefreshButton({
    onRefresh: async () => {
      if (!user?.id || !selectedWalletId) {
        throw new Error('Please select a wallet first.');
      }

      await refreshData();

      // Return the expected format
      return {
        newTradesCount: topTrades?.length || 0,
        message: 'Trading data refreshed successfully'
      };
    },
    useWalletScanModal: true,
    walletAddress,
    userId: user?.id
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);


  // Load swing plans from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const savedPlans = localStorage.getItem(`swing_plans_${user.id}`);
      if (savedPlans) {
        setSwingPlans(new Map(JSON.parse(savedPlans)));
      }
    }
  }, [user?.id]);

  const handleSwingPlanChange = (tokenAddress: string, plan: string) => {
    setSwingPlans(prev => {
      const newPlans = new Map(prev);
      newPlans.set(tokenAddress, plan);
      // Save to localStorage
      if (user?.id) {
        localStorage.setItem(`swing_plans_${user.id}`, JSON.stringify(Array.from(newPlans.entries())));
      }
      return newPlans;
    });
  };

  // Calculate best and worst trades
  let bestTrade = null;
  let worstTrade = null;

  if (topTrades.length > 0) {
    // Sort trades by profit/loss
    const sortedTrades = [...topTrades].sort((a, b) => b.profitLoss - a.profitLoss);

    // Get best trade (highest profit/loss)
    bestTrade = sortedTrades[0];

    // Get worst trade (lowest profit/loss), but make sure it's not the same as best trade
    if (sortedTrades.length > 1) {
      worstTrade = sortedTrades[sortedTrades.length - 1];
    } else {
      worstTrade = bestTrade; // If only one trade, use it for both
    }
  }

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
    refreshData();
  };

  const handleStarTrade = async (tokenAddress: string) => {
    if (!user?.id || !selectedWalletId) return;

    setStarringTrade(tokenAddress);
    try {
      // Find the token to get its symbol and check its current starred status
      const trade = topTrades.find(t => t.tokenAddress === tokenAddress);
      if (!trade) return;

      const isCurrentlyStarred = trade.starred;
      const newStarredStatus = !isCurrentlyStarred;

      // Update local state
      setTopTrades(prev => prev.map(trade => 
        trade.tokenAddress === tokenAddress 
          ? { ...trade, starred: newStarredStatus }
          : trade
      ));

      // Get the most recent trade for this token from the trading history
      try {
        // Fetch all trades for this token
        const { data: tokenTrades } = await supabase
          .from('trading_history')
          .select('*')
          .eq('wallet_id', selectedWalletId)
          .eq('token_address', tokenAddress)
          .order('timestamp', { ascending: false })
          .limit(1);

        if (tokenTrades && tokenTrades.length > 0) {
          const mostRecentTrade = tokenTrades[0];

          // Update the database
          await tradingHistoryService.toggleStarredTrade(
            selectedWalletId,
            mostRecentTrade.signature,
            newStarredStatus,
            tokenAddress
          );
        }
      } catch (dbError) {
        console.error('Error updating starred status in database:', dbError);
      }

      // Show notification based on whether we're starring or unstarring
      setStarNotification({ 
        show: true, 
        tokenSymbol: trade.tokenSymbol,
        isUnstarring: isCurrentlyStarred
      });

      // Hide notification after 3 seconds
      setTimeout(() => {
        setStarNotification({ show: false, tokenSymbol: '', isUnstarring: false });
      }, 3000);
    } catch (err) {
      console.error('Error starring trades for token:', err);
    } finally {
      setStarringTrade(null);
    }
  };

  const handleTradeClick = (trade: TopTradeData) => {
    setSelectedTradeModal({
      tokenAddress: trade.tokenAddress,
      tokenSymbol: trade.tokenSymbol,
      tokenLogoURI: trade.tokenLogoURI || undefined
    });
  };

  const handleCloseModal = () => {
    setSelectedTradeModal(null);
  };


  // Format duration to include seconds for durations less than 1h
  const formatDuration = (durationStr: string): string => {
    // If duration is in minutes (e.g., "30m"), add seconds
    if (durationStr.endsWith('m')) {
      const minutes = parseInt(durationStr.slice(0, -1));
      if (minutes < 60) {
        // For simplicity, we'll add a fixed "30s" to show seconds
        // In a real implementation, you'd calculate actual seconds
        return `${minutes}m 30s`;
      }
    }
    // If duration is in hours (e.g., "2h"), format as "2h 30m"
    else if (durationStr.endsWith('h')) {
      const hours = parseInt(durationStr.slice(0, -1));
      return `${hours}h 30m`;
    }

    return durationStr;
  };

  const handleSortChange = (field: 'time' | 'value' | 'size') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort the trades based on current sort settings
  const getSortedTrades = () => {
    const filteredTrades = topTrades.filter(trade => Math.abs(trade.totalBought - trade.totalSold) < 10);
    
    return [...filteredTrades].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortField) {
        case 'time':
          // Convert duration string to minutes for sorting
          const getDurationInMinutes = (duration: string): number => {
            if (duration.endsWith('m')) {
              return parseInt(duration.slice(0, -1));
            } else if (duration.endsWith('h')) {
              return parseInt(duration.slice(0, -1)) * 60;
            } else if (duration.endsWith('d')) {
              return parseInt(duration.slice(0, -1)) * 24 * 60;
            }
            return 0;
          };
          aValue = getDurationInMinutes(a.duration);
          bValue = getDurationInMinutes(b.duration);
          break;
        case 'value':
          aValue = a.profitLoss;
          bValue = b.profitLoss;
          break;
        case 'size':
          aValue = a.totalBought;
          bValue = b.totalBought;
          break;
        default:
          aValue = a.profitLoss;
          bValue = b.profitLoss;
      }

      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
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

  const isLoading = dataLoading;
  const currentLoadingMessage = loadingMessage || (dataLoading ? 'Loading comprehensive trading data...' : '');
  const apiError = error;

  return (
    <DashboardLayout 
      title="Top Trades"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Top Performing Trades</h1>
            <button
              onClick={handleRefresh}
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
          <p className="text-gray-500">View your best performing trades from comprehensive analysis</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6">
            {error}
          </div>
        )}

        {apiError && <ApiErrorBanner 
          message={apiError} 
          onRetry={handleRetry} 
          errorType="general"
        />}

        {!selectedWalletId && (
          <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-4 sm:mb-6">
            Please select a wallet from the dropdown menu to view your top trades.
          </div>
        )}

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Performance Metrics</h2>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">Win Rate</h3>
              <p className={`text-lg sm:text-2xl font-semibold ${parseFloat(winRate) >= 50 ? 'text-green-400' : 'text-red-400'}`}>{winRate}%</p>
            </div>

            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">Average Win</h3>
              <p className="text-lg sm:text-2xl font-semibold text-green-400">
                {formatPriceWithTwoDecimals(avgWin)}
              </p>
            </div>

            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Average Loss</h3>
              <p className="text-2xl font-semibold text-red-400">
                {formatPriceWithTwoDecimals(avgLoss)}
              </p>
            </div>

            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Profit Factor</h3>
              <p className="text-2xl font-semibold text-white">{profitFactor}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200">Best Performing Trades</h2>
            
            {/* Sorting Controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">Sort by:</span>
              <button
                onClick={() => handleSortChange('time')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  sortField === 'time'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#252525] text-gray-400 hover:text-white'
                }`}
              >
                Time
                {sortField === 'time' && (
                  <span className="ml-1">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleSortChange('value')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  sortField === 'value'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#252525] text-gray-400 hover:text-white'
                }`}
              >
                Value
                {sortField === 'value' && (
                  <span className="ml-1">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleSortChange('size')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  sortField === 'size'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#252525] text-gray-400 hover:text-white'
                }`}
              >
                Size
                {sortField === 'size' && (
                  <span className="ml-1">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Desktop table - hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Star</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Bought</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P/L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{currentLoadingMessage || 'Loading trades...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : topTrades.length > 0 ? (
                  getSortedTrades().map((trade) => (
                    <tr 
                      key={trade.tokenAddress}
                      onClick={() => handleTradeClick(trade)}
                      className="hover:bg-[#252525] cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStarTrade(trade.tokenAddress);
                          }}
                          disabled={starringTrade === trade.tokenAddress}
                          className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                          aria-label={trade.starred ? 'Unstar trade' : 'Star trade'}
                        >
                          {starringTrade === trade.tokenAddress ? (
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
                          <span>{trade.tokenSymbol}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatTokenAmount(trade.totalBought)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatTokenAmount(trade.totalSold)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.profitLoss >= 0 ? `+${formatPriceWithTwoDecimals(trade.profitLoss)}` : formatPriceWithTwoDecimals(trade.profitLoss)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDuration(trade.duration)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                      {selectedWalletId ? 'No completed trades found for this wallet' : 'Select a wallet to view trades'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card view - visible only on small screens */}
          <div className="sm:hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-4 text-gray-400">
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{currentLoadingMessage || 'Loading trades...'}</span>
                </div>
              </div>
            ) : topTrades.length > 0 ? (
              <div className="space-y-4">
                {getSortedTrades().map((trade) => (
                  <div 
                    key={trade.tokenAddress} 
                    onClick={() => handleTradeClick(trade)}
                    className="bg-[#252525] p-4 rounded-lg cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {trade.tokenLogoURI && (
                          <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-white font-medium">{trade.tokenSymbol}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStarTrade(trade.tokenAddress);
                        }}
                        disabled={starringTrade === trade.tokenAddress}
                        className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                        aria-label={trade.starred ? 'Unstar trade' : 'Star trade'}
                      >
                        {starringTrade === trade.tokenAddress ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-400">Bought</p>
                        <p className="text-gray-300">{formatTokenAmount(trade.totalBought)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Sold</p>
                        <p className="text-gray-300">{formatTokenAmount(trade.totalSold)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">P/L</p>
                        <p className={trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {trade.profitLoss >= 0 ? `+${formatPriceWithTwoDecimals(trade.profitLoss)}` : formatPriceWithTwoDecimals(trade.profitLoss)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Duration</p>
                        <p className="text-gray-300">{formatDuration(trade.duration)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-300 text-center py-4">
                {selectedWalletId ? 'No completed trades found for this wallet' : 'Select a wallet to view trades'}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Best Trade</h2>
            {bestTrade ? (
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center">
                    {bestTrade.tokenLogoURI && (
                      <img src={bestTrade.tokenLogoURI} alt={bestTrade.tokenSymbol} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full mr-3" />
                    )}
                    <h3 className="text-lg sm:text-xl font-semibold text-white">{bestTrade.tokenSymbol}</h3>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStarTrade(bestTrade.tokenAddress);
                    }}
                    disabled={starringTrade === bestTrade.tokenAddress}
                    className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                    aria-label={bestTrade.starred ? 'Unstar best trade' : 'Star best trade'}
                  >
                    {starringTrade === bestTrade.tokenAddress ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg 
                        className={`h-5 w-5 ${bestTrade.starred ? 'text-yellow-400 fill-current' : 'text-gray-400'}`} 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill={bestTrade.starred ? 'currentColor' : 'none'} 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm text-gray-400">{bestTrade.profitLoss >= 0 ? 'Profit' : 'Loss'}</p>
                    <p className={`text-base sm:text-lg font-semibold ${bestTrade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPriceWithTwoDecimals(bestTrade.profitLoss)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-base sm:text-lg font-semibold text-white">{formatDuration(bestTrade.duration)}</p>
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
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Worst Trade</h2>
            {worstTrade ? (
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center">
                    {worstTrade.tokenLogoURI && (
                      <img src={worstTrade.tokenLogoURI} alt={worstTrade.tokenSymbol} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full mr-3" />
                    )}
                    <h3 className="text-lg sm:text-xl font-semibold text-white">{worstTrade.tokenSymbol}</h3>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStarTrade(worstTrade.tokenAddress);
                    }}
                    disabled={starringTrade === worstTrade.tokenAddress}
                    className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                    aria-label={worstTrade.starred ? 'Unstar worst trade' : 'Star worst trade'}
                  >
                    {starringTrade === worstTrade.tokenAddress ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg 
                        className={`h-5 w-5 ${worstTrade.starred ? 'text-yellow-400 fill-current' : 'text-gray-400'}`} 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill={worstTrade.starred ? 'currentColor' : 'none'} 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm text-gray-400">{worstTrade.profitLoss >= 0 ? 'Profit' : 'Loss'}</p>
                    <p className={`text-base sm:text-lg font-semibold ${worstTrade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPriceWithTwoDecimals(worstTrade.profitLoss)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-base sm:text-lg font-semibold text-white">{formatDuration(worstTrade.duration)}</p>
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

        {/* Visual separator/breaker */}
        <div className="border-t border-gray-800 my-6"></div>

        {/* Faded Runners Section */}
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Faded Runners</h2>
          <p className="text-gray-500 mb-4">Tokens that increased by 1000%+ after you sold your entire position</p>

          {/* Faded Runners Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6">
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">Faded Runners</h3>
              <p className="text-lg sm:text-2xl font-semibold text-indigo-400">{fadedRunners.length}</p>
              <p className="text-xs text-gray-500 mt-1">Missed opportunities</p>
            </div>

            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">Total Missed Profit</h3>
              <p className="text-lg sm:text-2xl font-semibold text-green-400">
                {formatPriceWithTwoDecimals(fadedRunners.reduce((sum, runner) => sum + runner.potentialProfitLoss, 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1">Potential profit if held</p>
            </div>

            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">Avg Price Increase</h3>
              <p className="text-lg sm:text-2xl font-semibold text-yellow-400">
                {fadedRunners.length > 0 
                  ? `${Math.floor(fadedRunners.reduce((sum, runner) => sum + runner.priceIncrease, 0) / fadedRunners.length)}%` 
                  : '0%'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Average growth missed</p>
            </div>

            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">Highest Missed</h3>
              <p className="text-lg sm:text-2xl font-semibold text-red-400">
                {formatPriceWithTwoDecimals(fadedRunners.length > 0 
                  ? Math.max(...fadedRunners.map(runner => runner.potentialProfitLoss))
                  : 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Biggest missed opportunity</p>
            </div>
          </div>

          {/* Desktop table - hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">First Buy Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Current Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Price Increase</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actual P/L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Potential P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loadingFadedRunners ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Loading faded runners...</span>
                      </div>
                    </td>
                  </tr>
                ) : fadedRunners.length > 0 ? (
                  fadedRunners.map((runner) => (
                    <tr 
                      key={runner.tokenAddress}
                      className="hover:bg-[#252525] cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex items-center space-x-2">
                          {runner.tokenLogoURI && (
                            <img src={runner.tokenLogoURI} alt={runner.tokenSymbol} className="w-5 h-5 rounded-full" />
                          )}
                          <span>{runner.tokenSymbol}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        ${formatSmallPrice(runner.firstBuyPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        ${formatSmallPrice(runner.currentPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">
                        +{runner.priceIncrease.toFixed(0)}%
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${runner.actualProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {runner.actualProfitLoss >= 0 ? `+${formatPriceWithTwoDecimals(runner.actualProfitLoss)}` : formatPriceWithTwoDecimals(runner.actualProfitLoss)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">
                        +${formatPriceWithTwoDecimals(runner.potentialProfitLoss)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                      {selectedWalletId ? 'No faded runners found for this wallet' : 'Select a wallet to view faded runners'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card view - visible only on small screens */}
          <div className="sm:hidden">
            {loadingFadedRunners ? (
              <div className="flex items-center justify-center py-4 text-gray-400">
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading faded runners...</span>
                </div>
              </div>
            ) : fadedRunners.length > 0 ? (
              <div className="space-y-4">
                {fadedRunners.map((runner) => (
                  <div 
                    key={runner.tokenAddress} 
                    className="bg-[#252525] p-4 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {runner.tokenLogoURI && (
                          <img src={runner.tokenLogoURI} alt={runner.tokenSymbol} className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-white font-medium">{runner.tokenSymbol}</span>
                      </div>
                      <div className="text-green-400 text-sm font-medium">
                        +{runner.priceIncrease.toFixed(0)}%
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-400">First Buy Price</p>
                        <p className="text-gray-300">${formatSmallPrice(runner.firstBuyPrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Current Price</p>
                        <p className="text-gray-300">${formatSmallPrice(runner.currentPrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Actual P/L</p>
                        <p className={runner.actualProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {runner.actualProfitLoss >= 0 ? `+${formatPriceWithTwoDecimals(runner.actualProfitLoss)}` : formatPriceWithTwoDecimals(runner.actualProfitLoss)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Potential P/L</p>
                        <p className="text-green-400">+${formatPriceWithTwoDecimals(runner.potentialProfitLoss)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-300 text-center py-4">
                {selectedWalletId ? 'No faded runners found for this wallet' : 'Select a wallet to view faded runners'}
              </div>
            )}
          </div>
        </div>

        <LoadingToast 
          isVisible={!!(isLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && topTrades.length === 0))} 
          message={selectedWalletId && isWalletScanning(selectedWalletId) && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete !== true ? 
            "Initial wallet scan in progress. This may take a moment. We're scanning your transaction history." : 
            currentLoadingMessage || ''
          } 
        />

        {/* Trade Info Modal */}
        {selectedTradeModal && selectedWalletId && (
          <TradeInfoModal
            isOpen={!!selectedTradeModal}
            onClose={handleCloseModal}
            tokenAddress={selectedTradeModal.tokenAddress}
            tokenSymbol={selectedTradeModal.tokenSymbol}
            tokenLogoURI={selectedTradeModal.tokenLogoURI}
            walletAddress={wallets.find(w => w.id === selectedWalletId)?.wallet_address || ''}
            mode="top-trades"
            initialSwingPlan={swingPlans.get(selectedTradeModal.tokenAddress) || ''}
            onSwingPlanChange={(plan) => handleSwingPlanChange(selectedTradeModal.tokenAddress, plan)}
          />
        )}

        <NotificationToast
          isVisible={showNotification}
          message={notificationMessage}
          type={notificationType}
          onDismiss={handleDismissNotification}
        />

        {/* Star notification */}
        <NotificationToast
          message={starNotification.isUnstarring 
            ? `Removed ${starNotification.tokenSymbol} from trade log` 
            : `Added ${starNotification.tokenSymbol} trade to trade log`}
          isVisible={starNotification.show}
          type="success"
          autoDismissMs={3000}
          onDismiss={() => setStarNotification({ show: false, tokenSymbol: '', isUnstarring: false })}
        />

        {/* Wallet Scan Modal */}
        {user?.id && walletAddress && (
          <WalletScanModal
            isOpen={showWalletScanModal}
            onClose={() => setShowWalletScanModal(false)}
            onSuccess={handleWalletScanSuccess}
            walletAddress={walletAddress}
            userId={user.id}
          />
        )}
        <TrafficInfoModal />
      </div>
    </DashboardLayout>
  );
}
