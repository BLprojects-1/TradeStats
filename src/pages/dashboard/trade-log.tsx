import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import NewDashboardLayout, { useAddTokenModal } from '../../components/layouts/NewDashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { useRefreshButton } from '../../hooks/useRefreshButton';
import { formatTokenAmount, formatSmallPrice, formatPriceWithTwoDecimals, formatTimeAgo } from '../../utils/formatters';
import { TradeLogEntry, UntrackedToken } from '../../services/tradeLogService';
import { tradeLogService } from '../../services/tradeLogService';
import LoadingToast from '../../components/LoadingToast';
import AddedTokenModal from '../../components/AddedTokenModal';
import TradeInfoModal from '../../components/TradeInfoModal';
import WalletScanModal from '../../components/WalletScanModal';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import AddTokenModal from '../../components/AddTokenModal';

// Extended interface for merged token data
interface MergedTokenData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI: string | null;
  starred: boolean;
  present_trades: boolean;
  current_price?: number;
  trades: TradeLogEntry[];
  created_at?: string;
  updated_at?: string;
}

// Add pagination constants to reduce load
const ITEMS_PER_PAGE = 20;
const MAX_INITIAL_LOAD = 100; // Limit initial data load

export default function TradeLog() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning } = useWalletSelection();
  const router = useRouter();

  // Get the wallet address from the selected wallet
  const selectedWallet = wallets.find(w => w.id === selectedWalletId);
  const walletAddress = selectedWallet?.wallet_address || '';

  // Add the missing hook from layout
  const { openAddTokenModal, isAddTokenModalOpen: showAddTokenModal, closeAddTokenModal } = useAddTokenModal();

  const { showError } = useNotificationContext();

  // Add debug logging for modal state
  useEffect(() => {
    console.log('🔍 Modal state changed:', { showAddTokenModal });
  }, [showAddTokenModal]);

  // Add the missing fetchUntrackedTokens function
  const fetchUntrackedTokens = useCallback(async () => {
    if (!walletAddress) return;

    try {
      console.log('🔍 Fetching untracked tokens for wallet:', walletAddress);
      const tokens = await tradeLogService.getUntrackedTokens(walletAddress);
      console.log('✅ Fetched untracked tokens:', tokens.length);
      setUntrackedTokens(tokens);
    } catch (error) {
      console.error('❌ Error fetching untracked tokens:', error);
      showError('Failed to fetch untracked tokens. Please try again.');
    }
  }, [walletAddress, showError]);

  // State management
  const [tradeLog, setTradeLog] = useState<TradeLogEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [untrackedTokens, setUntrackedTokens] = useState<UntrackedToken[]>([]);

  // Add missing variables
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number>(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState<string>('');

  // State for untracked tokens
  const [mergedTokenData, setMergedTokenData] = useState<MergedTokenData[]>([]);

  const [starringTrade, setStarringTrade] = useState<string | null>(null);
  const [starNotification, setStarNotification] = useState<{ show: boolean; tokenSymbol: string; isUnstarring?: boolean }>({ show: false, tokenSymbol: '' });
  const [swingPlans, setSwingPlans] = useState<Map<string, string>>(new Map());

  // Add sorting state - fix the type to match what's actually used
  const [sortField, setSortField] = useState<'time' | 'value' | 'size' | 'price'>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Add tab state for switching between starred tokens and added tokens
  const [activeTab, setActiveTab] = useState<'starred' | 'added'>('starred');

  // Modal state
  const [selectedTradeModal, setSelectedTradeModal] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenLogoURI?: string;
  } | null>(null);

  // Modal state for added tokens
  const [selectedAddedTokenModal, setSelectedAddedTokenModal] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenLogoURI?: string;
  } | null>(null);

  // Add missing helper functions
  const formatPrice = (price: number): string => {
    return formatPriceWithTwoDecimals(price);
  };

  const formatPercentage = (percentage: number): string => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const getSortIcon = (field: string): string => {
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  /**
   * Load starred trades using our dedicated service
   */
  const loadTradeData = useCallback(async () => {
    if (!selectedWalletId) {
      setTradeLog([]);
      setTotalCount(0);
      return;
    }

    console.log('🚀 Loading starred trades for wallet:', selectedWalletId);
    console.log('👤 Current user:', user?.id);
    console.log('🗂️ Selected wallet:', selectedWallet);

    setDataLoading(true);
    setError(null);

    try {
      // First, ensure we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        throw new Error(`Authentication error: ${sessionError.message}`);
      }

      if (!session) {
        console.error('❌ No active session');
        throw new Error('Please log in to view starred trades');
      }

      console.log('🔐 Auth session active for user:', session.user.id);

      // Check if there are any trades at all for this wallet (for debugging)
      const { data: allTrades, error: allTradesError } = await supabase
        .from('trading_history')
        .select('signature, token_symbol, starred, wallet_id')
        .eq('wallet_id', selectedWalletId)
        .limit(5);

      if (allTradesError) {
        console.error('❌ Error checking all trades:', allTradesError);
        throw new Error(`Database error: ${allTradesError.message}`);
      } else {
        console.log('📊 All trades sample for wallet:', allTrades);
        console.log('⭐ Starred trades in sample:', allTrades?.filter(t => t.starred));
      }

      // Now get starred trades using our service
      const { trades, totalCount } = await tradeLogService.getStarredTrades(selectedWalletId);

      console.log('📈 Service returned trades:', trades.length);
      console.log('🎯 Total count:', totalCount);
      console.log('🔍 Detailed trades data:', trades);

      // Check if any trades have starred=true
      const starredTrades = trades.filter(t => t.starred === true);
      console.log(`⭐ Trades with starred=true: ${starredTrades.length}`);

      // Check if any trades have starred='TRUE'
      const stringStarredTrades = trades.filter(t => String(t.starred).toUpperCase() === 'TRUE');
      console.log(`⭐ Trades with starred='TRUE': ${stringStarredTrades.length}`);

      setTradeLog(trades);
      setTotalCount(totalCount);
      console.log(`✅ Loaded ${trades.length} starred trades`);
    } catch (err) {
      console.error('❌ Error loading starred trades:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load starred trades';
      setError(errorMessage);
      setTradeLog([]);
      setTotalCount(0);
    } finally {
      setDataLoading(false);
    }
  }, [selectedWalletId, user?.id, selectedWallet]);

  // Load data when wallet changes
  useEffect(() => {
    loadTradeData();
  }, [loadTradeData]);

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

      await loadTradeData();
      await fetchUntrackedTokens();

      // Return the expected format
      return {
        newTradesCount: tradeLog?.length || 0,
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

  const handleRetry = () => {
    loadTradeData();
  };

  const handleStarTrade = async (tokenAddress: string) => {
    if (!user?.id || !selectedWalletId) return;

    setStarringTrade(tokenAddress);
    try {
      // Find the token data in our current view
      const currentTokens = activeTab === 'starred' ? getStarredTokens() : getAddedTokens();
      const tokenData = currentTokens.find((t: MergedTokenData) => t.tokenAddress === tokenAddress);
      if (!tokenData) return;

      // Check if the token is currently starred by looking at its trades
      // This handles both boolean true and string 'TRUE' values
      const isCurrentlyStarred = tokenData.starred === true || 
                                String(tokenData.starred).toUpperCase() === 'TRUE';
      const newStarredStatus = !isCurrentlyStarred;

      console.log(`🔄 handleStarTrade: Toggling star for ${tokenData.tokenSymbol}`);
      console.log(`   Current value: ${tokenData.starred} (${typeof tokenData.starred})`);
      console.log(`   Interpreted as: ${isCurrentlyStarred}`);
      console.log(`   Setting to: ${newStarredStatus}`);

      // If the token has trades, handle trade starring
      if (tokenData.present_trades && tokenData.trades.length > 0) {
        // Update local state for trades
        setTradeLog(prev => prev.map(t => 
          t.tokenAddress === tokenAddress 
            ? { ...t, starred: newStarredStatus }
            : t
        ));

        // Update the database using the new service
        await tradeLogService.toggleTokenStarred(selectedWalletId, tokenAddress, newStarredStatus);
        console.log(`✅ Database updated for ${tokenData.tokenSymbol}`);
      }

      // If we're unstarring and this token is only in untracked_tokens (no trades), remove it
      if (!newStarredStatus && (!tokenData.present_trades || tokenData.trades.length === 0)) {
        // Remove using the new service
        await tradeLogService.removeUntrackedToken(walletAddress, tokenAddress);

        // Remove from local state
        setUntrackedTokens(prev => prev.filter(t => t.contract_address !== tokenAddress));

        // Show notification for removal
        setStarNotification({ 
          show: true, 
          tokenSymbol: tokenData.tokenSymbol,
          isUnstarring: true
        });
      } else {
        // Show notification for normal starring/unstarring
        setStarNotification({ 
          show: true, 
          tokenSymbol: tokenData.tokenSymbol,
          isUnstarring: isCurrentlyStarred
        });
      }

      // Hide notification after 3 seconds
      setTimeout(() => {
        setStarNotification({ show: false, tokenSymbol: '', isUnstarring: false });
      }, 3000);
    } catch (err) {
      console.error('Error starring/unstarring token:', err);

      // Revert local state changes on error
      setTradeLog(prev => prev.map(trade => 
        trade.tokenAddress === tokenAddress 
          ? { ...trade, starred: !trade.starred } // Revert the change
          : trade
      ));
    } finally {
      setStarringTrade(null);
    }
  };

  const handleTradeClick = (trade: TradeLogEntry) => {
    if (activeTab === 'starred') {
      setSelectedTradeModal({
        tokenAddress: trade.tokenAddress,
        tokenSymbol: trade.tokenSymbol,
        tokenLogoURI: trade.tokenLogoURI || undefined
      });
    } else {
      // For added tokens, use the AddedTokenModal
      setSelectedAddedTokenModal({
        tokenAddress: trade.tokenAddress,
        tokenSymbol: trade.tokenSymbol,
        tokenLogoURI: trade.tokenLogoURI || undefined
      });
    }
  };

  const handleCloseModal = () => {
    setSelectedTradeModal(null);
  };

  const handleCloseAddedTokenModal = () => {
    setSelectedAddedTokenModal(null);
  };

  const handleSortChange = (field: 'time' | 'value' | 'size' | 'price') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  /**
   * Fix the getStarredTokens function to be a proper function
   */
  const getStarredTokens = (): MergedTokenData[] => {
    // First, filter trades to ensure we only include starred ones
    // This handles both boolean true and string 'TRUE' values
    const starredTrades = tradeLog.filter(trade => 
      trade.starred === true || String(trade.starred).toUpperCase() === 'TRUE'
    );

    console.log(`🔍 getStarredTokens: Found ${starredTrades.length} starred trades out of ${tradeLog.length} total`);

    // Group starred trades by token address for "Starred Tokens" tab
    const grouped = starredTrades.reduce((acc, trade) => {
      if (!acc[trade.tokenAddress]) {
        acc[trade.tokenAddress] = {
          tokenAddress: trade.tokenAddress,
          tokenSymbol: trade.tokenSymbol,
          tokenName: trade.tokenName,
          tokenLogoURI: trade.tokenLogoURI,
          starred: true,
          present_trades: true,
          trades: []
        };
      }
      acc[trade.tokenAddress].trades.push(trade);
      return acc;
    }, {} as Record<string, MergedTokenData>);

    const result = Object.values(grouped);
    console.log(`✅ getStarredTokens: Returning ${result.length} grouped token entries`);
    return result;
  };

  const getAddedTokens = (): MergedTokenData[] => {
    // Return all untracked tokens, with minimal processing
    return untrackedTokens.slice(0, 50).map(token => ({ // Limit to 50 to reduce load
      tokenAddress: token.contract_address,
      tokenSymbol: token.symbol,
      tokenName: token.symbol,
      tokenLogoURI: token.token_uri || null,
      starred: true,
      present_trades: token.present_trades,
      current_price: token.current_price,
      trades: [] as TradeLogEntry[],
      created_at: token.created_at,
      updated_at: token.updated_at
    }));
  };

  const getSortedTokenList = useMemo(() => {
    const tokens = activeTab === 'starred' ? getStarredTokens() : getAddedTokens();

    // Pre-calculate sort values to avoid repeated calculations
    const tokensWithSortValues = tokens.map((token: MergedTokenData) => {
      let sortValue: number;

      switch (sortField) {
        case 'time':
          if (activeTab === 'starred') {
            // Use first trade timestamp (already sorted by timestamp desc)
            sortValue = token.trades[0]?.timestamp || 0;
          } else {
            // Use created_at for added tokens
            const untrackedToken = untrackedTokens.find((t: UntrackedToken) => t.contract_address === token.tokenAddress);
            sortValue = untrackedToken ? new Date(untrackedToken.created_at).getTime() : 0;
          }
          break;
        case 'value':
          // Pre-calculate total P/L
          sortValue = token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
          break;
        case 'size':
          // Pre-calculate total volume
          sortValue = token.trades.reduce((sum, trade) => sum + trade.totalVolume, 0);
          break;
        case 'price':
          sortValue = token.current_price || 0;
          break;
        default:
          sortValue = token.trades[0]?.timestamp || 0;
      }

      return { ...token, sortValue };
    });

    // Simple sort by pre-calculated values
    return tokensWithSortValues.sort((a, b) => 
      sortDirection === 'asc' ? a.sortValue - b.sortValue : b.sortValue - a.sortValue
    );
  }, [tradeLog, untrackedTokens, activeTab, sortField, sortDirection]);

  // Optimized stats calculation with memoization
  const stats = useMemo(() => {
    const currentTokens = activeTab === 'starred' ? getStarredTokens() : getAddedTokens();
    const totalTokens = currentTokens.length;

    // Only calculate for visible data to reduce load
    const visibleTokens = currentTokens.slice(0, ITEMS_PER_PAGE);

    const totalVolume = visibleTokens.reduce((sum, token) => 
      sum + token.trades.reduce((tradeSum, trade) => tradeSum + trade.totalVolume, 0), 0
    );
    const totalPnL = visibleTokens.reduce((sum, token) => 
      sum + token.trades.reduce((tradeSum, trade) => tradeSum + trade.profitLoss, 0), 0
    );

    return { totalTokens, totalVolume, totalPnL };
  }, [tradeLog, untrackedTokens, activeTab]);

  // Effect to fetch untracked tokens when wallet changes
  useEffect(() => {
    if (selectedWallet?.wallet_address) {
      fetchUntrackedTokens();
    } else {
      setUntrackedTokens([]);
    }
  }, [selectedWallet?.wallet_address, fetchUntrackedTokens]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-blue-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-emerald-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="animate-pulse text-blue-400 text-xl mb-4">Loading your professional trade log...</div>
          <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 mx-auto rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const dataIsLoading = dataLoading;

  return (
    <div className="relative min-h-screen bg-[#020617] text-gray-100 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-blue-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-emerald-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3 bg-blue-500/3 blur-[50px] rounded-full"></div>
      </div>

      <NewDashboardLayout title="Professional Trade Log - TradeStats">
        <div className="relative z-10 space-y-6 sm:space-y-8">
          {/* Enhanced Header Section */}
          <div className="relative">
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-blue-500/40 rounded-2xl p-6 shadow-xl shadow-blue-900/10 card-glass">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                    Professional Trade Log
                  </h1>
                  <p className="text-slate-300">Advanced tracking of your trading decisions and performance</p>
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
                <div>
                  <h4 className="font-semibold mb-2">Error loading starred trades:</h4>
                  <p className="text-sm">{error}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs opacity-75">Debug Info</summary>
                    <div className="mt-1 text-xs opacity-75">
                      <p>Wallet ID: {selectedWalletId}</p>
                      <p>User ID: {user?.id}</p>
                      <p>Wallet Address: {selectedWallet?.wallet_address}</p>
                    </div>
                  </details>
                </div>
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
                <span>Please select a wallet to view your trade log and token watchlist.</span>
              </div>
            </div>
          )}

          {/* Empty State for No Watchlist */}
          {selectedWalletId && !dataIsLoading && getStarredTokens().length === 0 && getAddedTokens().length === 0 && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-gray-700 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-gray-500/40 rounded-2xl shadow-xl shadow-gray-900/10 transition-all duration-500 hover:border-gray-500/60">
                <div className="p-12 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-gray-900/15">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Start building your professional trade log</h3>
                  <p className="text-gray-400 text-lg mb-6 max-w-lg mx-auto">
                    Your trade log is empty. Add tokens to start tracking your research and trading decisions with advanced analytics.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Watchlist Performance Overview */}
          {selectedWalletId && !isLoading && (getStarredTokens().length > 0 || getAddedTokens().length > 0) && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-xl shadow-emerald-900/10 transition-all duration-500 hover:border-emerald-500/60">
                <div className="p-6">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                        Watchlist Performance Overview
                      </h3>
                      <p className="text-slate-400">Track and analyze your token watchlist performance</p>
                    </div>
                  </div>

                  {/* Performance Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <button
                      onClick={() => setActiveTab('starred')}
                      className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 cursor-pointer group/card focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                      aria-label="View starred tokens"
                    >
                      <div className="text-emerald-400 text-sm font-medium group-hover/card:text-emerald-300 transition-colors">Starred Tokens</div>
                      <div className="text-white font-bold text-2xl group-hover/card:text-emerald-100 transition-colors">{getStarredTokens().length}</div>
                      <div className="text-slate-400 text-xs group-hover/card:text-slate-300 transition-colors">Active positions</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('added')}
                      className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 cursor-pointer group/card focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                      aria-label="View added tokens for research"
                    >
                      <div className="text-emerald-400 text-sm font-medium group-hover/card:text-emerald-300 transition-colors">Added Tokens</div>
                      <div className="text-white font-bold text-2xl group-hover/card:text-emerald-100 transition-colors">{getAddedTokens().length}</div>
                      <div className="text-slate-400 text-xs group-hover/card:text-slate-300 transition-colors">Research targets</div>
                    </button>
                    <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-emerald-500/20">
                      <div className="text-emerald-400 text-sm font-medium">Total Watchlist</div>
                      <div className="text-white font-bold text-2xl">{getStarredTokens().length + getAddedTokens().length}</div>
                      <div className="text-slate-400 text-xs">Tracked tokens</div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-emerald-500/20">
                      <div className="text-emerald-400 text-sm font-medium">Active Research</div>
                      <div className="text-white font-bold text-2xl">
                        {getStarredTokens().filter(token => token.trades.length > 0).length}
                      </div>
                      <div className="text-slate-400 text-xs">With trades</div>
                    </div>
                  </div>

                  {/* Top Performing Tokens */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-4">Top Performing Watchlist Tokens</h4>
                      {getStarredTokens().filter(token => token.trades.length > 0).length === 0 ? (
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-8 border border-emerald-500/20 text-center">
                          <svg className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                          <h5 className="text-gray-300 font-medium mb-2">No watchlist tokens yet.</h5>
                          <p className="text-gray-500 text-sm mb-4">No watchlist tokens yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {getStarredTokens()
                            .filter(token => token.trades.length > 0)
                            .sort((a, b) => {
                              const profitA = a.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
                              const profitB = b.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
                              return profitB - profitA;
                            })
                            .slice(0, 3)
                            .map((token, index) => {
                              const totalProfit = token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
                              return (
                                <div key={token.tokenAddress} className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-emerald-500/20">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                                      }`}>
                                        {index + 1}
                                      </div>
                                      {token.tokenLogoURI && (
                                        <img src={token.tokenLogoURI} alt={`${token.tokenSymbol} logo`} className="w-6 h-6 rounded-full ring-2 ring-emerald-500/30" />
                                      )}
                                      <span className="text-white font-medium">{token.tokenSymbol}</span>
                                    </div>
                                    <span className={`font-semibold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {totalProfit >= 0 ? '+' : ''}{formatPriceWithTwoDecimals(totalProfit)}
                                    </span>
                                  </div>
                                  <div className="text-slate-400 text-sm mt-2">
                                    {token.trades.length} trade{token.trades.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-4">Recently Added Tokens</h4>
                      <div className="space-y-3">
                        {getAddedTokens()
                          .sort((a, b) => {
                            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                            return timeB - timeA;
                          })
                          .slice(0, 3)
                          .map((token) => (
                            <div key={token.tokenAddress} className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-emerald-500/20">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  {token.tokenLogoURI && (
                                    <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-6 h-6 rounded-full ring-2 ring-emerald-500/30" />
                                  )}
                                  <span className="text-white font-medium">{token.tokenSymbol}</span>
                                </div>
                                <div className="text-right">
                                  {token.current_price && (
                                    <div className="text-white font-medium">{formatSmallPrice(token.current_price)}</div>
                                  )}
                                  <div className="text-slate-400 text-sm">
                                    {token.present_trades ? 'Has trades' : 'Research only'}
                                  </div>
                                </div>
                              </div>
                              {token.created_at && (
                                <div className="text-slate-400 text-sm mt-2">
                                  Added {formatTimeAgo(new Date(token.created_at).getTime())}
                                </div>
                              )}
                            </div>
                          ))}
                        {getAddedTokens().length === 0 && (
                          <div className="text-slate-400 text-center py-8">No tokens added for research yet</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Token Research Analytics */}
          {selectedWalletId && !isLoading && (getStarredTokens().length > 0 || getAddedTokens().length > 0) && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl shadow-xl shadow-purple-900/10 transition-all duration-500 hover:border-purple-500/60">
                <div className="p-6">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Token Research Analytics
                      </h3>
                      <p className="text-slate-400">Deep insights into your research and tracking patterns</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Research Efficiency Metrics */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-white">Research Efficiency</h4>
                      
                      <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-purple-400 font-medium">Research to Trade Conversion</span>
                        </div>
                        <div className="flex space-x-2">
                          <div 
                            className="bg-emerald-600 h-3 rounded-l-lg" 
                            style={{ 
                              width: `${getStarredTokens().filter(token => token.trades.length > 0).length > 0 ? 
                                (getStarredTokens().filter(token => token.trades.length > 0).length / Math.max(getStarredTokens().length, 1)) * 100 : 0}%` 
                            }}
                          ></div>
                          <div 
                            className="bg-purple-500 h-3 rounded-r-lg flex-1"
                          ></div>
                        </div>
                        <div className="flex justify-between text-sm text-slate-400 mt-2">
                          <span>Traded: {getStarredTokens().filter(token => token.trades.length > 0).length}</span>
                          <span>Research Only: {getStarredTokens().filter(token => token.trades.length === 0).length}</span>
                        </div>
                        {getStarredTokens().filter(token => token.trades.length === 0).length > getStarredTokens().filter(token => token.trades.length > 0).length && getStarredTokens().length > 0 && (
                          <div className="mt-3 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <span className="text-amber-400 text-sm font-medium">Conversion Opportunity</span>
                            </div>
                            <p className="text-amber-200 text-sm mb-2">
                              You have more research than trades. Consider converting more of your watchlist into trades.
                            </p>
                            <button
                              onClick={openAddTokenModal}
                              className="text-amber-400 hover:text-amber-300 text-sm underline transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                              aria-label="Add new tokens to diversify and increase trading activity"
                            >
                              Add more tokens to trade →
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="text-purple-400 text-sm font-medium">Success Rate</div>
                          <div className="text-white font-bold text-lg">
                            {getStarredTokens().filter(token => 
                              token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                            ).length > 0 && getStarredTokens().filter(token => token.trades.length > 0).length > 0 ? 
                              Math.round((getStarredTokens().filter(token => 
                                token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                              ).length / getStarredTokens().filter(token => token.trades.length > 0).length) * 100) : 0}%
                          </div>
                          <div className="text-slate-400 text-xs">Profitable tokens</div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="text-purple-400 text-sm font-medium">Avg Hold Time</div>
                          <div className="text-white font-bold text-lg">
                            {getStarredTokens().filter(token => token.trades.length > 0).length > 0 ? 
                              Math.round(getStarredTokens()
                                .filter(token => token.trades.length > 0)
                                .reduce((sum, token) => {
                                  const trades = token.trades.sort((a, b) => a.timestamp - b.timestamp);
                                  if (trades.length < 2) return sum;
                                  const holdTime = (trades[trades.length - 1].timestamp - trades[0].timestamp) / (1000 * 60 * 60 * 24);
                                  return sum + holdTime;
                                }, 0) / getStarredTokens().filter(token => token.trades.length > 0).length) : 0}d
                          </div>
                          <div className="text-slate-400 text-xs">Days average</div>
                        </div>
                      </div>
                    </div>

                    {/* Trading Patterns */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-white">Trading Patterns</h4>
                      
                      <div className="space-y-3">
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              getStarredTokens().filter(token => token.trades.length > 0).length / Math.max(getStarredTokens().length, 1) > 0.5 ? 
                              'bg-purple-600' : 'bg-amber-600'
                            }`}>
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-white font-medium flex items-center space-x-2">
                                <span>Research Depth</span>
                                <div className="group relative">
                                  <svg className="w-4 h-4 text-purple-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-purple-500/30">
                                    Research Depth: Do you skim or do a deep dive? High conversion rate suggests thorough research.
                                  </div>
                                </div>
                              </div>
                              <div className={`text-sm ${
                                getStarredTokens().filter(token => token.trades.length > 0).length / Math.max(getStarredTokens().length, 1) > 0.5 ? 
                                'text-purple-400' : 'text-amber-400'
                              }`}>
                                {getStarredTokens().filter(token => token.trades.length > 0).length / Math.max(getStarredTokens().length, 1) > 0.5 ? 
                                  'Deep' : 'Surface'} research
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              getStarredTokens().filter(token => token.trades.length > 0).length / Math.max(getStarredTokens().length, 1) > 0.7 ? 
                              'bg-amber-600' : 'bg-purple-600'
                            }`}>
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-white font-medium flex items-center space-x-2">
                                <span>Decision Speed</span>
                                <div className="group relative">
                                  <svg className="w-4 h-4 text-purple-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-purple-500/30">
                                    Decision Speed: How quickly you convert research to trades. Quick suggests confidence in analysis.
                                  </div>
                                </div>
                              </div>
                              <div className={`text-sm ${
                                getStarredTokens().filter(token => token.trades.length > 0).length / Math.max(getStarredTokens().length, 1) > 0.7 ? 
                                'text-amber-400' : 'text-purple-400'
                              }`}>
                                {getStarredTokens().filter(token => token.trades.length > 0).length / Math.max(getStarredTokens().length, 1) > 0.7 ? 
                                  'Quick' : 'Methodical'} decision maker
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              getStarredTokens().filter(token => 
                                token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                              ).length / Math.max(getStarredTokens().filter(token => token.trades.length > 0).length, 1) >= 0.6 ? 
                              'bg-emerald-600' : 'bg-amber-600'
                            }`}>
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-white font-medium flex items-center space-x-2">
                                <span>Research Quality</span>
                                <div className="group relative">
                                  <svg className="w-4 h-4 text-purple-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-purple-500/30">
                                    Research Quality: Measured by success rate of your trades. High quality research leads to profitable outcomes.
                                  </div>
                                </div>
                              </div>
                              <div className={`text-sm ${
                                getStarredTokens().filter(token => 
                                  token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                                ).length / Math.max(getStarredTokens().filter(token => token.trades.length > 0).length, 1) >= 0.6 ? 
                                'text-emerald-400' : 'text-amber-400'
                              }`}>
                                {getStarredTokens().filter(token => 
                                  token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                                ).length / Math.max(getStarredTokens().filter(token => token.trades.length > 0).length, 1) >= 0.6 ? 
                                  'High quality' : 'Developing'} research
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

          {/* Tracking Insights Dashboard */}
          {selectedWalletId && !isLoading && (getStarredTokens().length > 0 || getAddedTokens().length > 0) && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-orange-600 opacity-0 group-hover:opacity-30 blur-md transition-all duration-700 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl shadow-xl shadow-amber-900/10 transition-all duration-500 hover:border-amber-500/60">
                <div className="p-6">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                        Tracking Insights Dashboard
                      </h3>
                      <p className="text-slate-400">Advanced analytics for your token tracking behavior</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Token Categories */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-white">Token Categories</h4>
                      
                      <div className="space-y-3">
                        <button
                          onClick={() => setActiveTab('starred')}
                          disabled={getStarredTokens().filter(token => token.trades.length > 0).length === 0}
                          className={`w-full bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20 text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                            getStarredTokens().filter(token => token.trades.length > 0).length === 0
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:border-amber-500/40 cursor-pointer group/card'
                          }`}
                          aria-label={getStarredTokens().filter(token => token.trades.length > 0).length === 0 ? 'No active trades available' : 'Filter to show only active trades'}
                        >
                          <div className="flex justify-between items-center">
                            <span className={`font-medium ${getStarredTokens().filter(token => token.trades.length > 0).length === 0 ? 'text-slate-500' : 'text-amber-400 group-hover/card:text-amber-300'} transition-colors`}>Active Trades</span>
                            <span className={`font-bold ${getStarredTokens().filter(token => token.trades.length > 0).length === 0 ? 'text-slate-600' : 'text-white group-hover/card:text-amber-100'} transition-colors`}>
                              {getStarredTokens().filter(token => token.trades.length > 0).length}
                            </span>
                          </div>
                          <div className={`text-sm mt-1 ${getStarredTokens().filter(token => token.trades.length > 0).length === 0 ? 'text-slate-600' : 'text-slate-400 group-hover/card:text-slate-300'} transition-colors`}>Tokens with trading history</div>
                        </button>
                        
                        <button
                          onClick={() => setActiveTab('added')}
                          disabled={getStarredTokens().filter(token => token.trades.length === 0).length + getAddedTokens().filter(token => !token.present_trades).length === 0}
                          className={`w-full bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20 text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                            getStarredTokens().filter(token => token.trades.length === 0).length + getAddedTokens().filter(token => !token.present_trades).length === 0
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:border-amber-500/40 cursor-pointer group/card'
                          }`}
                          aria-label={getStarredTokens().filter(token => token.trades.length === 0).length + getAddedTokens().filter(token => !token.present_trades).length === 0 ? 'No watchlist-only tokens available' : 'Filter to show only watchlist tokens'}
                        >
                          <div className="flex justify-between items-center">
                            <span className={`font-medium ${getStarredTokens().filter(token => token.trades.length === 0).length + getAddedTokens().filter(token => !token.present_trades).length === 0 ? 'text-slate-500' : 'text-amber-400 group-hover/card:text-amber-300'} transition-colors`}>Watchlist Only</span>
                            <span className={`font-bold ${getStarredTokens().filter(token => token.trades.length === 0).length + getAddedTokens().filter(token => !token.present_trades).length === 0 ? 'text-slate-600' : 'text-white group-hover/card:text-amber-100'} transition-colors`}>
                              {getStarredTokens().filter(token => token.trades.length === 0).length + getAddedTokens().filter(token => !token.present_trades).length}
                            </span>
                          </div>
                          <div className={`text-sm mt-1 ${getStarredTokens().filter(token => token.trades.length === 0).length + getAddedTokens().filter(token => !token.present_trades).length === 0 ? 'text-slate-600' : 'text-slate-400 group-hover/card:text-slate-300'} transition-colors`}>Research and monitoring</div>
                        </button>

                        <div className={`bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20 ${
                          getStarredTokens().filter(token => 
                            token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                          ).length === 0 ? 'opacity-50' : ''
                        }`}>
                          <div className="flex justify-between items-center">
                            <span className={`font-medium ${getStarredTokens().filter(token => 
                              token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                            ).length === 0 ? 'text-slate-500' : 'text-amber-400'}`}>Profitable</span>
                            <span className={`font-bold ${getStarredTokens().filter(token => 
                              token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                            ).length === 0 ? 'text-slate-600' : 'text-emerald-400'}`}>
                              {getStarredTokens().filter(token => 
                                token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                              ).length}
                            </span>
                          </div>
                          <div className={`text-sm mt-1 ${getStarredTokens().filter(token => 
                            token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) > 0
                          ).length === 0 ? 'text-slate-600' : 'text-slate-400'}`}>Positive P&L tokens</div>
                        </div>
                      </div>
                    </div>

                    {/* Activity Timeline */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-white">Activity Timeline</h4>
                      
                      <div className="space-y-3">
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20">
                          <div className="text-amber-400 text-sm font-medium mb-2">Recent Activity</div>
                          <div className="space-y-2">
                            {getStarredTokens()
                              .filter(token => token.trades.length > 0)
                              .sort((a, b) => (b.trades[0]?.timestamp || 0) - (a.trades[0]?.timestamp || 0))
                              .slice(0, 3)
                              .map((token) => (
                                <div key={token.tokenAddress} className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {token.tokenLogoURI && (
                                      <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-4 h-4 rounded-full" />
                                    )}
                                    <span className="text-white text-sm">{token.tokenSymbol}</span>
                                  </div>
                                  <span className="text-slate-400 text-xs">
                                    {formatTimeAgo(token.trades[0]?.timestamp || 0)}
                                  </span>
                                </div>
                              ))}
                            {getStarredTokens().filter(token => token.trades.length > 0).length === 0 && (
                              <div className="text-slate-400 text-sm">No recent trading activity</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20">
                          <div className="text-amber-400 text-sm font-medium mb-2">Research Queue</div>
                          <div className="space-y-2">
                            {getAddedTokens()
                              .sort((a, b) => {
                                const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                                const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                                return timeB - timeA;
                              })
                              .slice(0, 3)
                              .map((token) => (
                                <div key={token.tokenAddress} className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {token.tokenLogoURI && (
                                      <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-4 h-4 rounded-full" />
                                    )}
                                    <span className="text-white text-sm">{token.tokenSymbol}</span>
                                  </div>
                                  <span className="text-slate-400 text-xs">
                                    {token.created_at ? formatTimeAgo(new Date(token.created_at).getTime()) : 'Unknown'}
                                  </span>
                                </div>
                              ))}
                            {getAddedTokens().length === 0 && (
                              <div className="text-slate-400 text-sm">No tokens in research queue</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Performance Summary */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-white">Performance Summary</h4>
                      
                      <div className="space-y-3">
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20">
                          <div className="text-amber-400 text-sm font-medium">Best Performer</div>
                          {(() => {
                            const bestToken = getStarredTokens()
                              .filter(token => token.trades.length > 0)
                              .sort((a, b) => {
                                const profitA = a.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
                                const profitB = b.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
                                return profitB - profitA;
                              })[0];
                            
                            if (bestToken) {
                              const profit = bestToken.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
                              return (
                                <div className="mt-2">
                                  <div className="flex items-center space-x-2">
                                    {bestToken.tokenLogoURI && (
                                      <img src={bestToken.tokenLogoURI} alt={bestToken.tokenSymbol} className="w-5 h-5 rounded-full" />
                                    )}
                                    <span className="text-white font-medium">{bestToken.tokenSymbol}</span>
                                  </div>
                                  <div className="text-emerald-400 font-bold">{formatPriceWithTwoDecimals(profit)}</div>
                                </div>
                              );
                            }
                            return <div className="text-slate-400 text-sm mt-2">No trading data</div>;
                          })()}
                        </div>

                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20">
                          <div className="text-amber-400 text-sm font-medium">Total Portfolio Value</div>
                          <div className="text-white font-bold text-lg mt-2">
                            {formatPriceWithTwoDecimals(
                              getStarredTokens().reduce((sum, token) => 
                                sum + token.trades.reduce((tradeSum, trade) => tradeSum + trade.totalVolume, 0), 0
                              )
                            )}
                          </div>
                          <div className="text-slate-400 text-sm">Total volume tracked</div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-amber-500/20">
                          <div className="text-amber-400 text-sm font-medium">Research Efficiency</div>
                          <div className="text-white font-bold text-lg mt-2">
                            {getStarredTokens().length > 0 ? 
                              Math.round((getStarredTokens().filter(token => token.trades.length > 0).length / getStarredTokens().length) * 100) : 0}%
                          </div>
                          <div className="text-slate-400 text-sm">Conversion to trades</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-8">
          </div>

          <LoadingToast 
            isVisible={!!(isLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && untrackedTokens.length === 0))} 
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

          {/* Added Token Modal */}
          {selectedAddedTokenModal && (
            <AddedTokenModal
              isOpen={!!selectedAddedTokenModal}
              onClose={handleCloseAddedTokenModal}
              tokenAddress={selectedAddedTokenModal.tokenAddress}
              tokenSymbol={selectedAddedTokenModal.tokenSymbol}
              tokenLogoURI={selectedAddedTokenModal.tokenLogoURI}
            />
          )}
        </div>
      </NewDashboardLayout>
    </div>
  );
}
