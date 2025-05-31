import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import NewDashboardLayout from '../../components/layouts/NewDashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice, formatPriceWithTwoDecimals } from '../../utils/formatters';
import TradeInfoModal from '../../components/TradeInfoModal';
import { useProcessedTradingData } from '../../hooks/useProcessedTradingData';
import { TokenHolding } from '../../utils/historicalTradeProcessing';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import WalletScanModal from '../../components/WalletScanModal';
import TrafficInfoModal from '../../components/TrafficInfoModal';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { supabase } from '../../utils/supabaseClient';

export default function OpenTrades() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning } = useWalletSelection();
  const router = useRouter();

  // New unified notification system
  const { showLoading, showSuccess, showError, replaceNotification } = useNotificationContext();

  // Use our new processed trading data hook
  const {
    data: walletData,
    loading: dataLoading,
    error,
    refreshData
  } = useProcessedTradingData({
    autoLoad: false, // Don't auto-load data to prevent historicalPriceService from running on refresh
    dataType: 'openTrades'
  });

  // State for refresh functionality
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  const [showWalletScanModal, setShowWalletScanModal] = useState(false);

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

  // Enhanced refresh handler
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

    // Show wallet scan modal
    setShowWalletScanModal(true);
  };

  // Handle successful wallet scan
  const handleWalletScanSuccess = (result: { newTradesCount: number, message: string }) => {
    showSuccess(result.message);
    setLastRefreshTime(Date.now());
    setCooldownTimeLeft(cooldownMs);
    setShowWalletScanModal(false);
    refreshData(); // Refresh the data after successful scan
  };

  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [starringTrade, setStarringTrade] = useState<string | null>(null);
  const [swingPlans, setSwingPlans] = useState<Map<string, string>>(new Map());

  // Add sorting state
  const [sortField, setSortField] = useState<'time' | 'value' | 'size'>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal state
  const [selectedTradeModal, setSelectedTradeModal] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenLogoURI?: string;
  } | null>(null);

  // Get the wallet address from the selected wallet
  const selectedWallet = wallets.find(w => w.id === selectedWalletId);
  const walletAddress = selectedWallet?.wallet_address || '';

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

  const handleRetry = () => {
    refreshData();
  };

  const handleStarTrade = async (tokenAddress: string) => {
    if (!user?.id || !selectedWalletId) return;

    setStarringTrade(tokenAddress);
    try {
      // Find the token to check its current starred status
      const token = walletData.find(t => t.tokenAddress === tokenAddress);
      if (!token) return;

      const isCurrentlyStarred = token.starred;
      const newStarredStatus = !isCurrentlyStarred;

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

          // Refresh data to reflect the change
          await refreshData();
        }
      } catch (dbError) {
        console.error('Error updating starred status in database:', dbError);
        showError('Failed to update starred status');
        return;
      }

      // Show notification based on whether we're starring or unstarring
      const message = newStarredStatus 
        ? `Added ${token.tokenSymbol} trade to trade log` 
        : `Removed ${token.tokenSymbol} from trade log`;
      showSuccess(message);
    } catch (err) {
      console.error('Error starring trades for token:', err);
      showError('Failed to update trade status');
    } finally {
      setStarringTrade(null);
    }
  };

  const handleTradeClick = (token: TokenHolding) => {
    setSelectedTradeModal({
      tokenAddress: token.tokenAddress,
      tokenSymbol: token.tokenSymbol,
      tokenLogoURI: token.tokenLogoURI || undefined
    });
  };

  const handleCloseModal = () => {
    setSelectedTradeModal(null);
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
  const getSortedWalletData = () => {
    // Filter out tokens with estimated value less than $1
    const filteredData = walletData.filter(token => (token.totalValue || 0) >= 1);

    return [...filteredData].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortField) {
        case 'time':
          // Since TokenHolding doesn't have timestamp info, we'll sort by tokenSymbol alphabetically as a fallback
          // This could be enhanced if timestamp data becomes available
          return sortDirection === 'asc' 
            ? a.tokenSymbol.localeCompare(b.tokenSymbol)
            : b.tokenSymbol.localeCompare(a.tokenSymbol);
        case 'value':
          aValue = a.totalValue || 0;
          bValue = b.totalValue || 0;
          break;
        case 'size':
          aValue = a.netPosition;
          bValue = b.netPosition;
          break;
        default:
          aValue = a.totalValue || 0;
          bValue = b.totalValue || 0;
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="animate-pulse text-indigo-400 text-xl mb-4">Loading your open trades...</div>
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

      <NewDashboardLayout title="Open Trades">
        <div className="relative z-10 space-y-6 sm:space-y-8">
          {/* Enhanced Header Section */}
          <div className="relative">
            <div className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    Open Trades
                  </h1>
                  <p className="text-gray-300">View your active positions from comprehensive trading analysis</p>
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
                <span>Please select a wallet from the dropdown menu to view your open trades.</span>
              </div>
            </div>
          )}

          {/* Enhanced Active Positions Section */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-50 blur-md transition-all duration-700 rounded-3xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl shadow-xl shadow-indigo-900/10 transition-all duration-500 hover:border-indigo-500/40">
              <div className="p-6 border-b border-indigo-500/20">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      Active Positions
                    </h2>
                  </div>
                  
                  {/* Enhanced Sorting Controls */}
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-400 font-medium">Sort by:</span>
                    
                    {/* Wrap the buttons in a relative container to prevent tooltip overlap */}
                    <div className="relative inline-block">
                      <div className="flex space-x-2">
                        {['time', 'value', 'size'].map((field) => (
                          <button
                            key={field}
                            onClick={() => handleSortChange(field as 'time' | 'value' | 'size')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium focus:outline-none z-10 relative ${
                              sortField === field
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/15'
                                : 'bg-indigo-900/20 border border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-800/30 hover:border-indigo-400/50'
                            }`}
                          >
                            {field.charAt(0).toUpperCase() + field.slice(1)}
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
                  <table className="min-w-full divide-y divide-indigo-500/20">
                    <thead>
                      <tr className="bg-slate-950/40">
                        {['Star', 'Token', 'Bought', 'Sold', 'Balance', 'Value', 'P/L'].map((header) => (
                          <th key={header} className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-500/10">
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center">
                            <div className="flex items-center justify-center space-x-3">
                              <div className="relative">
                                <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                              </div>
                              <span className="text-gray-400 font-medium">{currentLoadingMessage || 'Loading open trades...'}</span>
                            </div>
                          </td>
                        </tr>
                      ) : getSortedWalletData().length > 0 ? (
                        getSortedWalletData().map((token) => (
                          <tr 
                            key={token.tokenAddress}
                            onClick={() => handleTradeClick(token)}
                            className="hover:bg-indigo-500/10 cursor-pointer transition-all duration-300 group/row border-b border-indigo-500/5"
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarTrade(token.tokenAddress);
                                }}
                                disabled={starringTrade === token.tokenAddress}
                                className="p-2 rounded-xl hover:bg-indigo-500/20 hover:text-yellow-400 transition-all duration-300 disabled:opacity-50"
                                aria-label={token.starred ? 'Unstar token' : 'Star token'}
                              >
                                {starringTrade === token.tokenAddress ? (
                                  <div className="relative">
                                    <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin"></div>
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
                                  <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-6 h-6 rounded-full ring-2 ring-indigo-500/30" />
                                )}
                                <span className="text-gray-100 font-medium group-hover/row:text-white transition-colors">{token.tokenSymbol}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                              {formatTokenAmount(token.totalBought)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                              {formatTokenAmount(token.totalSold)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                              {formatTokenAmount(token.netPosition)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 font-medium group-hover/row:text-gray-200 transition-colors">
                              {formatPriceWithTwoDecimals(token.totalValue || 0)}
                            </td>
                            <td className={`px-4 py-4 whitespace-nowrap font-semibold ${(token.profitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatPriceWithTwoDecimals(token.profitLoss || 0)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                            {selectedWalletId ? 'No open trades with value ≥ $1 found for this wallet' : 'Select a wallet to view open trades'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Position Summary */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-cyan-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-purple-500/40">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/15">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Position Summary
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-indigo-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-indigo-500/40 hover:transform hover:scale-[1.02]">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-indigo-300 font-semibold">Open Positions</h3>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{getSortedWalletData().length}</p>
                    <p className="text-gray-400 text-sm">Active trades</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-purple-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-purple-500/40 hover:transform hover:scale-[1.02]">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <h3 className="text-purple-300 font-semibold">Total Est. Value</h3>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">
                      {formatPriceWithTwoDecimals(getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0))}
                    </p>
                    <p className="text-gray-400 text-sm">Portfolio value</p>
                  </div>
                </div>

                <div className="relative group/card">
                  <div className={`absolute inset-0 opacity-25 group-hover/card:opacity-40 blur transition-all duration-500 rounded-2xl ${
                    getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600' 
                      : 'bg-gradient-to-r from-red-600 to-rose-600'
                  }`}></div>
                  <div className={`relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm p-6 rounded-2xl transition-all duration-500 hover:transform hover:scale-[1.02] ${
                    getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 
                      ? 'border border-green-500/40 hover:border-green-500/40' 
                      : 'border border-red-500/40 hover:border-red-500/40'
                  }`}>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 
                          ? 'bg-gradient-to-br from-green-600 to-emerald-600' 
                          : 'bg-gradient-to-br from-red-600 to-rose-600'
                      }`}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <h3 className={`font-semibold ${
                        getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 ? 'text-green-300' : 'text-red-300'
                      }`}>Unrealized P/L</h3>
                    </div>
                    <p className={`text-3xl font-bold mb-1 ${
                      getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPriceWithTwoDecimals(getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0))}
                    </p>
                    <p className="text-gray-400 text-sm">Current performance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <LoadingToast 
            isVisible={!!(isLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && walletData.length === 0))} 
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
              mode="open-trades"
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
