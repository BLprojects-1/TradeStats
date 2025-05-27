import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice } from '../../utils/formatters';
import TradeInfoModal from '../../components/TradeInfoModal';
import { useRefreshButton } from '../../hooks/useRefreshButton';
import NotificationToast from '../../components/NotificationToast';
import { useProcessedTradingData } from '../../hooks/useProcessedTradingData';
import { TradeLogEntry } from '../../utils/historicalTradeProcessing';

export default function TradeLog() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning } = useWalletSelection();
  const router = useRouter();

  // Use our processed trading data hook
  const {
    data: initialTradeLog,
    loading: dataLoading,
    error,
    refreshData
  } = useProcessedTradingData({
    autoLoad: false, // Don't auto-load data to prevent historicalPriceService from running on refresh
    dataType: 'tradeLog'
  });

  // Create a local state to manage the trade log data
  const [tradeLog, setTradeLog] = useState<TradeLogEntry[]>([]);

  // Update local state when data from the hook changes
  useEffect(() => {
    if (initialTradeLog) {
      setTradeLog(initialTradeLog);
    }
  }, [initialTradeLog]);

  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [starringTrade, setStarringTrade] = useState<string | null>(null);
  const [swingPlans, setSwingPlans] = useState<Map<string, string>>(new Map());
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  // Modal state
  const [selectedTradeModal, setSelectedTradeModal] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenLogoURI?: string;
  } | null>(null);

  const {
    isLoading: isRefreshing,
    isOnCooldown,
    cooldownTimeLeft: refreshCooldownTimeLeft,
    showNotification,
    notificationType,
    notificationMessage,
    handleRefresh,
    handleDismissNotification
  } = useRefreshButton({
    onRefresh: async () => {
      if (!user?.id || !selectedWalletId) {
        throw new Error('Please select a wallet first.');
      }

      await refreshData();

      // Return the expected format
      return {
        newTradesCount: tradeLog?.length || 0,
        message: 'Trading data refreshed successfully'
      };
    }
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

  const handleRetry = () => {
    refreshData();
  };

  const handleStarTrade = async (tokenAddress: string) => {
    if (!user?.id || !selectedWalletId) return;

    setStarringTrade(tokenAddress);
    try {
      // Update local state for now (could be enhanced to persist to backend)
      setTradeLog(prev => prev.map(trade => 
        trade.tokenAddress === tokenAddress 
          ? { ...trade, starred: !trade.starred }
          : trade
      ));
    } catch (err) {
      console.error('Error starring trades for token:', err);
    } finally {
      setStarringTrade(null);
    }
  };

  const handleTradeClick = (trade: TradeLogEntry) => {
    setSelectedTradeModal({
      tokenAddress: trade.tokenAddress,
      tokenSymbol: trade.tokenSymbol,
      tokenLogoURI: trade.tokenLogoURI || undefined
    });
  };

  const handleCloseModal = () => {
    setSelectedTradeModal(null);
  };

  // Filter trades based on starred status
  const filteredTrades = showStarredOnly 
    ? tradeLog.filter(trade => trade.starred)
    : tradeLog;

  // Calculate summary stats
  const totalTrades = filteredTrades.length;
  const starredTrades = tradeLog.filter(trade => trade.starred).length;
  const totalVolume = filteredTrades.reduce((sum, trade) => sum + trade.totalVolume, 0);
  const totalPnL = filteredTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);

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
      title="Trade Log"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Complete Trade Log</h1>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowStarredOnly(!showStarredOnly)}
                className={`
                  flex items-center space-x-2 px-3 py-2 rounded-lg text-sm
                  ${showStarredOnly
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-gray-200'
                  }
                  transition-colors duration-200
                `}
              >
                <svg 
                  className={`w-4 h-4 ${showStarredOnly ? 'fill-current' : ''}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill={showStarredOnly ? 'currentColor' : 'none'} 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span>{showStarredOnly ? 'Show All' : 'Starred Only'}</span>
              </button>
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
          </div>
          <p className="text-gray-500">Complete log of your trading activity from comprehensive analysis</p>
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
            Please select a wallet from the dropdown menu to view your trade log.
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Total Trades</h3>
            <p className="text-xl sm:text-2xl font-semibold text-white">{totalTrades}</p>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Starred</h3>
            <p className="text-xl sm:text-2xl font-semibold text-yellow-400">{starredTrades}</p>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Total Volume</h3>
            <p className="text-xl sm:text-2xl font-semibold text-white">
              {formatSmallPrice(totalVolume)}
            </p>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Total P/L</h3>
            <p className={`text-xl sm:text-2xl font-semibold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnL >= 0 ? `+${formatSmallPrice(totalPnL)}` : formatSmallPrice(totalPnL)}
            </p>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">
            {showStarredOnly ? 'Starred Trades' : 'All Trades'}
          </h2>

          {/* Desktop table - hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Star</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Volume</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P/L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{currentLoadingMessage || 'Loading trades...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTrades.length > 0 ? (
                  filteredTrades
                    .sort((a, b) => b.timestamp - a.timestamp) // Sort by time (newest first)
                    .map((trade) => (
                      <tr 
                        key={`${trade.tokenAddress}-${trade.timestamp}`}
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
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            trade.type === 'BUY' 
                              ? 'bg-green-900/30 text-green-400' 
                              : 'bg-red-900/30 text-red-400'
                          }`}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {formatTokenAmount(trade.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {formatSmallPrice(trade.totalVolume)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.profitLoss >= 0 ? `+${formatSmallPrice(trade.profitLoss)}` : formatSmallPrice(trade.profitLoss)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                      {showStarredOnly 
                        ? 'No starred trades found' 
                        : selectedWalletId 
                        ? 'No trades found for this wallet' 
                        : 'Select a wallet to view trades'
                      }
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
            ) : filteredTrades.length > 0 ? (
              <div className="space-y-4">
                {filteredTrades
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((trade) => (
                    <div 
                      key={`${trade.tokenAddress}-${trade.timestamp}`} 
                      onClick={() => handleTradeClick(trade)}
                      className="bg-[#252525] p-4 rounded-lg cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {trade.tokenLogoURI && (
                            <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-6 h-6 rounded-full" />
                          )}
                          <span className="text-white font-medium">{trade.tokenSymbol}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            trade.type === 'BUY' 
                              ? 'bg-green-900/30 text-green-400' 
                              : 'bg-red-900/30 text-red-400'
                          }`}>
                            {trade.type}
                          </span>
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
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                          <p className="text-gray-400">Amount</p>
                          <p className="text-gray-300">{formatTokenAmount(trade.amount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Volume</p>
                          <p className="text-gray-300">{formatSmallPrice(trade.totalVolume)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">P/L</p>
                          <p className={trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {trade.profitLoss >= 0 ? `+${formatSmallPrice(trade.profitLoss)}` : formatSmallPrice(trade.profitLoss)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Time</p>
                          <p className="text-gray-300">{new Date(trade.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-sm text-gray-300 text-center py-4">
                {showStarredOnly 
                  ? 'No starred trades found' 
                  : selectedWalletId 
                  ? 'No trades found for this wallet' 
                  : 'Select a wallet to view trades'
                }
              </div>
            )}
          </div>
        </div>

        <LoadingToast 
          isVisible={!!(isLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && tradeLog.length === 0))} 
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

        <NotificationToast
          isVisible={showNotification}
          message={notificationMessage}
          type={notificationType}
          onDismiss={handleDismissNotification}
        />
      </div>
    </DashboardLayout>
  );
}
