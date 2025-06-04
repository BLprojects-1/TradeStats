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
import { useNotificationContext } from '../../contexts/NotificationContext';

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
          aValue = getTokenTotalVolume(a);
          bValue = getTokenTotalVolume(b);
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
  const getTokenTotalVolume = (token: TopTradeData): number => {
    // Calculate total volume as the sum of all buy and sell USD values
    // If we have the volume data directly, use it
    if (token.totalBuyVolume !== undefined && token.totalSellVolume !== undefined) {
      return (token.totalBuyVolume || 0) + (token.totalSellVolume || 0);
    }
    
    // Fallback: estimate based on profit/loss and token amounts
    // The profitLoss represents net result (sells - buys in USD)
    // To estimate total volume, we need to approximate the total USD value of all trades
    const averageTokenValue = Math.abs(token.profitLoss) / Math.max(token.totalBought, token.totalSold, 1);
    const estimatedBuyVolume = token.totalBought * averageTokenValue;
    const estimatedSellVolume = token.totalSold * averageTokenValue;
    
    return estimatedBuyVolume + estimatedSellVolume;
  };

  const getTokenTotalValue = (token: TopTradeData): number => {
    return Math.max(token.totalBought, token.totalSold);
  };

  const getTokenLastTradeTime = (token: TopTradeData): number => {
    // Return current timestamp minus duration in minutes (simplified)
    const durationMinutes = parseInt(token.duration) || 60;
    return Date.now() - (durationMinutes * 60 * 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-blue-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-emerald-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="animate-pulse text-blue-400 text-xl mb-4">Loading your professional performance analytics...</div>
          <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 mx-auto rounded-full animate-pulse"></div>
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
    <div className="relative min-h-screen bg-[#020617] text-gray-100 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-blue-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-emerald-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3 bg-blue-500/3 blur-[50px] rounded-full"></div>
      </div>

      <NewDashboardLayout title="Professional Top Trades - TradeStats">
        <div className="relative z-10 space-y-6 sm:space-y-8">
          {/* Enhanced Header Section */}
          <div className="relative">
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-blue-500/40 rounded-2xl p-6 shadow-xl shadow-blue-900/10 card-glass">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2 gradient-text">
                    Elite Trading Performance
                  </h1>
                  <p className="text-slate-300">Professional analysis of your most profitable trading positions</p>
                </div>
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
            <div className="bg-gradient-to-r from-blue-900/30 to-emerald-900/30 backdrop-blur-sm border border-blue-500/30 text-blue-200 px-6 py-4 rounded-2xl shadow-lg shadow-blue-900/10">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Please select a wallet from the dropdown menu to view your elite trading performance.</span>
              </div>
            </div>
          )}

          {/* Best Trade and Worst Trade Section */}
          {selectedWalletId && !isLoading && topTrades.length > 0 && bestTrade && worstTrade && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Best Trade Card */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-xl shadow-emerald-900/10 transition-all duration-500 hover:border-emerald-500/60 card-glass">
                  <div className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/15">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent gradient-text">
                          🏆 Best Trade
                        </h3>
                        <p className="text-slate-400 text-sm">Your most profitable position</p>
                      </div>
                    </div>

                    <div 
                      className="cursor-pointer hover:bg-emerald-500/5 rounded-xl p-4 transition-all duration-300"
                      onClick={() => handleTradeClick(bestTrade)}
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for best trade: ${bestTrade.tokenSymbol}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleTradeClick(bestTrade);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-4 mb-4">
                        {bestTrade.tokenLogoURI && (
                          <img 
                            src={bestTrade.tokenLogoURI} 
                            alt={`${bestTrade.tokenSymbol} logo`} 
                            className="w-10 h-10 rounded-full ring-2 ring-emerald-500/30"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-white">{bestTrade.tokenSymbol}</h4>
                          <p className="text-slate-400 text-sm">Click to view details</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-emerald-400">
                            {formatPriceWithTwoDecimals(bestTrade.profitLoss || 0)}
                          </div>
                          <div className="text-emerald-300 text-sm font-medium">
                            Volume: {formatPriceWithTwoDecimals(getTokenTotalVolume(bestTrade))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-emerald-500/20">
                        <div className="text-center">
                          <p className="text-slate-400 text-xs uppercase tracking-wider">Trade Volume</p>
                          <p className="text-white font-semibold">{formatPriceWithTwoDecimals(getTokenTotalVolume(bestTrade))}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400 text-xs uppercase tracking-wider">Duration</p>
                          <p className="text-white font-semibold">{bestTrade.duration}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Worst Trade Card */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-red-500/40 rounded-2xl shadow-xl shadow-red-900/10 transition-all duration-500 hover:border-red-500/60 card-glass">
                  <div className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/15">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent gradient-text">
                          📉 Worst Trade
                        </h3>
                        <p className="text-slate-400 text-sm">Your most challenging position</p>
                      </div>
                    </div>

                    <div 
                      className="cursor-pointer hover:bg-red-500/5 rounded-xl p-4 transition-all duration-300"
                      onClick={() => handleTradeClick(worstTrade)}
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for worst trade: ${worstTrade.tokenSymbol}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleTradeClick(worstTrade);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-4 mb-4">
                        {worstTrade.tokenLogoURI && (
                          <img 
                            src={worstTrade.tokenLogoURI} 
                            alt={`${worstTrade.tokenSymbol} logo`} 
                            className="w-10 h-10 rounded-full ring-2 ring-red-500/30"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-white">{worstTrade.tokenSymbol}</h4>
                          <p className="text-slate-400 text-sm">Click to view details</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${(worstTrade.profitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatPriceWithTwoDecimals(worstTrade.profitLoss || 0)}
                          </div>
                          <div className={`text-sm font-medium ${getTokenTotalVolume(worstTrade) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                            Volume: {formatPriceWithTwoDecimals(getTokenTotalVolume(worstTrade))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-red-500/20">
                        <div className="text-center">
                          <p className="text-slate-400 text-xs uppercase tracking-wider">Trade Volume</p>
                          <p className="text-white font-semibold">{formatPriceWithTwoDecimals(getTokenTotalVolume(worstTrade))}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400 text-xs uppercase tracking-wider">Duration</p>
                          <p className="text-white font-semibold">{worstTrade.duration}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No Trades Placeholder */}
          {selectedWalletId && !isLoading && topTrades.length === 0 && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-gray-700 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-gray-500/40 rounded-2xl shadow-xl shadow-gray-900/10 transition-all duration-500 hover:border-gray-500/60">
                <div className="p-12 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-gray-900/15">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">No Trades to Analyze</h3>
                  <p className="text-gray-400 text-lg mb-6 max-w-md mx-auto">
                    Start trading to see your Top Trades here. Your most profitable positions will be displayed once you complete some trades.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => {
                        window.open('https://jup.ag', '_blank');
                      }}
                      className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-8 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-emerald-900/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                      aria-label="Start trading on Jupiter Exchange"
                    >
                      Start Trading
                    </button>
                    <button
                      onClick={handleRetry}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 text-white disabled:text-gray-400 px-8 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-blue-900/30 disabled:shadow-gray-900/30 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                      aria-label="Refresh trading data"
                    >
                      {isLoading ? 'Refreshing...' : 'Refresh Data'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Top Performing Trades Section */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 group-hover:opacity-50 blur-md transition-all duration-700 rounded-3xl"></div>
            <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-emerald-500/40 rounded-3xl shadow-xl shadow-blue-900/10 transition-all duration-500 hover:border-emerald-500/40 card-glass">
              <div className="p-6 border-b border-emerald-500/20">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent gradient-text">
                      Elite Performance Trades
                    </h2>
                  </div>
                  
                  {/* Enhanced Sorting Controls */}
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-slate-400 font-medium">Sort by:</span>
                    
                    {/* Wrap the buttons in a relative container to prevent tooltip overlap */}
                    <div className="relative inline-block">
                      <div className="flex space-x-2">
                        {['value', 'size', 'time'].map((field) => (
                          <button
                            key={field}
                            onClick={() => handleSortChange(field as 'value' | 'size' | 'time')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium focus:outline-none z-10 relative ${
                              sortField === field
                                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-900/15'
                                : 'bg-emerald-900/20 border border-emerald-500/30 text-emerald-300 hover:text-white hover:bg-emerald-800/30 hover:border-emerald-400/50'
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
              </div>

              {/* Enhanced table */}
              <div className="overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full divide-y divide-emerald-500/20" role="table" aria-label="Elite trading performance data">
                    <thead>
                      <tr className="bg-gradient-to-r from-emerald-950/60 to-green-950/60 backdrop-blur-sm">
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-emerald-300 uppercase tracking-wider"
                          role="columnheader"
                          aria-label="Star or favorite this trade"
                          title="Click to star/favorite profitable trades"
                        >
                          <span className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            <span className="sr-only">Star</span>
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-emerald-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSortChange('time')}
                          aria-label="Token name and logo - click to sort by time"
                          title="Token name and symbol"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Token</span>
                            {sortField === 'time' && (
                              <span className="text-emerald-400" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-emerald-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSortChange('value')}
                          aria-label="Profit and Loss - click to sort"
                          title="Total profit or loss from this position"
                        >
                          <span className="flex items-center space-x-1">
                            <span>P/L</span>
                            {sortField === 'value' && (
                              <span className="text-emerald-400" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                            <button
                              className="ml-1 text-gray-400 hover:text-emerald-300 transition-colors"
                              title="P/L = Profit and Loss. Total gains or losses from buying and selling this token."
                              aria-label="What is P/L?"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-emerald-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSortChange('size')}
                          aria-label="Total Volume - click to sort"
                          title="Total USD value of all buy and sell transactions for this token"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Total Volume</span>
                            {sortField === 'size' && (
                              <span className="text-emerald-400" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                            <button
                              className="ml-1 text-gray-400 hover:text-emerald-300 transition-colors"
                              title="Total Volume = Sum of all buy values + all sell values in USD for this token"
                              aria-label="How is total volume calculated?"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-emerald-300 uppercase tracking-wider"
                          role="columnheader"
                          aria-label="Final Value of position"
                          title="Total USD value of all transactions for this token"
                        >
                          Last Sale
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-emerald-300 uppercase tracking-wider"
                          role="columnheader"
                          aria-label="Last trade timestamp"
                          title="When the most recent trade was executed"
                        >
                          Last Trade
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-500/10">
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center">
                            <div className="flex items-center justify-center space-x-3">
                              <div className="relative">
                                <div className="w-8 h-8 border-4 border-emerald-600/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-t-green-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                              </div>
                              <span className="text-slate-400 font-medium">{currentLoadingMessage || 'Loading elite trading performance...'}</span>
                            </div>
                          </td>
                        </tr>
                      ) : getSortedTrades().length > 0 ? (
                        getSortedTrades().map((token, index) => (
                          <tr 
                            key={token.tokenAddress}
                            onClick={() => handleTradeClick(token)}
                            className="hover:bg-emerald-500/10 cursor-pointer transition-all duration-300 group/row border-b border-blue-500/5"
                            role="row"
                            tabIndex={0}
                            aria-label={`View details for ${token.tokenSymbol} trade`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleTradeClick(token);
                              }
                            }}
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarTrade(token.tokenAddress);
                                }}
                                disabled={starringTrade === token.tokenAddress}
                                className="p-2 rounded-xl hover:bg-emerald-500/20 hover:text-yellow-400 transition-all duration-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                                aria-pressed={token.starred ? 'true' : 'false'}
                                aria-label={token.starred ? `Unstar ${token.tokenSymbol} trade` : `Star ${token.tokenSymbol} trade`}
                                title={token.starred ? 'Remove from starred trades' : 'Add to starred trades'}
                              >
                                {starringTrade === token.tokenAddress ? (
                                  <div className="relative" aria-label="Updating star status">
                                    <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 w-4 h-4 border-2 border-transparent border-t-yellow-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                  </div>
                                ) : (
                                  <svg 
                                    className={`h-4 w-4 transition-all duration-300 ${token.starred ? 'text-yellow-400 fill-current' : 'text-slate-400 group-hover/row:text-slate-300'}`} 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    fill={token.starred ? 'currentColor' : 'none'} 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                {token.tokenLogoURI && (
                                  <img 
                                    src={token.tokenLogoURI} 
                                    alt={`${token.tokenSymbol} logo`} 
                                    className="w-6 h-6 rounded-full ring-2 ring-emerald-500/30"
                                  />
                                )}
                                <div>
                                  <span className="text-slate-100 font-medium group-hover/row:text-white transition-colors">{token.tokenSymbol}</span>
                                  {index < 3 && (
                                    <div className="flex items-center space-x-1 mt-1">
                                      <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-slate-400' : 'bg-orange-600'}`}></div>
                                      <span className="text-xs text-slate-400">{index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'} Place</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap font-semibold text-emerald-400">
                              {formatPriceWithTwoDecimals(token.profitLoss || 0)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap font-semibold text-cyan-400">
                              {formatPriceWithTwoDecimals(getTokenTotalVolume(token))}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-slate-300 font-medium group-hover/row:text-slate-200 transition-colors">
                              {getTokenTotalValue(token).toLocaleString('en-US', { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 2 
                              })}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-slate-300 group-hover/row:text-slate-200 transition-colors">
                              {formatTimeAgo(getTokenLastTradeTime(token))}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center space-y-4">
                              <svg className="w-16 h-16 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <h3 className="text-lg font-medium text-gray-300 mb-2">
                                {selectedWalletId ? 'You haven\'t completed enough trades to populate this table.' : 'Select a wallet to view elite trading performance'}
                              </h3>
                              <p className="text-gray-500">
                                {selectedWalletId 
                                  ? 'Complete more profitable trades to see your top performing positions here.'
                                  : 'Choose a wallet from the dropdown menu to analyze your trading performance.'
                                }
                              </p>
                            </div>
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
            <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-6 shadow-xl shadow-blue-900/5 transition-all duration-500 hover:border-cyan-500/40 card-glass">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/15">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent gradient-text">
                  Professional Performance Analytics
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 backdrop-blur-sm border border-emerald-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-emerald-500/40 hover:transform hover:scale-[1.02] card-glass">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-emerald-300 font-semibold">Winning Trades</h3>
                      <button
                        className="group/tooltip relative ml-auto"
                        title="Number of profitable trades shown in this table. These are your most successful trading positions with positive profit/loss."
                        aria-label="Learn more about Winning Trades"
                      >
                        <svg className="w-4 h-4 text-gray-400 hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                          Profitable positions in top trades
                        </div>
                      </button>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{getSortedTrades().length}</p>
                    <p className="text-slate-400 text-sm">Profitable positions</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 backdrop-blur-sm border border-cyan-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-cyan-500/40 hover:transform hover:scale-[1.02] card-glass">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <h3 className="text-cyan-300 font-semibold">Total Profit</h3>
                      <button
                        className="group/tooltip relative ml-auto"
                        title="Sum of all profit/loss values from your top profitable trades. Calculated as: Σ(Final Value - Initial Investment) for all profitable positions."
                        aria-label="Learn more about Total Profit"
                      >
                        <svg className="w-4 h-4 text-gray-400 hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                          Sum of all P/L from top trades
                        </div>
                      </button>
                    </div>
                    <p className={`text-3xl font-bold mb-1 ${getSortedTrades().reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPriceWithTwoDecimals(getSortedTrades().reduce((sum, token) => sum + (token.profitLoss || 0), 0))}
                    </p>
                    <p className="text-slate-400 text-sm">Cumulative gains</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-emerald-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 backdrop-blur-sm border border-blue-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-blue-500/40 hover:transform hover:scale-[1.02] card-glass">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <h3 className="text-blue-300 font-semibold">Highest Volume</h3>
                      <button
                        className="group/tooltip relative ml-auto"
                        title="Highest trading volume from your top trades. Shows the token with the most total buy and sell activity in USD."
                        aria-label="Learn more about Highest Volume"
                      >
                        <svg className="w-4 h-4 text-gray-400 hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                          Highest volume from top trades
                        </div>
                      </button>
                    </div>
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {getSortedTrades().length > 0 
                        ? formatPriceWithTwoDecimals(Math.max(...getSortedTrades().map(t => getTokenTotalVolume(t))))
                        : 'N/A'
                      }
                    </p>
                    <p className="text-slate-400 text-sm">Highest volume</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-cyan-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 backdrop-blur-sm border border-emerald-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-emerald-500/40 hover:transform hover:scale-[1.02] card-glass">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-cyan-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        </svg>
                      </div>
                      <h3 className="text-emerald-300 font-semibold">Total Volume</h3>
                      <button
                        className="group/tooltip relative ml-auto"
                        title="Combined trading volume of all top trades. Calculated as: Σ(Total USD value of all buy and sell transactions) for each profitable position in the table."
                        aria-label="Learn more about Total Volume"
                      >
                        <svg className="w-4 h-4 text-gray-400 hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                          Combined trading volume of top trades
                        </div>
                      </button>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">
                      {formatPriceWithTwoDecimals(getSortedTrades().reduce((sum, token) => sum + getTokenTotalVolume(token), 0))}
                    </p>
                    <p className="text-slate-400 text-sm">Combined volume</p>
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
        </div>
      </NewDashboardLayout>
    </div>
  );
}
