import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import NewDashboardLayout from '../../components/layouts/NewDashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice, formatPriceWithTwoDecimals, formatTimeAgo } from '../../utils/formatters';
import TradeInfoModal from '../../components/TradeInfoModal';
import AddedTokenModal from '../../components/AddedTokenModal';
import { useRefreshButton } from '../../hooks/useRefreshButton';
import NotificationToast from '../../components/NotificationToast';
import { supabase } from '../../utils/supabaseClient';
import WalletScanModal from '../../components/WalletScanModal';
import TrafficInfoModal from '../../components/TrafficInfoModal';
import { tradeLogService, TradeLogEntry, UntrackedToken } from '../../services/tradeLogService';

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

  // State management
  const [tradeLog, setTradeLog] = useState<TradeLogEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // State for untracked tokens
  const [untrackedTokens, setUntrackedTokens] = useState<UntrackedToken[]>([]);
  const [mergedTokenData, setMergedTokenData] = useState<MergedTokenData[]>([]);

  const [starringTrade, setStarringTrade] = useState<string | null>(null);
  const [starNotification, setStarNotification] = useState<{ show: boolean; tokenSymbol: string; isUnstarring?: boolean }>({ show: false, tokenSymbol: '' });
  const [swingPlans, setSwingPlans] = useState<Map<string, string>>(new Map());

  // Add sorting state
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

  // Get the wallet address from the selected wallet
  const selectedWallet = wallets.find(w => w.id === selectedWalletId);
  const walletAddress = selectedWallet?.wallet_address || '';

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
  }, [tradeLog, untrackedTokens, activeTab, sortField, sortDirection, getStarredTokens, getAddedTokens]);

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
  }, [tradeLog, untrackedTokens, activeTab, getStarredTokens, getAddedTokens]);

  /**
   * Fetch untracked tokens for the current wallet using the new service
   */
  const fetchUntrackedTokens = useCallback(async () => {
    if (!selectedWallet?.wallet_address) {
      setUntrackedTokens([]);
      return;
    }

    try {
      const tokens = await tradeLogService.getUntrackedTokens(selectedWallet.wallet_address);
      setUntrackedTokens(tokens);
    } catch (error) {
      console.error('❌ Error in fetchUntrackedTokens:', error);
      setUntrackedTokens([]);
    }
  }, [selectedWallet?.wallet_address]);

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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="animate-pulse text-indigo-400 text-xl mb-4">Loading your trade log...</div>
          <div className="w-32 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isLoading = dataLoading;
  const currentLoadingMessage = error || (dataLoading ? 'Loading comprehensive trading data...' : '');

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-gray-100 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3 bg-indigo-500/3 blur-[50px] rounded-full"></div>
      </div>

      <NewDashboardLayout title="Trade Log">
        <div className="relative z-10 space-y-6 sm:space-y-8">
          {/* Enhanced Header Section */}
          <div className="relative">
            <div className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    Trade Log
                  </h1>
                  <p className="text-gray-300">Record and track your trading decisions and observations</p>
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

          <div className="space-y-8">
            {/* Enhanced Tabs */}
            <div className="relative group">
              <div className="relative flex space-x-1 bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-xl p-1 w-fit shadow-lg shadow-indigo-900/10">
                <button
                  onClick={() => setActiveTab('starred')}
                  className={`px-6 py-3 text-sm font-medium rounded-lg focus:outline-none ${
                    activeTab === 'starred'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/15'
                      : 'bg-indigo-900/20 border border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-800/30 hover:border-indigo-400/50'
                  }`}
                >
                  Starred Tokens ({getStarredTokens().length})
                </button>
                <button
                  onClick={() => setActiveTab('added')}
                  className={`px-6 py-3 text-sm font-medium rounded-lg focus:outline-none ${
                    activeTab === 'added'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/15'
                      : 'bg-indigo-900/20 border border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-800/30 hover:border-indigo-400/50'
                  }`}
                >
                  Added Tokens ({getAddedTokens().length})
                </button>
              </div>
            </div>

            {/* Enhanced Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-25 group-hover:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-indigo-500/40 hover:transform hover:scale-[1.02]">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                    <h3 className="text-indigo-300 font-semibold">Total Tokens</h3>
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{stats.totalTokens}</p>
                  <p className="text-gray-400 text-sm">Active tokens</p>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-25 group-hover:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-purple-500/40 hover:transform hover:scale-[1.02]">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <h3 className="text-purple-300 font-semibold">Total Volume</h3>
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{formatPriceWithTwoDecimals(stats.totalVolume)}</p>
                  <p className="text-gray-400 text-sm">Trading volume</p>
                </div>
              </div>

              <div className="relative group">
                <div className={`absolute inset-0 opacity-25 group-hover:opacity-40 blur transition-all duration-500 rounded-2xl ${
                  stats.totalPnL >= 0 
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600' 
                    : 'bg-gradient-to-r from-red-600 to-rose-600'
                }`}></div>
                <div className={`relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:transform hover:scale-[1.02] ${
                  stats.totalPnL >= 0 
                    ? 'border-green-500/40 hover:border-green-500/40' 
                    : 'border-red-500/40 hover:border-red-500/40'
                }`}>
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      stats.totalPnL >= 0 
                        ? 'bg-gradient-to-br from-green-600 to-emerald-600' 
                        : 'bg-gradient-to-br from-red-600 to-rose-600'
                    }`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h3 className={`font-semibold ${
                      stats.totalPnL >= 0 ? 'text-green-300' : 'text-red-300'
                    }`}>Total P/L</h3>
                  </div>
                  <p className={`text-3xl font-bold mb-1 ${
                    stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatPriceWithTwoDecimals(stats.totalPnL)}
                  </p>
                  <p className="text-gray-400 text-sm">Profit/Loss</p>
                </div>
              </div>
            </div>

            {/* Enhanced Token List */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 opacity-0 group-hover:opacity-50 blur-md transition-all duration-700 rounded-3xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-cyan-500/40 rounded-3xl shadow-xl shadow-indigo-900/10 transition-all duration-500 hover:border-cyan-500/40">
                <div className="p-6 border-b border-cyan-500/20">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/15">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        {activeTab === 'starred' ? 'Starred Tokens' : 'Added Tokens'}
                      </h2>
                    </div>

                    {/* Enhanced Sort buttons */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-gray-400 font-medium">Sort by:</span>
                      
                      {/* Wrap the buttons in a relative container to prevent tooltip overlap */}
                      <div className="relative inline-block">
                        <div className="flex flex-wrap gap-2">
                          {['time', 'value', 'size', 'price'].map((field) => (
                            <button
                              key={field}
                              onClick={() => handleSortChange(field as 'time' | 'value' | 'size' | 'price')}
                              className={`px-4 py-2 rounded-xl text-sm font-medium focus:outline-none z-10 relative ${
                                sortField === field
                                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/15'
                                  : 'bg-cyan-900/20 border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-800/30 hover:border-cyan-400/50'
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

                {/* Token table with enhanced styling */}
                <div className="overflow-x-auto">
                  <div className="min-w-full inline-block align-middle">
                    <table className="min-w-full divide-y divide-cyan-500/20">
                      <thead>
                        <tr className="bg-gradient-to-r from-cyan-950/60 to-blue-950/60 backdrop-blur-sm">
                          {['Star', 'Token', 'Trades', 'Volume', 'P/L', 'Price', 'Last Activity'].map((header) => (
                            <th key={header} className="px-4 py-4 text-left text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-500/10">
                        {isLoading ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center">
                              <div className="flex items-center justify-center space-x-3">
                                <div className="relative">
                                  <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                  <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                </div>
                                <span className="text-gray-400 font-medium">{currentLoadingMessage || 'Loading trade log...'}</span>
                              </div>
                            </td>
                          </tr>
                        ) : getSortedTokenList.length > 0 ? (
                          getSortedTokenList.slice(0, ITEMS_PER_PAGE).map((token) => (
                            <tr 
                              key={token.tokenAddress}
                              onClick={() => handleTradeClick({
                                signature: token.trades[0]?.signature || '',
                                tokenAddress: token.tokenAddress,
                                tokenSymbol: token.tokenSymbol,
                                tokenName: token.tokenName,
                                tokenLogoURI: token.tokenLogoURI,
                                type: token.trades[0]?.type || 'BUY',
                                amount: token.trades[0]?.amount || 0,
                                totalVolume: token.trades[0]?.totalVolume || 0,
                                profitLoss: token.trades[0]?.profitLoss || 0,
                                timestamp: token.trades[0]?.timestamp || Date.now(),
                                starred: token.starred
                              })}
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
                                    <img 
                                      src={token.tokenLogoURI} 
                                      alt={token.tokenSymbol} 
                                      className="w-6 h-6 rounded-full ring-2 ring-indigo-500/30"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <span className="text-gray-100 font-medium group-hover/row:text-white transition-colors">{token.tokenSymbol}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                                {token.trades.length}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                                {formatPriceWithTwoDecimals(token.trades.reduce((sum, trade) => sum + trade.totalVolume, 0))}
                              </td>
                              <td className={`px-4 py-4 whitespace-nowrap font-semibold ${token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatPriceWithTwoDecimals(token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0))}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-gray-300 group-hover/row:text-gray-200 transition-colors">
                                {token.current_price ? formatSmallPrice(token.current_price) : '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-gray-400 text-sm group-hover/row:text-gray-300 transition-colors">
                                {activeTab === 'starred' && token.trades[0] 
                                  ? formatTimeAgo(token.trades[0].timestamp)
                                  : activeTab === 'added' && token.created_at
                                  ? formatTimeAgo(new Date(token.created_at).getTime())
                                  : '-'
                                }
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                              {activeTab === 'starred' 
                                ? (selectedWalletId ? 'No starred tokens found. Star some tokens to see them here.' : 'Select a wallet to view starred tokens')
                                : (selectedWalletId ? 'No added tokens found for this wallet.' : 'Select a wallet to view added tokens')
                              }
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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

        <NotificationToast
          isVisible={showNotification}
          message={notificationMessage}
          type={notificationType}
          onDismiss={handleDismissNotification}
        />

        {/* Star notification */}
        <NotificationToast
          message={starNotification.isUnstarring 
            ? `Removed ${starNotification.tokenSymbol} from tracked tokens` 
            : `Added ${starNotification.tokenSymbol} to tracked tokens`}
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
      </NewDashboardLayout>
    </div>
  );
}
