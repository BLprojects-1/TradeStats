import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import NewDashboardLayout from '../../components/layouts/NewDashboardLayout';
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

  // Add missing helper functions
  const formatPercentage = (percentage: number): string => {
    return `${percentage.toFixed(2)}%`;
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else {
      return `${minutes}m ago`;
    }
  };

  // Calculate additional properties from TopTradeData
  const getTokenPercentageReturn = (token: TopTradeData): number => {
    if (token.totalBought === 0) return 0;
    return ((token.totalSold - token.totalBought) / token.totalBought) * 100;
  };

  const getTokenTotalValue = (token: TopTradeData): number => {
    return Math.max(token.totalBought, token.totalSold);
  };

  const getTokenTradeCount = (token: TopTradeData): number => {
    // Estimate trade count based on volume (simplified)
    return Math.max(2, Math.floor((token.totalBought + token.totalSold) / 1000));
  };

  const getTokenLastTradeTime = (token: TopTradeData): number => {
    // Return current timestamp minus duration in minutes (simplified)
    const durationMinutes = parseInt(token.duration) || 60;
    return Date.now() - (durationMinutes * 60 * 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="animate-pulse text-indigo-400 text-xl mb-4">Loading your top trades...</div>
          <div className="w-32 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full animate-pulse"></div>
        </div>
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
    <div className="relative min-h-screen bg-[#0a0a0f] text-gray-100 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3 bg-indigo-500/3 blur-[50px] rounded-full"></div>
      </div>

      <NewDashboardLayout title="Top Trades">
        <div className="relative z-10 space-y-6 sm:space-y-8">
          {/* Enhanced Header Section */}
          <div className="relative">
            <div className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    Top Trades
                  </h1>
                  <p className="text-gray-300">Your most profitable trading positions</p>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing || isOnCooldown}
                  className={`
                    group/btn flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg
                    ${isRefreshing || isOnCooldown
                      ? 'bg-gray-700/50 cursor-not-allowed text-gray-400 shadow-gray-900/15'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-900/15'
                    }
                  `}
                >
                  <svg
                    className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform duration-300'}`}
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
            </div>
          </div>

          {error && (
            <div className="bg-gradient-to-r from-red-900/30 to-red-800/30 backdrop-blur-sm border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl shadow-lg shadow-red-900/10">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {apiError && <ApiErrorBanner 
            message={apiError} 
            onRetry={handleRetry} 
            errorType="general"
          />}

          {!selectedWalletId && (
            <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 backdrop-blur-sm border border-indigo-500/30 text-indigo-200 px-6 py-4 rounded-2xl shadow-lg shadow-indigo-900/10">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Please select a wallet from the dropdown menu to view your top trades.</span>
              </div>
            </div>
          )}

          {/* Enhanced Top Performing Trades Section */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 group-hover:opacity-50 blur-md transition-all duration-700 rounded-3xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-emerald-500/40 rounded-3xl shadow-xl shadow-indigo-900/10 transition-all duration-500 hover:border-emerald-500/40">
              <div className="p-6 border-b border-emerald-500/20">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                      Top Performing Trades
                    </h2>
                  </div>
                  
                  {/* Enhanced Sorting Controls */}
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-400 font-medium">Sort by:</span>
                    <div className="flex space-x-2">
                      {['value', 'size', 'time'].map((field) => (
                        <button
                          key={field}
                          onClick={() => handleSortChange(field as 'value' | 'size' | 'time')}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                            sortField === field
                              ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-900/15'
                              : 'bg-[#252525]/80 text-gray-400 hover:text-white hover:bg-[#303030]'
                          }`}
                        >
                          {field === 'value' ? 'Profit' : field === 'size' ? 'Size' : 'Time'}
                          {sortField === field && (
                            <span className="ml-1">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced table */}
              <div className="overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full divide-y divide-emerald-500/20">
                    <thead>
                      <tr className="bg-gradient-to-r from-emerald-950/60 to-green-950/60 backdrop-blur-sm">
                        {['Star', 'Token', 'P/L', '% Return', 'Final Value', 'Total Trades', 'Last Trade'].map((header) => (
                          <th key={header} className="px-4 py-4 text-left text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-500/10">
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center">
                            <div className="flex items-center justify-center space-x-3">
                              <div className="relative">
                                <div className="w-8 h-8 border-4 border-emerald-600/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-t-green-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                              </div>
                              <span className="text-gray-400 font-medium">{currentLoadingMessage || 'Loading top trades...'}</span>
                            </div>
                          </td>
                        </tr>
                      ) : getSortedTrades().length > 0 ? (
                        getSortedTrades().map((token, index) => (
                          <tr 
                            key={token.tokenAddress}
                            onClick={() => handleTradeClick(token)}
                            className="hover:bg-emerald-500/10 cursor-pointer transition-all duration-300 group/row border-b border-indigo-500/5"
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarTrade(token.tokenAddress);
                                }}
                                disabled={starringTrade === token.tokenAddress}
                                className="p-2 rounded-xl hover:bg-emerald-500/20 hover:text-yellow-400 transition-all duration-300 disabled:opacity-50"
                                aria-label={token.starred ? 'Unstar token' : 'Star token'}
                              >
                                {starringTrade === token.tokenAddress ? (
                                  <div className="relative">
                                    <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 w-4 h-4 border-2 border-transparent border-t-yellow-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                  </div>
                                ) : (
                                  <svg 
                                    className={`h-4 w-4 transition-all duration-300 ${token.starred ? 'text-yellow-400 fill-current' : 'text-gray-400 group-hover/row:text-gray-300'}`} 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    fill={token.starred ? 'currentColor' : 'none'} 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                {token.tokenLogoURI && (
                                  <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-6 h-6 rounded-full ring-2 ring-emerald-500/30" />
                                )}
                                <div>
                                  <span className="text-gray-100 font-medium group-hover/row:text-white transition-colors">{token.tokenSymbol}</span>
                                  {index < 3 && (
                                    <div className="flex items-center space-x-1 mt-1">
                                      <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'}`}></div>
                                      <span className="text-xs text-gray-400">{index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'} Place</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap font-semibold text-emerald-400">
                              {formatPriceWithTwoDecimals(token.profitLoss || 0)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap font-semibold text-emerald-400">
                              {formatPercentage(getTokenPercentageReturn(token))}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 font-medium group-hover/row:text-gray-200 transition-colors">
                              {formatPriceWithTwoDecimals(getTokenTotalValue(token))}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                              {getTokenTradeCount(token)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                              {formatTimeAgo(getTokenLastTradeTime(token))}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                            {selectedWalletId ? 'No profitable trades found for this wallet' : 'Select a wallet to view top trades'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Performance Summary */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-cyan-500/40">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/15">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Performance Summary
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-emerald-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-emerald-500/40 hover:transform hover:scale-[1.02]">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-emerald-300 font-semibold">Winning Trades</h3>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{getSortedTrades().length}</p>
                    <p className="text-gray-400 text-sm">Profitable positions</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-cyan-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-cyan-500/40 hover:transform hover:scale-[1.02]">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <h3 className="text-cyan-300 font-semibold">Total Profit</h3>
                    </div>
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {formatPriceWithTwoDecimals(getSortedTrades().reduce((sum, token) => sum + (token.profitLoss || 0), 0))}
                    </p>
                    <p className="text-gray-400 text-sm">Cumulative gains</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-purple-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-purple-500/40 hover:transform hover:scale-[1.02]">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <h3 className="text-purple-300 font-semibold">Best Return</h3>
                    </div>
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {getSortedTrades().length > 0 
                        ? formatPercentage(Math.max(...getSortedTrades().map(t => getTokenPercentageReturn(t))))
                        : '0%'
                      }
                    </p>
                    <p className="text-gray-400 text-sm">Highest gain</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-orange-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-orange-500/40 hover:transform hover:scale-[1.02]">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-red-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        </svg>
                      </div>
                      <h3 className="text-orange-300 font-semibold">Total Value</h3>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">
                      {formatPriceWithTwoDecimals(getSortedTrades().reduce((sum, token) => sum + getTokenTotalValue(token), 0))}
                    </p>
                    <p className="text-gray-400 text-sm">Current worth</p>
                  </div>
                </div>
              </div>
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
      </NewDashboardLayout>
    </div>
  );
}
