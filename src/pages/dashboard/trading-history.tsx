import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import NewDashboardLayout, { useAddTokenModal } from '../../components/layouts/NewDashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice, formatDate, formatTime } from '../../utils/formatters';
import { useProcessedTradingData } from '../../hooks/useProcessedTradingData';
import { ProcessedTrade } from '../../utils/historicalTradeProcessing';
import WalletScanModal from '../../components/WalletScanModal';
import TradeInfoModal from '../../components/TradeInfoModal';
import { useNotificationContext } from '../../contexts/NotificationContext';

const TRADES_PER_PAGE = 10; // Reduce to 10 trades per page

export default function TradingHistory() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning } = useWalletSelection();
  const router = useRouter();
  
  // Global Add Token Modal from layout
  const { openAddTokenModal } = useAddTokenModal();

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

  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [tokenFilter, setTokenFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTrades, setTotalTrades] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<'type' | 'amount' | 'priceUSD' | 'valueUSD' | 'timestamp' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Create a local copy of the trades data that we can modify
  const [localTrades, setLocalTrades] = useState<ProcessedTrade[]>([]);

  // Add time range filter state
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d' | 'all'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minTradeValue, setMinTradeValue] = useState<number>(0);
  const [maxTradeValue, setMaxTradeValue] = useState<number>(0);

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
    let aValue: any = a[sortField as keyof ProcessedTrade];
    let bValue: any = b[sortField as keyof ProcessedTrade];

    if (sortField === 'type') {
      aValue = aValue || '';
      bValue = bValue || '';
    } else if (sortField === 'timestamp') {
      // Handle timestamp sorting
      aValue = aValue || 0;
      bValue = bValue || 0;
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

  const handleSort = (field: 'type' | 'amount' | 'priceUSD' | 'valueUSD' | 'timestamp') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const getSortIcon = (field: 'type' | 'amount' | 'priceUSD' | 'valueUSD' | 'timestamp') => {
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

  const formatPriceWithSuperscript = (price: number): JSX.Element => {
    // Handle null/undefined prices
    if (!price || price === 0) {
      return <span>$0.00</span>;
    }

    if (price >= 0.01) {
      // For prices >= 0.01, show normal formatting
      if (price < 1) {
        return <span>${price.toFixed(4)}</span>;
      } else {
        return <span>${price.toFixed(2)}</span>;
      }
    }
    
    // For very small prices, format with superscript notation
    const priceStr = price.toFixed(12); // Get enough decimal places
    const match = priceStr.match(/^0\.(0+)/); // Find leading zeros after decimal
    
    if (match && match[1]) {
      const leadingZeros = match[1].length; // Count of leading zeros
      const remainingDigits = priceStr.slice(2 + leadingZeros); // Skip "0." and leading zeros
      
      // Take first 3-4 significant digits and remove trailing zeros
      const significantDigits = remainingDigits.slice(0, 4).replace(/0+$/, '') || '0';
      
      if (leadingZeros > 0) {
        return (
          <span>
            $0.0<sup>{leadingZeros}</sup>{significantDigits}
          </span>
        );
      }
    }
    
    // Fallback to regular formatting for edge cases
    return <span>${price.toFixed(8)}</span>;
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
    showSuccess(`${result.message}. Found ${result.newTradesCount} new trades.`);
    refreshData();
  };

  const getSortedTrades = () => {
    if (!sortField) return sortedTrades;
    
    return [...sortedTrades].sort((a, b) => {
      let aValue: any = a[sortField as keyof ProcessedTrade];
      let bValue: any = b[sortField as keyof ProcessedTrade];

      if (sortField === 'type') {
        aValue = aValue || '';
        bValue = bValue || '';
      } else if (sortField === 'timestamp') {
        // Handle timestamp sorting
        aValue = aValue || 0;
        bValue = bValue || 0;
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

  // Helper function to filter trades by time range
  const filterTradesByTimeRange = (trades: ProcessedTrade[]) => {
    if (timeRange === 'all') return trades;
    
    const now = Date.now();
    const timeRangeMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    };
    
    const cutoffTime = now - timeRangeMs[timeRange];
    return trades.filter(trade => trade.timestamp >= cutoffTime);
  };

  // Calculate portfolio metrics
  const calculatePortfolioMetrics = () => {
    const timeFilteredTrades = filterTradesByTimeRange(localTrades);
    
    // Group trades by token to calculate current holdings
    const tokenHoldings = new Map<string, {
      symbol: string;
      logoURI?: string;
      totalBought: number;
      totalSold: number;
      currentHolding: number;
      averageBuyPrice: number;
      averageSellPrice: number;
      totalBuyValue: number;
      totalSellValue: number;
      profit: number;
    }>();

    timeFilteredTrades.forEach(trade => {
      const existing = tokenHoldings.get(trade.tokenAddress) || {
        symbol: trade.tokenSymbol,
        logoURI: trade.tokenLogoURI || undefined,
        totalBought: 0,
        totalSold: 0,
        currentHolding: 0,
        averageBuyPrice: 0,
        averageSellPrice: 0,
        totalBuyValue: 0,
        totalSellValue: 0,
        profit: 0,
      };

      if (trade.type === 'BUY') {
        existing.totalBought += Math.abs(trade.amount);
        existing.totalBuyValue += trade.valueUSD || 0;
        existing.currentHolding += Math.abs(trade.amount);
      } else {
        existing.totalSold += Math.abs(trade.amount);
        existing.totalSellValue += trade.valueUSD || 0;
        existing.currentHolding -= Math.abs(trade.amount);
      }

      existing.profit = existing.totalSellValue - existing.totalBuyValue;
      existing.averageBuyPrice = existing.totalBought > 0 ? existing.totalBuyValue / existing.totalBought : 0;
      existing.averageSellPrice = existing.totalSold > 0 ? existing.totalSellValue / existing.totalSold : 0;

      tokenHoldings.set(trade.tokenAddress, existing);
    });

    // Calculate trading patterns
    const tradingDays = new Set(timeFilteredTrades.map(trade => 
      new Date(trade.timestamp).toDateString()
    )).size;

    const buyTrades = timeFilteredTrades.filter(t => t.type === 'BUY');
    const sellTrades = timeFilteredTrades.filter(t => t.type === 'SELL');
    
    return {
      tokenHoldings: Array.from(tokenHoldings.values()),
      totalTokens: tokenHoldings.size,
      totalVolume: timeFilteredTrades.reduce((sum, trade) => sum + (trade.valueUSD || 0), 0),
      totalProfit: Array.from(tokenHoldings.values()).reduce((sum, token) => sum + token.profit, 0),
      averageTradeSize: timeFilteredTrades.length > 0 ? 
        timeFilteredTrades.reduce((sum, trade) => sum + (trade.valueUSD || 0), 0) / timeFilteredTrades.length : 0,
      tradingDays,
      averageTradesPerDay: tradingDays > 0 ? timeFilteredTrades.length / tradingDays : 0,
      largestTrade: Math.max(...timeFilteredTrades.map(t => t.valueUSD || 0), 0),
      smallestTrade: timeFilteredTrades.length > 0 ? Math.min(...timeFilteredTrades.map(t => t.valueUSD || 0)) : 0,
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      mostTradedToken: tokenHoldings.size > 0 ? 
        Array.from(tokenHoldings.values()).reduce((prev, current) => 
          (prev.totalBought + prev.totalSold) > (current.totalBought + current.totalSold) ? prev : current
        ).symbol : 'N/A'
    };
  };

  const portfolioMetrics = calculatePortfolioMetrics();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-blue-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-emerald-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="animate-pulse text-blue-400 text-xl mb-4">Loading your professional trading history...</div>
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

      <NewDashboardLayout title="Professional Trading History - TradeStats">
        <div className="relative z-10 space-y-6 sm:space-y-8">
          {/* Enhanced Header Section */}
          <div className="relative">
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-blue-500/40 rounded-2xl p-6 shadow-xl shadow-blue-900/10 card-glass">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2 gradient-text">
                    Comprehensive Trading History
                  </h1>
                  <p className="text-slate-300">Professional analysis of your complete transaction history</p>
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
            <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 backdrop-blur-sm border border-indigo-500/30 text-indigo-200 px-6 py-4 rounded-2xl shadow-lg shadow-indigo-900/10">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Please select a wallet from the dropdown menu to view your trading history.</span>
              </div>
            </div>
          )}

          {/* Empty State for No Trades */}
          {selectedWalletId && !isLoading && localTrades.length === 0 && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-gray-700 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-gray-500/40 rounded-2xl shadow-xl shadow-gray-900/10 transition-all duration-500 hover:border-gray-500/60">
                <div className="p-12 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-gray-900/15">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">You have no transaction records yet.</h3>
                  <p className="text-gray-400 text-lg mb-6 max-w-md mx-auto">
                    Make a trade to begin tracking your comprehensive trading history and professional analytics.
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
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Time Range Filter & Quick Stats */}
          {selectedWalletId && !isLoading && localTrades.length > 0 && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-orange-600 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl shadow-xl shadow-amber-900/10 transition-all duration-500 hover:border-amber-500/60">
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
                    {/* Time Range Selector */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/15">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                          Time Range Analysis
                        </h3>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: '24h', label: '24 Hours' },
                          { value: '7d', label: '7 Days' },
                          { value: '30d', label: '30 Days' },
                          { value: '90d', label: '90 Days' },
                          { value: 'all', label: 'All Time' }
                        ].map((range, index) => (
                          <button
                            key={range.value}
                            onClick={() => setTimeRange(range.value as any)}
                            onKeyDown={(e) => {
                              // Keyboard navigation with arrow keys
                              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                e.preventDefault();
                                const ranges = ['24h', '7d', '30d', '90d', 'all'];
                                const currentIndex = ranges.indexOf(timeRange);
                                let newIndex;
                                if (e.key === 'ArrowLeft') {
                                  newIndex = currentIndex > 0 ? currentIndex - 1 : ranges.length - 1;
                                } else {
                                  newIndex = currentIndex < ranges.length - 1 ? currentIndex + 1 : 0;
                                }
                                setTimeRange(ranges[newIndex] as any);
                              }
                            }}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                              timeRange === range.value
                                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-900/15 border-b-2 border-orange-400'
                                : 'bg-amber-900/20 border border-amber-500/30 text-amber-300 hover:text-white hover:bg-amber-800/30 hover:border-amber-400/50'
                            }`}
                            aria-pressed={timeRange === range.value}
                            role="tab"
                            aria-label={`Set time range to ${range.label}`}
                          >
                            {range.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Insights */}
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-white mb-4">Quick Insights</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20">
                          <div className="text-amber-400 text-sm font-medium">Most Traded</div>
                          <div className="text-white font-bold text-lg">
                            {portfolioMetrics.mostTradedToken}
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20">
                          <div className="text-amber-400 text-sm font-medium">Avg Trade Size</div>
                          <div className="text-white font-bold text-lg">{portfolioMetrics.averageTradeSize > 0 ? formatPriceWithTwoDecimals(portfolioMetrics.averageTradeSize) : 'N/A'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20">
                          <div className="text-amber-400 text-sm font-medium">Total Volume</div>
                          <div className="text-white font-bold text-lg">{portfolioMetrics.totalVolume > 0 ? formatPriceWithTwoDecimals(portfolioMetrics.totalVolume) : 'N/A'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20">
                          <div className="text-amber-400 text-sm font-medium">Trades/Day</div>
                          <div className="text-white font-bold text-lg">{portfolioMetrics.averageTradesPerDay > 0 ? portfolioMetrics.averageTradesPerDay.toFixed(1) : 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trading Activity Analysis */}
          {selectedWalletId && !isLoading && localTrades.length > 0 && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl shadow-xl shadow-purple-900/10 transition-all duration-500 hover:border-purple-500/60">
                <div className="p-6">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Trading Activity Analysis
                      </h3>
                      <p className="text-slate-400">Behavioral patterns and insights</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Trading Behavior Metrics */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-white">Trading Behavior</h4>
                      
                      <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-purple-400 font-medium">Buy vs Sell Ratio</span>
                        </div>
                        <div className="flex space-x-1 mb-2">
                          <div 
                            className="relative h-3 bg-emerald-600 rounded-l-lg overflow-hidden"
                            style={{ 
                              width: `${portfolioMetrics.buyCount > 0 ? (portfolioMetrics.buyCount / (portfolioMetrics.buyCount + portfolioMetrics.sellCount)) * 100 : 0}%` 
                            }}
                            aria-label={`Buy trades: ${portfolioMetrics.buyCount}`}
                          >
                            {/* Pattern overlay for accessibility */}
                            <div className="absolute inset-0 opacity-30" style={{
                              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)'
                            }}></div>
                          </div>
                          <div 
                            className="relative h-3 bg-red-500 rounded-r-lg overflow-hidden"
                            style={{ 
                              width: `${portfolioMetrics.sellCount > 0 ? (portfolioMetrics.sellCount / (portfolioMetrics.buyCount + portfolioMetrics.sellCount)) * 100 : 0}%` 
                            }}
                            aria-label={`Sell trades: ${portfolioMetrics.sellCount}`}
                          >
                            {/* Pattern overlay for accessibility */}
                            <div className="absolute inset-0 opacity-30" style={{
                              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)'
                            }}></div>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm text-slate-400">
                          <span className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-emerald-600 rounded flex items-center justify-center">
                              <div className="w-2 h-2 bg-white opacity-30" style={{
                                maskImage: 'repeating-linear-gradient(45deg, transparent, transparent 1px, black 1px, black 2px)'
                              }}></div>
                            </div>
                            <span>Buy: {portfolioMetrics.buyCount}</span>
                          </span>
                          <span className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded flex items-center justify-center">
                              <div className="w-2 h-2 bg-white opacity-30" style={{
                                maskImage: 'repeating-linear-gradient(-45deg, transparent, transparent 1px, black 1px, black 2px)'
                              }}></div>
                            </div>
                            <span>Sell: {portfolioMetrics.sellCount}</span>
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="text-purple-400 text-sm font-medium">Smallest Trade</div>
                          <div className="text-white font-bold text-lg">{formatPriceWithTwoDecimals(portfolioMetrics.smallestTrade)}</div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="text-purple-400 text-sm font-medium">Unique Tokens</div>
                          <div className="text-white font-bold text-lg">{portfolioMetrics.totalTokens}</div>
                        </div>
                      </div>
                    </div>

                    {/* Trading Insights */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-white">Trading Insights</h4>
                      
                      <div className="space-y-3">
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-white font-medium">Active Trader</div>
                              <div className="text-slate-400 text-sm">
                                {portfolioMetrics.averageTradesPerDay > 2 ? 'High' : portfolioMetrics.averageTradesPerDay > 1 ? 'Medium' : 'Low'} frequency trader
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-white font-medium">Portfolio Strategy</div>
                              <div className="text-slate-400 text-sm">
                                {portfolioMetrics.totalTokens > 10 ? 'Diversified' : portfolioMetrics.totalTokens > 5 ? 'Balanced' : 'Focused'} approach
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${portfolioMetrics.totalProfit >= 0 ? 'bg-emerald-600' : 'bg-red-600'}`}>
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={portfolioMetrics.totalProfit >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                              </svg>
                            </div>
                            <div>
                              <div className="text-white font-medium">Performance Status</div>
                              <div className={`text-sm ${portfolioMetrics.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {portfolioMetrics.totalProfit >= 0 ? 'Profitable' : 'Loss'} trading period
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Trading History Section */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-emerald-600 opacity-0 group-hover:opacity-50 blur-md transition-all duration-700 rounded-3xl"></div>
            <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-blue-500/40 rounded-3xl shadow-xl shadow-blue-900/10 transition-all duration-500 hover:border-blue-500/40 card-glass">
              <div className="p-6 border-b border-blue-500/20">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent gradient-text">
                      Complete Transaction Records
                    </h2>
                  </div>
                  
                  {/* Enhanced Sorting Controls */}
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-slate-400 font-medium">Sort by:</span>
                    
                    <div className="flex space-x-2">
                      {[
                        { field: 'type', label: 'Type' },
                        { field: 'amount', label: 'Amount' },
                        { field: 'priceUSD', label: 'Price' },
                        { field: 'valueUSD', label: 'Value' },
                        { field: 'timestamp', label: 'Time' }
                      ].map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => handleSort(field as 'type' | 'amount' | 'priceUSD' | 'valueUSD' | 'timestamp')}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                            sortField === field
                              ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-lg shadow-blue-900/15'
                              : 'bg-blue-900/20 border border-blue-500/30 text-blue-300 hover:text-white hover:bg-blue-800/30 hover:border-blue-400/50'
                          }`}
                        >
                          <span className="flex items-center space-x-1">
                            <span>{label}</span>
                            {sortField === field && (
                              <span className="text-xs">
                                {getSortIcon(field as 'type' | 'amount' | 'priceUSD' | 'valueUSD' | 'timestamp')}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced table */}
              <div className="overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full divide-y divide-blue-500/20" role="table" aria-label="Complete transaction records">
                    <thead>
                      <tr className="bg-slate-950/40">
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"
                          role="columnheader"
                          aria-label="Star or favorite this transaction"
                          title="Click to star/favorite transactions"
                        >
                          <span className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            <span className="sr-only">Star</span>
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSort('type')}
                          aria-label="Transaction type - click to sort"
                          title="Buy or Sell transaction type"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Type</span>
                            {sortField === 'type' && (
                              <span className="text-blue-400" aria-hidden="true">
                                {getSortIcon('type')}
                              </span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"
                          role="columnheader"
                          aria-label="Token name and logo"
                          title="Cryptocurrency token traded"
                        >
                          Token
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSort('amount')}
                          aria-label="Token amount - click to sort"
                          title="Number of tokens in this transaction"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Amount</span>
                            {sortField === 'amount' && (
                              <span className="text-blue-400" aria-hidden="true">
                                {getSortIcon('amount')}
                              </span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSort('priceUSD')}
                          aria-label="Price per token in USD - click to sort"
                          title="USD price per individual token"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Price</span>
                            {sortField === 'priceUSD' && (
                              <span className="text-blue-400" aria-hidden="true">
                                {getSortIcon('priceUSD')}
                              </span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSort('valueUSD')}
                          aria-label="Total transaction value in USD - click to sort"
                          title="Total USD value of this transaction"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Value</span>
                            {sortField === 'valueUSD' && (
                              <span className="text-blue-400" aria-hidden="true">
                                {getSortIcon('valueUSD')}
                              </span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSort('timestamp' as any)}
                          aria-label="Transaction timestamp - click to sort chronologically"
                          title="When this transaction was executed"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Time</span>
                            {sortField === 'timestamp' && (
                              <span className="text-blue-400" aria-hidden="true">
                                {getSortIcon('timestamp' as any)}
                              </span>
                            )}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-500/10">
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center">
                            <div className="flex items-center justify-center space-x-3">
                              <div className="relative">
                                <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-t-emerald-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                              </div>
                              <span className="text-slate-400 font-medium">{currentLoadingMessage || 'Loading comprehensive trading history...'}</span>
                            </div>
                          </td>
                        </tr>
                      ) : getSortedTrades().length > 0 ? (
                        getSortedTrades().map((trade) => (
                          <tr 
                            key={trade.signature}
                            onClick={() => handleTradeClick(trade)}
                            className="hover:bg-blue-500/10 cursor-pointer transition-all duration-300 group/row border-b border-blue-500/5"
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarTrade(trade.tokenAddress);
                                }}
                                disabled={starringTrade === trade.tokenAddress}
                                className="p-2 rounded-xl hover:bg-blue-500/20 hover:text-yellow-400 transition-all duration-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                                aria-pressed={trade.starred ? 'true' : 'false'}
                                aria-label={trade.starred ? `Unstar ${trade.tokenSymbol} trade` : `Star ${trade.tokenSymbol} trade`}
                                title={trade.starred ? 'Remove from starred trades' : 'Add to starred trades'}
                              >
                                {starringTrade === trade.tokenAddress ? (
                                  <div className="relative" aria-label="Updating star status">
                                    <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-500 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 w-4 h-4 border-2 border-transparent border-t-yellow-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                  </div>
                                ) : (
                                  <svg 
                                    className={`h-4 w-4 transition-all duration-300 ${trade.starred ? 'text-yellow-400 fill-current' : 'text-slate-400 group-hover/row:text-slate-300'}`} 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    fill={trade.starred ? 'currentColor' : 'none'} 
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
                              <span className={`px-3 py-1 rounded-xl text-xs font-semibold ${trade.type === 'BUY' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
                                {trade.type}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                {trade.tokenLogoURI && (
                                  <img 
                                    src={trade.tokenLogoURI} 
                                    alt={`${trade.tokenSymbol} logo`} 
                                    className="w-6 h-6 rounded-full ring-2 ring-blue-500/30" 
                                  />
                                )}
                                <span className="text-slate-100 font-medium group-hover/row:text-white transition-colors">{trade.tokenSymbol}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-slate-300 group-hover/row:text-slate-200 transition-colors">
                              {formatTokenAmount(trade.amount)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-slate-300 group-hover/row:text-slate-200 transition-colors">
                              {formatPriceWithSuperscript(trade.priceUSD)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-slate-300 font-medium group-hover/row:text-slate-200 transition-colors">
                              {formatPriceWithTwoDecimals(trade.valueUSD)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-slate-300 group-hover/row:text-slate-200 transition-colors" title={new Date(trade.timestamp).toLocaleString()}>
                              {formatTimeAgo(trade.timestamp)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center space-y-4">
                              <svg className="w-16 h-16 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                              </svg>
                              <h3 className="text-lg font-medium text-gray-300 mb-2">
                                {selectedWalletId ? 'You have no transaction records yet.' : 'Select a wallet to view comprehensive trading history'}
                              </h3>
                              <p className="text-gray-500 text-center max-w-md">
                                {selectedWalletId 
                                  ? 'Complete some trades and refresh your data to see your transaction history here with professional analytics and insights.'
                                  : 'Choose a wallet from the dropdown menu to analyze your complete trading history with advanced metrics.'
                                }
                              </p>
                              {selectedWalletId && (
                                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                                  <button
                                    onClick={() => {
                                      window.open('https://jup.ag', '_blank');
                                    }}
                                    className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-6 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg shadow-emerald-900/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                                    aria-label="Start trading on Jupiter Exchange"
                                  >
                                    Start Trading
                                  </button>
                                </div>
                              )}
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

          <LoadingToast 
            isVisible={!!(isLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && trades.length === 0))} 
            message={selectedWalletId && isWalletScanning(selectedWalletId) && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete !== true ? 
              "Initial comprehensive scan in progress. We're analyzing your complete transaction history for professional insights." : 
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
        </div>
      </NewDashboardLayout>
    </div>
  );
}
