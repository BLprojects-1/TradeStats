import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import NewDashboardLayout from '../../components/layouts/NewDashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice, formatDate, formatTime } from '../../utils/formatters';
import NotificationToast from '../../components/NotificationToast';
import { useProcessedTradingData } from '../../hooks/useProcessedTradingData';
import { ProcessedTrade } from '../../utils/historicalTradeProcessing';
import WalletScanModal from '../../components/WalletScanModal';
import TrafficInfoModal from '../../components/TrafficInfoModal';
import TradeInfoModal from '../../components/TradeInfoModal';
import { useNotificationContext } from '../../contexts/NotificationContext';

const TRADES_PER_PAGE = 10; // Reduce to 10 trades per page

export default function TradingHistory() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning } = useWalletSelection();
  const router = useRouter();

  // New unified notification system
  const { showLoading, showSuccess, showError, replaceNotification } = useNotificationContext();

  const {
    data: trades,
    loading: dataLoading,
    error,
    refreshData
  } = useProcessedTradingData({
    autoLoad: false, // Don't auto-load data to prevent historicalPriceService from running on refresh
    dataType: 'tradingHistory'
  });

  // State for refresh functionality
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  const [showWalletScanModal, setShowWalletScanModal] = useState(false);

  // Add missing state variables
  const [starringTrade, setStarringTrade] = useState<string | null>(null);
  const [swingPlans, setSwingPlans] = useState<Map<string, string>>(new Map());
  const [selectedTradeModal, setSelectedTradeModal] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenLogoURI?: string;
  } | null>(null);

  // Get the wallet address from the selected wallet
  const selectedWallet = wallets.find(w => w.id === selectedWalletId);
  const walletAddress = selectedWallet?.wallet_address || '';

  // Cooldown management
  const cooldownMs = 120000; // 2 minutes
  const isOnCooldown = cooldownTimeLeft > 0;

  // Update cooldown timer
  useEffect(() => {
    if (cooldownTimeLeft > 0) {
      const timer = setInterval(() => {
        const newTimeLeft = Math.max(0, cooldownMs - (Date.now() - lastRefreshTime));
        setCooldownTimeLeft(newTimeLeft);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownTimeLeft, lastRefreshTime, cooldownMs]);

  // Enhanced refresh handler with notifications
  const handleRefresh = async () => {
    // Check if on cooldown
    if (Date.now() - lastRefreshTime < cooldownMs) {
      const timeLeft = Math.ceil((cooldownMs - (Date.now() - lastRefreshTime)) / 1000);
      showError(`Please wait ${timeLeft} seconds before refreshing again.`);
      return;
    }

    // Check if wallet is selected
    if (!user?.id || !selectedWalletId) {
      showError('Please select a wallet first.');
      return;
    }

    // Show loading notification
    const loadingId = showLoading('Loading comprehensive trading data...');
    setIsRefreshing(true);

    try {
      await refreshData();
      
      // Replace loading with success
      replaceNotification(loadingId, 'Trading data refreshed successfully!', 'success');
      setLastRefreshTime(Date.now());
      setCooldownTimeLeft(cooldownMs);
    } catch (error) {
      // Replace loading with error
      replaceNotification(loadingId, 'Failed to refresh trading data.', 'error');
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [tokenFilter, setTokenFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTrades, setTotalTrades] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<'type' | 'amount' | 'priceUSD' | 'valueUSD' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Create a local copy of the trades data that we can modify
  const [localTrades, setLocalTrades] = useState<ProcessedTrade[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Update total trades and pages when localTrades change
  useEffect(() => {
    if (localTrades.length > 0) {
      setTotalTrades(localTrades.length);
      setTotalPages(Math.ceil(localTrades.length / TRADES_PER_PAGE));
      console.log(`✅ Loaded ${localTrades.length} trading history entries`);
    } else {
      setTotalTrades(0);
      setTotalPages(1);
    }
  }, [localTrades]);

  const handleRetry = () => {
    refreshData();
  };

  // Update local trades when the data changes
  useEffect(() => {
    if (trades) {
      setLocalTrades(trades);
    }
  }, [trades]);

  // Filter trades based on the selected token filter
  const filteredTrades = localTrades.filter(trade => {
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

  // Paginate trades
  const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
  const endIndex = startIndex + TRADES_PER_PAGE;
  const paginatedTrades = sortedTrades.slice(startIndex, endIndex);
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

  // Add missing helper functions
  const formatPrice = (price: number): string => {
    if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    } else if (price < 1) {
      return `$${price.toFixed(4)}`;
    } else {
      return `$${price.toFixed(2)}`;
    }
  };

  const formatPriceWithTwoDecimals = (price: number): string => {
    return `$${price.toFixed(2)}`;
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

  // Add missing handler functions
  const handleStarTrade = async (tokenAddress: string) => {
    if (!user?.id || !selectedWalletId) return;

    setStarringTrade(tokenAddress);
    try {
      // Find the token to get its symbol and check its current starred status
      const trade = localTrades.find(t => t.tokenAddress === tokenAddress);
      if (!trade) return;

      const isCurrentlyStarred = trade.starred;
      const newStarredStatus = !isCurrentlyStarred;

      // Update local state
      setLocalTrades(prev => prev.map(trade => 
        trade.tokenAddress === tokenAddress 
          ? { ...trade, starred: newStarredStatus }
          : trade
      ));

      // Note: Database update would happen here in a real implementation
      console.log(`${newStarredStatus ? 'Starred' : 'Unstarred'} ${trade.tokenSymbol}`);
    } catch (err) {
      console.error('Error starring trades for token:', err);
    } finally {
      setStarringTrade(null);
    }
  };

  const handleTradeClick = (trade: ProcessedTrade) => {
    setSelectedTradeModal({
      tokenAddress: trade.tokenAddress,
      tokenSymbol: trade.tokenSymbol,
      tokenLogoURI: trade.tokenLogoURI || undefined
    });
  };

  const handleCloseModal = () => {
    setSelectedTradeModal(null);
  };

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

  const handleWalletScanSuccess = (result: { newTradesCount: number, message: string }) => {
    console.log('Wallet scan completed:', result);
    // Refresh data after successful scan
    refreshData();
  };

  const getSortedTrades = () => {
    if (!sortField) return sortedTrades;
    
    return [...sortedTrades].sort((a, b) => {
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
    });
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
          <div className="animate-pulse text-indigo-400 text-xl mb-4">Loading your trading history...</div>
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

      <NewDashboardLayout title="Trading History">
        <div className="relative z-10 space-y-6 sm:space-y-8">
          {/* Enhanced Header Section */}
          <div className="relative">
            <div className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    Trading History
                  </h1>
                  <p className="text-gray-300">Complete transaction history from comprehensive analysis</p>
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
                      ? `Wait ${Math.ceil(cooldownTimeLeft / 1000)}s`
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
                <span>Please select a wallet from the dropdown menu to view your trading history.</span>
              </div>
            </div>
          )}

          {/* Enhanced Trading History Section */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 opacity-0 group-hover:opacity-50 blur-md transition-all duration-700 rounded-3xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-violet-500/40 rounded-3xl shadow-xl shadow-indigo-900/10 transition-all duration-500 hover:border-violet-500/40">
              <div className="p-6 border-b border-indigo-500/20">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                      All Transactions
                    </h2>
                  </div>
                  
                  {/* Enhanced Sorting Controls */}
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-400 font-medium">Sort by:</span>
                    <div className="flex space-x-2">
                      {['type', 'amount', 'valueUSD'].map((field) => (
                        <button
                          key={field}
                          onClick={() => handleSort(field as 'type' | 'amount' | 'valueUSD')}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                            sortField === field
                              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/15'
                              : 'bg-[#252525]/80 text-gray-400 hover:text-white hover:bg-[#303030]'
                          }`}
                        >
                          {field === 'type' ? 'Type' : field === 'amount' ? 'Amount' : 'Value'}
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
                  <table className="min-w-full divide-y divide-indigo-500/20">
                    <thead>
                      <tr className="bg-slate-950/40">
                        {['Star', 'Token', 'Action', 'Amount', 'Price', 'Value', 'Time', 'Tx Hash'].map((header) => (
                          <th key={header} className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-500/10">
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center">
                            <div className="flex items-center justify-center space-x-3">
                              <div className="relative">
                                <div className="w-8 h-8 border-4 border-violet-600/30 border-t-violet-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                              </div>
                              <span className="text-gray-400 font-medium">{currentLoadingMessage || 'Loading trading history...'}</span>
                            </div>
                          </td>
                        </tr>
                      ) : getSortedTrades().length > 0 ? (
                        getSortedTrades().map((trade) => (
                          <tr 
                            key={trade.signature}
                            onClick={() => handleTradeClick(trade)}
                            className="hover:bg-violet-500/10 cursor-pointer transition-all duration-300 group/row border-b border-indigo-500/5"
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarTrade(trade.tokenAddress);
                                }}
                                disabled={starringTrade === trade.tokenAddress}
                                className="p-2 rounded-xl hover:bg-violet-500/20 hover:text-yellow-400 transition-all duration-300 disabled:opacity-50"
                                aria-label={trade.starred ? 'Unstar token' : 'Star token'}
                              >
                                {starringTrade === trade.tokenAddress ? (
                                  <div className="relative">
                                    <div className="w-4 h-4 border-2 border-violet-600/30 border-t-violet-500 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 w-4 h-4 border-2 border-transparent border-t-yellow-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                  </div>
                                ) : (
                                  <svg 
                                    className={`h-4 w-4 transition-all duration-300 ${trade.starred ? 'text-yellow-400 fill-current' : 'text-gray-400 group-hover/row:text-gray-300'}`} 
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
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                {trade.tokenLogoURI && (
                                  <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-6 h-6 rounded-full ring-2 ring-violet-500/30" />
                                )}
                                <span className="text-gray-100 font-medium group-hover/row:text-white transition-colors">{trade.tokenSymbol}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                trade.type === 'BUY' 
                                  ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-rose-900/40 text-rose-400 border border-rose-500/30'
                              }`}>
                                {trade.type === 'BUY' ? 'Buy' : 'Sell'}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                              {formatTokenAmount(trade.amount)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                              {formatPrice(trade.priceUSD || 0)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 font-medium group-hover/row:text-gray-200 transition-colors">
                              {formatPriceWithTwoDecimals(trade.valueUSD || 0)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                              {formatTimeAgo(trade.timestamp)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <a
                                href={`https://solscan.io/tx/${trade.signature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-violet-400 hover:text-violet-300 font-mono text-sm transition-colors duration-300 hover:underline"
                              >
                                {trade.signature.slice(0, 8)}...
                              </a>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                            {selectedWalletId ? 'No trading history found for this wallet' : 'Select a wallet to view trading history'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Trading Summary */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-teal-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-cyan-500/40">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/15">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  Trading Summary
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-violet-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-violet-500/40 hover:transform hover:scale-[1.02]">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-violet-300 font-semibold">Total Trades</h3>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{getSortedTrades().length}</p>
                    <p className="text-gray-400 text-sm">All transactions</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-emerald-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-emerald-500/40 hover:transform hover:scale-[1.02]">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                        </svg>
                      </div>
                      <h3 className="text-emerald-300 font-semibold">Buy Orders</h3>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">
                      {getSortedTrades().filter(t => t.type === 'BUY').length}
                    </p>
                    <p className="text-gray-400 text-sm">Purchase transactions</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-rose-600 to-red-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-rose-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-rose-500/40 hover:transform hover:scale-[1.02]">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-rose-600 to-red-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                        </svg>
                      </div>
                      <h3 className="text-rose-300 font-semibold">Sell Orders</h3>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">
                      {getSortedTrades().filter(t => t.type === 'SELL').length}
                    </p>
                    <p className="text-gray-400 text-sm">Sale transactions</p>
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
                      <h3 className="text-cyan-300 font-semibold">Total Volume</h3>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">
                      {formatPriceWithTwoDecimals(getSortedTrades().reduce((sum, trade) => sum + (trade.valueUSD || 0), 0))}
                    </p>
                    <p className="text-gray-400 text-sm">USD traded</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <LoadingToast 
            isVisible={!!(isLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && trades.length === 0))} 
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
              mode="trade-log"
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
