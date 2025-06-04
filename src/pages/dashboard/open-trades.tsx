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
  const [showWalletScanModal, setShowWalletScanModal] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [hasTradeChecklistItems, setHasTradeChecklistItems] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [showRiskMetricsModal, setShowRiskMetricsModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Handle successful wallet scan
  const handleWalletScanSuccess = (result: { newTradesCount: number, message: string }) => {
    showSuccess(result.message);
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
                <style jsx>{`
                  @media (max-width: 640px) {
                    .mobile-table thead {
                      display: none;
                    }
                    .mobile-table tbody tr {
                      display: block;
                      border: 1px solid rgba(99, 102, 241, 0.2);
                      border-radius: 0.75rem;
                      margin-bottom: 1rem;
                      padding: 1rem;
                      background: rgba(15, 23, 42, 0.6);
                    }
                    .mobile-table tbody td {
                      display: block;
                      text-align: right;
                      border: none;
                      padding: 0.5rem 0;
                      position: relative;
                      padding-left: 50%;
                    }
                    .mobile-table tbody td:before {
                      content: attr(data-label) ": ";
                      position: absolute;
                      left: 0;
                      width: 45%;
                      text-align: left;
                      font-weight: 600;
                      color: rgb(148, 163, 184);
                    }
                    .mobile-table tbody td:first-child {
                      text-align: center;
                      padding-left: 0;
                    }
                    .mobile-table tbody td:first-child:before {
                      display: none;
                    }
                    .mobile-table tbody td:nth-child(2) {
                      text-align: center;
                      padding-left: 0;
                      font-size: 1.125rem;
                      font-weight: 600;
                      border-bottom: 1px solid rgba(99, 102, 241, 0.2);
                      margin-bottom: 0.5rem;
                      padding-bottom: 0.75rem;
                    }
                    .mobile-table tbody td:nth-child(2):before {
                      display: none;
                    }
                    /* Hide less critical columns on mobile */
                    .mobile-table tbody td:nth-child(3),
                    .mobile-table tbody td:nth-child(4) {
                      display: none;
                    }
                  }
                `}</style>
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full divide-y divide-indigo-500/20 mobile-table" role="table" aria-label="Active trading positions">
                    <thead>
                      <tr className="bg-slate-950/40">
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"
                          role="columnheader"
                          aria-label="Star or favorite this position"
                          title="Click to star/favorite positions"
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
                          onClick={() => handleSortChange('time')}
                          aria-label="Token name and logo - click to sort"
                          title="Token name and symbol"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Token</span>
                            {sortField === 'time' && (
                              <span className="text-indigo-400" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"
                          role="columnheader"
                          aria-label="Total amount of tokens bought"
                          title="Total tokens purchased"
                        >
                          Bought
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"
                          role="columnheader"
                          aria-label="Total amount of tokens sold"
                          title="Total tokens sold"
                        >
                          Sold
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"
                          role="columnheader"
                          aria-label="Current token balance remaining"
                          title="Remaining token balance"
                        >
                          Balance
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSortChange('value')}
                          aria-label="Current USD value of position - click to sort"
                          title="Current USD value of position"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Value</span>
                            {sortField === 'value' && (
                              <span className="text-indigo-400" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          role="columnheader"
                          onClick={() => handleSortChange('size')}
                          aria-label="Profit and Loss for this position - click to sort"
                          title="Profit and Loss (unrealized gains/losses)"
                        >
                          <span className="flex items-center space-x-1">
                            <span>P/L</span>
                            {sortField === 'size' && (
                              <span className="text-indigo-400" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                            <button
                              className="ml-1 text-gray-400 hover:text-white transition-colors"
                              title="P/L = Profit and Loss. Shows unrealized gains or losses based on current token price vs your average buy price."
                              aria-label="What is P/L?"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          </span>
                        </th>
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
                                className="p-2 rounded-xl hover:bg-indigo-500/20 hover:text-yellow-400 transition-all duration-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                                aria-pressed={token.starred ? 'true' : 'false'}
                                aria-label={token.starred ? `Unstar ${token.tokenSymbol} position` : `Star ${token.tokenSymbol} position`}
                                title={token.starred ? 'Remove from starred positions' : 'Add to starred positions'}
                              >
                                {starringTrade === token.tokenAddress ? (
                                  <div className="relative" aria-label="Updating star status">
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
                                    className="w-6 h-6 rounded-full ring-2 ring-indigo-500/30" 
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                )}
                                <span className="text-gray-100 font-medium group-hover/row:text-white transition-colors">
                                  {token.tokenSymbol}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors" data-label="Bought">
                              {formatTokenAmount(token.totalBought) || '0'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors" data-label="Sold">
                              {formatTokenAmount(token.totalSold) || '0'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors" data-label="Balance">
                              {formatTokenAmount(token.netPosition) || '0'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-gray-300 font-medium group-hover/row:text-gray-200 transition-colors" data-label="Value">
                              {formatPriceWithTwoDecimals(token.totalValue || 0)}
                            </td>
                            <td className={`px-4 py-4 whitespace-nowrap font-semibold ${(token.profitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} data-label="P/L">
                              {formatPriceWithTwoDecimals(token.profitLoss || 0)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                            <div className="flex flex-col items-center space-y-4">
                              <svg className="w-16 h-16 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <h3 className="text-lg font-medium text-gray-300 mb-2">
                                {selectedWalletId ? 'No open trades with value ≥ $1 found' : 'Select a wallet to view open trades'}
                              </h3>
                              <p className="text-gray-500 mb-4">
                                {selectedWalletId 
                                  ? 'You have no active trading positions right now. Start your trading journey!'
                                  : 'Choose a wallet from the dropdown menu to see your active positions.'
                                }
                              </p>
                              {selectedWalletId && (
                                <div className="flex flex-col sm:flex-row gap-3">
                                  <button
                                    onClick={() => {
                                      // Navigate to token addition or trading interface
                                      window.open('https://jup.ag', '_blank');
                                    }}
                                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-emerald-900/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
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
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-indigo-300 font-semibold">Open Positions</h3>
                      <button
                        className="group/tooltip relative ml-auto"
                        title="Number of active trading positions with value ≥ $1. These are tokens you currently hold that have not been fully sold."
                        aria-label="Learn more about Open Positions"
                      >
                        <svg className="w-4 h-4 text-gray-400 hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                          Active positions with value ≥ $1
                        </div>
                      </button>
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
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <h3 className="text-purple-300 font-semibold">Total Est. Value</h3>
                      <button
                        className="group/tooltip relative ml-auto"
                        title="Sum of all position values based on current token prices. Calculated as: Balance × Current Price for each token."
                        aria-label="Learn more about Total Estimated Value"
                      >
                        <svg className="w-4 h-4 text-gray-400 hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                          Balance × Current Price for all positions
                        </div>
                      </button>
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
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <h3 className={`font-semibold ${
                        getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 ? 'text-green-300' : 'text-red-300'
                      }`}>Unrealized P/L</h3>
                      <button
                        className="group/tooltip relative ml-auto"
                        title="Unrealized Profit/Loss: (Current Value - Cost Basis) for all open positions. Shows potential gains/losses if you sold at current prices."
                        aria-label="Learn more about Unrealized P/L"
                      >
                        <svg className={`w-4 h-4 transition-colors ${
                          getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 
                            ? 'text-gray-400 hover:text-green-400' 
                            : 'text-gray-400 hover:text-red-400'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                          Current Value - Cost Basis
                        </div>
                      </button>
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

          {/* Portfolio Health Dashboard */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-xl shadow-emerald-900/10 transition-all duration-500 hover:border-emerald-500/60">
              <div className="p-6 border-b border-emerald-500/20">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/15">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    Portfolio Health Dashboard
                  </h2>
                </div>
              </div>

              <div className="p-6">
                {/* Health Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-slate-900/50 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-emerald-300 text-sm font-medium">Portfolio Value</h3>
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {formatPriceWithTwoDecimals(getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0))}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Current holdings</p>
                  </div>

                  <div className="bg-slate-900/50 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-emerald-300 text-sm font-medium">Active Positions</h3>
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-white">{getSortedWalletData().length}</p>
                    <p className="text-xs text-gray-400 mt-1">Open trades</p>
                  </div>

                  <div className="bg-slate-900/50 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-emerald-300 text-sm font-medium">Profitable Positions</h3>
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {getSortedWalletData().filter(token => (token.profitLoss || 0) > 0).length}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {getSortedWalletData().length > 0 
                        ? `${Math.round((getSortedWalletData().filter(token => (token.profitLoss || 0) > 0).length / getSortedWalletData().length) * 100)}% win rate`
                        : '0% win rate'
                      }
                    </p>
                  </div>

                  <div className="bg-slate-900/50 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-emerald-300 text-sm font-medium">Avg Position Size</h3>
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {getSortedWalletData().length > 0 
                        ? formatPriceWithTwoDecimals(getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0) / getSortedWalletData().length)
                        : formatPriceWithTwoDecimals(0)
                      }
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Per position</p>
                  </div>
                </div>

                {/* Portfolio Health Score */}
                <div className="bg-gradient-to-r from-slate-900/60 to-slate-800/60 border border-emerald-500/30 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-emerald-300">Portfolio Health Score</h3>
                    <button 
                      className="group relative"
                      title="Portfolio score based on diversification, win rate, and position sizing"
                    >
                      <svg className="w-5 h-5 text-gray-400 hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        Score factors: Diversification (40%), Win Rate (35%), Position Sizing (25%)
                      </div>
                    </button>
                  </div>
                  
                  {(() => {
                    const totalPositions = getSortedWalletData().length;
                    const profitablePositions = getSortedWalletData().filter(token => (token.profitLoss || 0) > 0).length;
                    const winRate = totalPositions > 0 ? (profitablePositions / totalPositions) * 100 : 0;
                    
                    // Diversification score (more positions = better diversification, max 100 at 10+ positions)
                    const diversificationScore = Math.min(100, (totalPositions / 10) * 100);
                    
                    // Win rate score (direct percentage)
                    const winRateScore = winRate;
                    
                    // Position sizing score (penalize if any position is &gt; 30% of portfolio)
                    const totalValue = getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0);
                    const largestPosition = Math.max(...getSortedWalletData().map(token => (token.totalValue || 0) / totalValue * 100));
                    const positionSizingScore = largestPosition > 30 ? 60 : largestPosition > 20 ? 80 : 100;
                    
                    // Weighted average
                    const healthScore = (diversificationScore * 0.4) + (winRateScore * 0.35) + (positionSizingScore * 0.25);
                    
                    // Determine grade
                    let grade = 'F';
                    let gradeColor = 'text-red-400';
                    if (healthScore >= 90) { grade = 'A+'; gradeColor = 'text-emerald-400'; }
                    else if (healthScore >= 80) { grade = 'A'; gradeColor = 'text-emerald-400'; }
                    else if (healthScore >= 70) { grade = 'B+'; gradeColor = 'text-yellow-400'; }
                    else if (healthScore >= 60) { grade = 'B'; gradeColor = 'text-yellow-400'; }
                    else if (healthScore >= 50) { grade = 'C+'; gradeColor = 'text-orange-400'; }
                    else if (healthScore >= 40) { grade = 'C'; gradeColor = 'text-orange-400'; }
                    else { grade = 'D'; gradeColor = 'text-red-400'; }

                    return (
                      <div className="flex items-center space-x-6">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Health Score</span>
                            <span className={`text-lg font-bold ${gradeColor}`}>{grade}</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${Math.max(5, healthScore)}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>Poor</span>
                            <span className="text-white font-medium">{Math.round(healthScore)}/100</span>
                            <span>Excellent</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Top 3 Positions */}
                <div className="bg-gradient-to-r from-slate-900/60 to-slate-800/60 border border-emerald-500/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-300 mb-4">Top 3 Positions by Value</h3>
                  <div className="space-y-3">
                    {getSortedWalletData()
                      .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
                      .slice(0, 3)
                      .map((token, index) => (
                        <div key={token.tokenAddress} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-yellow-500 text-yellow-900' :
                              index === 1 ? 'bg-gray-400 text-gray-900' :
                              'bg-orange-500 text-orange-900'
                            }`}>
                              {index + 1}
                            </div>
                            {token.tokenLogoURI && (
                              <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-6 h-6 rounded-full" />
                            )}
                            <span className="text-white font-medium">{token.tokenSymbol}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-semibold">{formatPriceWithTwoDecimals(token.totalValue || 0)}</div>
                            <div className={`text-sm ${(token.profitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatPriceWithTwoDecimals(token.profitLoss || 0)} P/L
                            </div>
                          </div>
                        </div>
                      ))}
                    {getSortedWalletData().length === 0 && (
                      <div className="text-center text-gray-400 py-4">
                        No positions to display
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Management Insights */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-orange-500/40 rounded-2xl shadow-xl shadow-orange-900/10 transition-all duration-500 hover:border-orange-500/60">
              <div className="p-6 border-b border-orange-500/20">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/15">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                    Risk Management Insights
                  </h2>
                </div>
              </div>

              <div className="p-6">
                {/* Position Size Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-slate-900/50 border border-orange-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-orange-300 mb-4">Position Size Distribution</h3>
                    {(() => {
                      const totalValue = getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0);
                      const largePositions = getSortedWalletData().filter(token => (token.totalValue || 0) / totalValue > 0.2).length;
                      const mediumPositions = getSortedWalletData().filter(token => {
                        const percentage = (token.totalValue || 0) / totalValue;
                        return percentage >= 0.05 && percentage <= 0.2;
                      }).length;
                      const smallPositions = getSortedWalletData().filter(token => (token.totalValue || 0) / totalValue < 0.05).length;

                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Large (&gt; 20%)</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-medium">{largePositions}</span>
                              <div className="w-16 bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-red-500 h-2 rounded-full" 
                                  style={{ width: `${getSortedWalletData().length > 0 ? (largePositions / getSortedWalletData().length) * 100 : 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Medium (5-20%)</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-medium">{mediumPositions}</span>
                              <div className="w-16 bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-yellow-500 h-2 rounded-full" 
                                  style={{ width: `${getSortedWalletData().length > 0 ? (mediumPositions / getSortedWalletData().length) * 100 : 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Small (&lt; 5%)</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-medium">{smallPositions}</span>
                              <div className="w-16 bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full" 
                                  style={{ width: `${getSortedWalletData().length > 0 ? (smallPositions / getSortedWalletData().length) * 100 : 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-slate-900/50 border border-orange-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-orange-300">Risk Metrics</h3>
                      <button
                        onClick={() => setShowRiskMetricsModal(true)}
                        className="text-sm text-orange-400 hover:text-orange-300 underline transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                        aria-label="Learn more about risk metrics"
                      >
                        Learn more
                      </button>
                    </div>
                    {(() => {
                      const totalValue = getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0);
                      const totalPositions = getSortedWalletData().length;
                      const profitablePositions = getSortedWalletData().filter(token => (token.profitLoss || 0) > 0).length;
                      const losingPositions = totalPositions - profitablePositions;
                      const largestPosition = totalPositions > 0 ? Math.max(...getSortedWalletData().map(token => (token.totalValue || 0) / totalValue * 100)) : 0;

                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Diversification</span>
                            <span className={`font-medium ${totalPositions >= 10 ? 'text-green-400' : totalPositions >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {totalPositions >= 10 ? 'Well Diversified' : totalPositions >= 5 ? 'Moderate' : 'Concentrated'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Loss Ratio</span>
                            <span className={`font-medium ${losingPositions / totalPositions <= 0.3 ? 'text-green-400' : losingPositions / totalPositions <= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {totalPositions > 0 ? `${Math.round((losingPositions / totalPositions) * 100)}%` : '0%'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Concentration Risk</span>
                            <span className={`font-medium ${largestPosition <= 20 ? 'text-green-400' : largestPosition <= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {largestPosition <= 20 ? 'Low' : largestPosition <= 30 ? 'Medium' : 'High'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Portfolio Balance */}
                <div className="bg-gradient-to-r from-slate-900/60 to-slate-800/60 border border-orange-500/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-orange-300 mb-4">Portfolio Balance</h3>
                  {(() => {
                    const profitableValue = getSortedWalletData()
                      .filter(token => (token.profitLoss || 0) > 0)
                      .reduce((sum, token) => sum + (token.totalValue || 0), 0);
                    const losingValue = getSortedWalletData()
                      .filter(token => (token.profitLoss || 0) <= 0)
                      .reduce((sum, token) => sum + (token.totalValue || 0), 0);
                    const totalValue = profitableValue + losingValue;
                    const profitablePercentage = totalValue > 0 ? (profitableValue / totalValue) * 100 : 0;
                    const losingPercentage = totalValue > 0 ? (losingValue / totalValue) * 100 : 0;

                    // Risk assessment
                    const totalPL = getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0);
                    const riskScore = totalPL >= 0 && profitablePercentage >= 60 ? 'Low' : 
                                     totalPL >= 0 && profitablePercentage >= 40 ? 'Medium' : 'High';
                    const riskColor = riskScore === 'Low' ? 'text-green-400' : 
                                     riskScore === 'Medium' ? 'text-yellow-400' : 'text-red-400';

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400 mb-1">{formatPriceWithTwoDecimals(profitableValue)}</div>
                          <div className="text-sm text-gray-400">Profitable Positions</div>
                          <div className="text-xs text-green-300 mt-1">{Math.round(profitablePercentage)}% of portfolio</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400 mb-1">{formatPriceWithTwoDecimals(losingValue)}</div>
                          <div className="text-sm text-gray-400">Losing Positions</div>
                          <div className="text-xs text-red-300 mt-1">{Math.round(losingPercentage)}% of portfolio</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-2xl font-bold mb-1 ${riskColor}`}>{riskScore}</div>
                          <div className="text-sm text-gray-400">Risk Level</div>
                          <div className="text-xs text-gray-300 mt-1">Overall assessment</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Performance Tracking Overview */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-blue-500/40 rounded-2xl shadow-xl shadow-blue-900/10 transition-all duration-500 hover:border-blue-500/60">
              <div className="p-6 border-b border-blue-500/20">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/15">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 002 2h2a2 2 0 012-2V7a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2a2 2 0 00-2-2H9z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Performance Tracking Overview
                  </h2>
                </div>
              </div>

              <div className="p-6">
                {/* Performance Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-slate-900/50 border border-blue-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-blue-300 mb-4">Performance Summary</h3>
                    {(() => {
                      const sortedByPL = [...getSortedWalletData()].sort((a, b) => (b.profitLoss || 0) - (a.profitLoss || 0));
                      const bestPerformer = sortedByPL[0];
                      const worstPerformer = sortedByPL[sortedByPL.length - 1];
                      const totalPositions = getSortedWalletData().length;
                      const profitablePositions = getSortedWalletData().filter(token => (token.profitLoss || 0) > 0).length;
                      const winRate = totalPositions > 0 ? (profitablePositions / totalPositions) * 100 : 0;
                      const totalPL = getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0);

                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Best Performer</span>
                            <div className="text-right">
                              <div className="text-white font-medium">
                                {bestPerformer ? bestPerformer.tokenSymbol : 'N/A'}
                              </div>
                              <div className="text-green-400 text-sm">
                                {bestPerformer ? formatPriceWithTwoDecimals(bestPerformer.profitLoss || 0) : '$0.00'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Biggest Challenge</span>
                            <div className="text-right">
                              <div className="text-white font-medium">
                                {worstPerformer && (worstPerformer.profitLoss || 0) < 0 ? worstPerformer.tokenSymbol : 'N/A'}
                              </div>
                              <div className="text-red-400 text-sm">
                                {worstPerformer && (worstPerformer.profitLoss || 0) < 0 ? formatPriceWithTwoDecimals(worstPerformer.profitLoss || 0) : '$0.00'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Win Rate</span>
                            <span className={`font-medium ${winRate >= 70 ? 'text-green-400' : winRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {Math.round(winRate)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Total P/L</span>
                            <span className={`font-medium ${totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatPriceWithTwoDecimals(totalPL)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-slate-900/50 border border-blue-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-blue-300 mb-4">Position Insights</h3>
                    {(() => {
                      const totalValue = getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0);
                      const avgPositionSize = getSortedWalletData().length > 0 ? totalValue / getSortedWalletData().length : 0;
                      const largestPosition = getSortedWalletData().length > 0 ? Math.max(...getSortedWalletData().map(token => (token.totalValue || 0))) : 0;
                      const smallestPosition = getSortedWalletData().length > 0 ? Math.min(...getSortedWalletData().map(token => (token.totalValue || 0))) : 0;
                      
                      // Portfolio style assessment
                      const largestPositionPercentage = totalValue > 0 ? (largestPosition / totalValue) * 100 : 0;
                      const portfolioStyle = largestPositionPercentage > 30 ? 'Concentrated' : 
                                           largestPositionPercentage > 20 ? 'Focused' : 
                                           'Diversified';
                      
                      const avgPL = getSortedWalletData().length > 0 ? 
                        getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0) / getSortedWalletData().length : 0;

                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Portfolio Style</span>
                            <span className={`font-medium ${portfolioStyle === 'Diversified' ? 'text-green-400' : portfolioStyle === 'Focused' ? 'text-yellow-400' : 'text-red-400'}`}>
                              {portfolioStyle}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Avg Position Size</span>
                            <span className="text-white font-medium">{formatPriceWithTwoDecimals(avgPositionSize)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Largest Position</span>
                            <span className="text-white font-medium">{formatPriceWithTwoDecimals(largestPosition)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Overall Performance</span>
                            <span className={`font-medium ${avgPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {avgPL >= 100 ? 'Excellent' : avgPL >= 50 ? 'Good' : avgPL >= 0 ? 'Positive' : avgPL >= -50 ? 'Challenging' : 'Difficult'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trading Opportunities & Market Insights */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-violet-500/40 rounded-2xl shadow-xl shadow-violet-900/10 transition-all duration-500 hover:border-violet-500/60">
              <div className="p-6 border-b border-violet-500/20">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/15">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                    Trading Opportunities &amp; Market Insights
                  </h2>
                </div>
              </div>

              <div className="p-6">
                {/* Portfolio Optimization */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                  <div className="bg-slate-900/50 border border-violet-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-violet-300 mb-4">Portfolio Optimization</h3>
                    {(() => {
                      const totalValue = getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0);
                      const largestPosition = getSortedWalletData().length > 0 ? Math.max(...getSortedWalletData().map(token => (token.totalValue || 0))) : 0;
                      const largestPercentage = totalValue > 0 ? (largestPosition / totalValue) * 100 : 0;
                      const profitablePositions = getSortedWalletData().filter(token => (token.profitLoss || 0) > 0);
                      const topPerformer = profitablePositions.length > 0 ? profitablePositions.sort((a, b) => (b.profitLoss || 0) - (a.profitLoss || 0))[0] : null;

                      return (
                        <div className="space-y-3">
                          <div className="p-3 bg-violet-900/20 rounded-lg">
                            <div className="text-sm font-medium text-violet-200 mb-1">Rebalancing</div>
                            <div className="text-xs text-gray-300">
                              {largestPercentage > 30 
                                ? 'Consider reducing largest position for better diversification'
                                : getSortedWalletData().length < 5
                                ? 'Consider diversifying into more positions'
                                : 'Portfolio balance looks good'
                              }
                            </div>
                          </div>
                          <div className="p-3 bg-violet-900/20 rounded-lg">
                            <div className="text-sm font-medium text-violet-200 mb-1">Profit Taking</div>
                            <div className="text-xs text-gray-300">
                              {topPerformer && (topPerformer.profitLoss || 0) > 100
                                ? `Consider taking profits from ${topPerformer.tokenSymbol}`
                                : profitablePositions.length > 0
                                ? 'Monitor profitable positions for exit opportunities'
                                : 'Focus on cutting losses and finding new opportunities'
                              }
                            </div>
                          </div>
                          <div className="p-3 bg-violet-900/20 rounded-lg">
                            <div className="text-sm font-medium text-violet-200 mb-1">Risk Review</div>
                            <div className="text-xs text-gray-300">
                              {getSortedWalletData().filter(token => (token.profitLoss || 0) < -50).length > 0
                                ? 'Review positions with significant losses'
                                : 'Risk exposure appears manageable'
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-slate-900/50 border border-violet-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-violet-300 mb-4">Market Opportunities</h3>
                    {(() => {
                      const sortedByPL = [...getSortedWalletData()].sort((a, b) => (b.profitLoss || 0) - (a.profitLoss || 0));
                      const topPerformers = sortedByPL.slice(0, 3).filter(token => (token.profitLoss || 0) > 0);
                      const avgPositionSize = getSortedWalletData().length > 0 ? 
                        getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0) / getSortedWalletData().length : 0;

                      return (
                        <div className="space-y-3">
                          <div className="p-3 bg-violet-900/20 rounded-lg">
                            <div className="text-sm font-medium text-violet-200 mb-1">Top Performing Assets</div>
                            <div className="text-xs text-gray-300">
                              {topPerformers.length > 0 
                                ? `${topPerformers.map(t => t.tokenSymbol).join(', ')} showing strong performance`
                                : 'No positions currently profitable'
                              }
                            </div>
                          </div>
                          <div className="p-3 bg-violet-900/20 rounded-lg">
                            <div className="text-sm font-medium text-violet-200 mb-1">Position Sizing</div>
                            <div className="text-xs text-gray-300">
                              {avgPositionSize > 1000 
                                ? 'Consider smaller position sizes for better risk management'
                                : avgPositionSize > 100
                                ? 'Position sizing appears appropriate'
                                : 'Consider increasing position sizes for meaningful impact'
                              }
                            </div>
                          </div>
                          <div className="p-3 bg-violet-900/20 rounded-lg">
                            <div className="text-sm font-medium text-violet-200 mb-1">Market Trends</div>
                            <div className="text-xs text-gray-300">
                              {getSortedWalletData().filter(token => (token.profitLoss || 0) > 0).length > getSortedWalletData().length / 2
                                ? 'Portfolio showing positive momentum'
                                : 'Consider defensive positioning'
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-slate-900/50 border border-violet-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-violet-300 mb-4">Recommended Actions</h3>
                    {(() => {
                      const losingPositions = getSortedWalletData().filter(token => (token.profitLoss || 0) < -50);
                      const profitablePositions = getSortedWalletData().filter(token => (token.profitLoss || 0) > 50);
                      const totalPositions = getSortedWalletData().length;

                      const actions = [];
                      
                      if (losingPositions.length > 0) {
                        actions.push(`1. Review ${losingPositions.length} underperforming position${losingPositions.length > 1 ? 's' : ''}`);
                      }
                      
                      if (profitablePositions.length > 0) {
                        actions.push(`${actions.length + 1}. Consider taking profits from ${profitablePositions.length} strong performer${profitablePositions.length > 1 ? 's' : ''}`);
                      }
                      
                      if (totalPositions < 5) {
                        actions.push(`${actions.length + 1}. Diversify portfolio with additional positions`);
                      }
                      
                      actions.push(`${actions.length + 1}. Monitor portfolio balance and risk exposure`);

                      return (
                        <div className="space-y-2">
                          {actions.slice(0, 4).map((action, index) => (
                            <div key={index} className="p-3 bg-violet-900/20 rounded-lg">
                              <div className="text-xs text-gray-300">{action}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Portfolio Health Summary */}
                <div className="bg-gradient-to-r from-slate-900/60 to-slate-800/60 border border-violet-500/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-violet-300 mb-6">Portfolio Health Summary</h3>
                  {(() => {
                    const totalPositions = getSortedWalletData().length;
                    const profitablePositions = getSortedWalletData().filter(token => (token.profitLoss || 0) > 0).length;
                    const winRate = totalPositions > 0 ? (profitablePositions / totalPositions) * 100 : 0;
                    const totalPL = getSortedWalletData().reduce((sum, token) => sum + (token.profitLoss || 0), 0);
                    const totalValue = getSortedWalletData().reduce((sum, token) => sum + (token.totalValue || 0), 0);
                    
                    // Portfolio grade calculation
                    let portfolioGrade = 'C';
                    let gradeColor = 'text-orange-400';
                    if (winRate >= 70 && totalPL > 0) { portfolioGrade = 'A+'; gradeColor = 'text-emerald-400'; }
                    else if (winRate >= 60 && totalPL > 0) { portfolioGrade = 'A'; gradeColor = 'text-emerald-400'; }
                    else if (winRate >= 50 && totalPL >= 0) { portfolioGrade = 'B+'; gradeColor = 'text-yellow-400'; }
                    else if (winRate >= 40 && totalPL >= 0) { portfolioGrade = 'B'; gradeColor = 'text-yellow-400'; }
                    else if (winRate >= 30) { portfolioGrade = 'C+'; gradeColor = 'text-orange-400'; }
                    else if (totalPL < -100) { portfolioGrade = 'D'; gradeColor = 'text-red-400'; }

                    // Momentum assessment
                    const momentum = totalPL > 100 ? 'Strong Upward' : 
                                   totalPL > 0 ? 'Positive' : 
                                   totalPL > -100 ? 'Neutral' : 'Negative';
                    const momentumColor = totalPL > 100 ? 'text-emerald-400' : 
                                        totalPL > 0 ? 'text-green-400' : 
                                        totalPL > -100 ? 'text-yellow-400' : 'text-red-400';

                    // Risk level
                    const riskLevel = totalPositions >= 8 && winRate >= 50 ? 'Low' : 
                                    totalPositions >= 5 && winRate >= 40 ? 'Medium' : 'High';
                    const riskColor = riskLevel === 'Low' ? 'text-green-400' : 
                                    riskLevel === 'Medium' ? 'text-yellow-400' : 'text-red-400';

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="text-center">
                          <div className={`text-4xl font-bold mb-2 ${gradeColor}`}>{portfolioGrade}</div>
                          <div className="text-sm text-gray-400 mb-1">Portfolio Score</div>
                          <div className="text-xs text-gray-500">
                            Based on {Math.round(winRate)}% win rate &amp; performance
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-xl font-bold mb-2 ${momentumColor}`}>{momentum}</div>
                          <div className="text-sm text-gray-400 mb-1">Momentum</div>
                          <div className="text-xs text-gray-500">
                            {formatPriceWithTwoDecimals(totalPL)} total P/L
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-xl font-bold mb-2 ${riskColor}`}>{riskLevel}</div>
                          <div className="text-sm text-gray-400">Risk Level</div>
                          <div className="text-xs text-gray-500">
                            {totalPositions} position{totalPositions !== 1 ? 's' : ''} tracked
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold mb-2 text-violet-400">
                            {winRate >= 60 ? 'Review Profits' : 
                             winRate >= 40 ? 'Optimize Mix' : 
                             'Cut Losses'}
                          </div>
                          <div className="text-sm text-gray-400 mb-1">Next Action</div>
                          <div className="text-xs text-gray-500">
                            Primary recommendation
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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

          {/* Risk Metrics Modal */}
          {showRiskMetricsModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-orange-500/40 rounded-3xl shadow-2xl shadow-orange-900/20 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6 border-b border-orange-500/20">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                      Risk Metrics Explained
                    </h2>
                    <button
                      onClick={() => setShowRiskMetricsModal(false)}
                      className="text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-xl p-2"
                      aria-label="Close risk metrics explanation"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="bg-slate-900/50 border border-orange-500/30 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">Diversification</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Measures how spread out your investments are across different tokens. 
                      <strong className="text-orange-400"> Well Diversified</strong>: 10+ positions, 
                      <strong className="text-yellow-400"> Moderate</strong>: 5-9 positions, 
                      <strong className="text-red-400"> Concentrated</strong>: &lt;5 positions.
                      More diversification generally reduces risk but may limit upside potential.
                    </p>
                  </div>

                  <div className="bg-slate-900/50 border border-orange-500/30 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">Loss Ratio</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Percentage of your positions that are currently at a loss. 
                      <strong className="text-green-400"> Good</strong>: ≤30% losing positions, 
                      <strong className="text-yellow-400"> Moderate</strong>: 30-50% losing, 
                      <strong className="text-red-400"> High Risk</strong>: &gt;50% losing.
                      Calculated as: (Number of Losing Positions ÷ Total Positions) × 100
                    </p>
                  </div>

                  <div className="bg-slate-900/50 border border-orange-500/30 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">Concentration Risk</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Measures how much of your portfolio is concentrated in your largest position. 
                      <strong className="text-green-400"> Low</strong>: Largest position ≤20% of portfolio, 
                      <strong className="text-yellow-400"> Medium</strong>: 20-30% of portfolio, 
                      <strong className="text-red-400"> High</strong>: &gt;30% of portfolio.
                      High concentration increases both potential gains and losses.
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-orange-900/30 to-amber-900/30 border border-orange-500/30 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">How to Improve Your Risk Profile</h3>
                    <ul className="text-gray-300 text-sm space-y-2">
                      <li className="flex items-start space-x-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Reduce position sizes if any single token represents &gt;20% of your portfolio</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Consider cutting losses on underperforming positions</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Diversify across different token types and market caps</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Take profits from winning positions to rebalance your portfolio</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </NewDashboardLayout>
    </div>
  );
}
