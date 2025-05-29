import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice, formatDate, formatTime } from '../../utils/formatters';
import NotificationToast from '../../components/NotificationToast';
import { useProcessedTradingData } from '../../hooks/useProcessedTradingData';
import { ProcessedTrade } from '../../utils/historicalTradeProcessing';
import WalletScanModal from '../../components/WalletScanModal';
import TrafficInfoModal from '../../components/TrafficInfoModal';
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

  // Derive selectedWallet from selectedWalletId and wallets
  const selectedWallet = selectedWalletId ? wallets.find(w => w.id === selectedWalletId) : null;

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
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Trading History</h1>
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
                  ? `Wait ${Math.ceil(cooldownTimeLeft / 1000)}s`
                  : 'Refresh'
                }
              </span>
            </button>
          </div>
          <p className="text-gray-500">View your Solana trading activity</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6" role="alert">
            <p>{error}</p>
          </div>
        )}

        {!selectedWalletId && (
          <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-4 sm:mb-6">
            Please select a wallet from the dropdown menu to view your trading history.
          </div>
        )}

        <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
            <div className="flex items-center">
              <h2 className="text-lg sm:text-xl font-semibold text-indigo-200">Recent Trades</h2>
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
                {Array.from(new Set(localTrades.map(trade => trade.tokenSymbol)))
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
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{loadingMessage || 'Loading transactions...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : localTrades.length > 0 ? (
                  paginatedTrades.map((trade) => (
                    <tr key={trade.signature} className="bg-[#1a1a1a] hover:bg-[#23232b] transition-colors">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          trade.type === 'BUY' 
                            ? 'bg-green-900/30 text-green-400' 
                            : 'bg-red-900/30 text-red-400'
                        }`}>
                          {trade.type || 'UNKNOWN'}
                        </span>
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
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">
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
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{loadingMessage || 'Loading transactions...'}</span>
                </div>
              </div>
            ) : localTrades.length > 0 ? (
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
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div>
                        <p className="text-gray-400">Type</p>
                        <p className={`px-2 py-1 rounded-full text-xs font-medium inline-block ${
                          trade.type === 'BUY' 
                            ? 'bg-green-900/30 text-green-400' 
                            : 'bg-red-900/30 text-red-400'
                        }`}>
                          {trade.type || 'UNKNOWN'}
                        </p>
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

          {/* Pagination Controls */}
          {totalFilteredPages >= 1 && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-400">
                Showing {((currentPage - 1) * TRADES_PER_PAGE) + 1} to {Math.min(currentPage * TRADES_PER_PAGE, totalTrades)} of {totalTrades} trades
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


        <LoadingToast 
          isVisible={!!(dataLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && localTrades.length === 0))} 
          message={selectedWalletId && isWalletScanning(selectedWalletId) && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete !== true ? 
            "Initial wallet scan in progress. This may take a moment. We're scanning your transaction history." : 
            loadingMessage || 'Loading trading history...'
          } 
        />

        {/* Wallet Scan Modal */}
        {user?.id && selectedWallet?.wallet_address && (
          <WalletScanModal
            isOpen={showWalletScanModal}
            onClose={() => setShowWalletScanModal(false)}
            onSuccess={(result) => {
              showSuccess(result.message);
              setLastRefreshTime(Date.now());
              setCooldownTimeLeft(cooldownMs);
              setShowWalletScanModal(false);
              refreshData();
            }}
            walletAddress={selectedWallet.wallet_address}
            userId={user.id}
          />
        )}
        <TrafficInfoModal />
      </div>
    </DashboardLayout>
  );
}
