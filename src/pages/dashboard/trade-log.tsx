import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
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

// Simplified interface for trade data from Supabase
interface TradeLogEntry {
  signature: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI: string | null;
  type: 'BUY' | 'SELL';
  amount: number;
  totalVolume: number;
  profitLoss: number;
  timestamp: number;
  starred: boolean;
}

// Interface for untracked tokens
interface UntrackedToken {
  id: number;
  contract_address: string;
  symbol: string;
  wallet_address: string;
  present_trades: boolean;
  current_price?: number;
  total_supply?: number;
  token_uri?: string;
  created_at: string;
  updated_at: string;
}

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
}

export default function TradeLog() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning } = useWalletSelection();
  const router = useRouter();

  // Simplified state management
  const [tradeLog, setTradeLog] = useState<TradeLogEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
   * Simplified direct Supabase data loading - much faster!
   */
  const loadTradeData = async () => {
    if (!selectedWalletId) {
      setTradeLog([]);
      return;
    }

    console.log('🚀 Loading trade data directly from Supabase for wallet:', selectedWalletId);
    setDataLoading(true);
    setError(null);

    try {
      // Direct query to Supabase - no complex processing
      const { data, error: supabaseError } = await supabase
        .from('trading_history')
        .select(`
          signature,
          token_address,
          token_symbol,
          token_logo_uri,
          type,
          amount,
          value_usd,
          timestamp,
          starred
        `)
        .eq('wallet_id', selectedWalletId)
        .eq('starred', true) // Only get starred trades for trade log
        .order('timestamp', { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }

      // Simple transformation - no complex calculations
      const transformedTrades: TradeLogEntry[] = (data || []).map(trade => ({
        signature: trade.signature || '',
        tokenAddress: trade.token_address,
        tokenSymbol: trade.token_symbol,
        tokenName: trade.token_symbol, // Use symbol as name
        tokenLogoURI: trade.token_logo_uri,
        type: trade.type as 'BUY' | 'SELL',
        amount: Math.abs(trade.amount || 0),
        totalVolume: trade.value_usd || 0,
        profitLoss: trade.type === 'BUY' ? -(trade.value_usd || 0) : (trade.value_usd || 0),
        timestamp: new Date(trade.timestamp).getTime(),
        starred: trade.starred
      }));

      console.log('✅ Loaded', transformedTrades.length, 'starred trades');
      setTradeLog(transformedTrades);
    } catch (err) {
      console.error('❌ Error loading trade data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trading data');
    } finally {
      setDataLoading(false);
    }
  };

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

  // Load data when wallet changes
  useEffect(() => {
    if (selectedWalletId) {
      loadTradeData();
    } else {
      setTradeLog([]);
    }
  }, [selectedWalletId]);

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
      const tokenData = currentTokens.find(t => t.tokenAddress === tokenAddress);
      if (!tokenData) return;

      const isCurrentlyStarred = tokenData.starred;
      const newStarredStatus = !isCurrentlyStarred;

      // If the token has trades, handle trade starring
      if (tokenData.present_trades && tokenData.trades.length > 0) {
        // Update local state for trades
        setTradeLog(prev => prev.map(t => 
          t.tokenAddress === tokenAddress 
            ? { ...t, starred: newStarredStatus }
            : t
        ));

        // Update the database for trades directly with Supabase
        const { error: updateError } = await supabase
          .from('trading_history')
          .update({ starred: newStarredStatus })
          .eq('wallet_id', selectedWalletId)
          .eq('token_address', tokenAddress);

        if (updateError) {
          console.error('❌ Error updating starred status:', updateError);
          throw updateError;
        }
      }

      // If we're unstarring and this token is only in untracked_tokens (no trades), remove it
      if (!newStarredStatus && (!tokenData.present_trades || tokenData.trades.length === 0)) {
        console.log(`🗑️ Removing untracked token ${tokenAddress} from untracked_tokens table`);
        
        const { error } = await supabase
          .from('untracked_tokens')
          .delete()
          .eq('wallet_address', walletAddress)
          .eq('contract_address', tokenAddress);

        if (error) {
          console.error('❌ Error removing untracked token:', error);
          throw error;
        }

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
   * Simplified data processing - no complex merging needed
   */
  const getStarredTokens = () => {
    // Group starred trades by token address for "Starred Tokens" tab
    const grouped = tradeLog.reduce((acc, trade) => {
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

    return Object.values(grouped);
  };

  const getAddedTokens = () => {
    // Return untracked tokens that have no trades (present_trades = false)
    return untrackedTokens
      .filter(token => !token.present_trades)
      .map(token => ({
        tokenAddress: token.contract_address,
        tokenSymbol: token.symbol,
        tokenName: token.symbol,
        tokenLogoURI: token.token_uri || null,
        starred: true, // All tracked tokens are considered "starred"
        present_trades: false,
        current_price: token.current_price,
        trades: [] as TradeLogEntry[]
      }));
  };

  const getSortedTokenList = () => {
    const tokens = activeTab === 'starred' ? getStarredTokens() : getAddedTokens();
    
    return tokens.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortField) {
        case 'time':
          if (activeTab === 'starred') {
            // Sort by most recent trade timestamp
            const aLatestTrade = a.trades.sort((x, y) => y.timestamp - x.timestamp)[0];
            const bLatestTrade = b.trades.sort((x, y) => y.timestamp - x.timestamp)[0];
            aValue = aLatestTrade?.timestamp || 0;
            bValue = bLatestTrade?.timestamp || 0;
          } else {
            // Sort by created_at for added tokens
            const aToken = untrackedTokens.find(t => t.contract_address === a.tokenAddress);
            const bToken = untrackedTokens.find(t => t.contract_address === b.tokenAddress);
            aValue = aToken ? new Date(aToken.created_at).getTime() : 0;
            bValue = bToken ? new Date(bToken.created_at).getTime() : 0;
          }
          break;
        case 'value':
          // Sort by total P/L (only for starred tokens)
          aValue = a.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
          bValue = b.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
          break;
        case 'size':
          // Sort by total volume (only for starred tokens)
          aValue = a.trades.reduce((sum, trade) => sum + trade.totalVolume, 0);
          bValue = b.trades.reduce((sum, trade) => sum + trade.totalVolume, 0);
          break;
        case 'price':
          // Sort by current price (only for starred tokens)
          aValue = a.current_price || 0;
          bValue = b.current_price || 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  // Simplified stats calculation
  const currentTokens = activeTab === 'starred' ? getStarredTokens() : getAddedTokens();
  const totalTokens = currentTokens.length;
  const totalVolume = currentTokens.reduce((sum, token) => 
    sum + token.trades.reduce((tradeSum, trade) => tradeSum + trade.totalVolume, 0), 0
  );
  const totalPnL = currentTokens.reduce((sum, token) => 
    sum + token.trades.reduce((tradeSum, trade) => tradeSum + trade.profitLoss, 0), 0
  );

  /**
   * Fetch untracked tokens for the current wallet
   */
  const fetchUntrackedTokens = async () => {
    if (!selectedWallet?.wallet_address) {
      setUntrackedTokens([]);
      return;
    }

    try {
      console.log(`🔍 Fetching untracked tokens for wallet: ${selectedWallet.wallet_address}`);
      
      const { data, error } = await supabase
        .from('untracked_tokens')
        .select('*')
        .eq('wallet_address', selectedWallet.wallet_address)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching untracked tokens:', error);
        setUntrackedTokens([]);
        return;
      }

      console.log(`✅ Found ${data?.length || 0} untracked tokens`);
      setUntrackedTokens(data || []);
    } catch (error) {
      console.error('❌ Error in fetchUntrackedTokens:', error);
      setUntrackedTokens([]);
    }
  };

  // Effect to fetch untracked tokens when wallet changes
  useEffect(() => {
    if (selectedWallet?.wallet_address) {
      fetchUntrackedTokens();
    } else {
      setUntrackedTokens([]);
    }
  }, [selectedWallet?.wallet_address]);

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
  const currentLoadingMessage = error || (dataLoading ? 'Loading comprehensive trading data...' : '');

  return (
    <DashboardLayout 
      title="Trade Log"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Trade Log</h1>
            <div className="flex items-center space-x-3">
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
          <p className="text-gray-500">View and analyze your starred tokens for deeper insights</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6">
            {error}
          </div>
        )}

        {error && <ApiErrorBanner 
          message={error} 
          onRetry={handleRetry} 
          errorType="general"
        />}

        {!selectedWalletId && (
          <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-4 sm:mb-6">
            Please select a wallet from the dropdown menu to view your starred tokens.
          </div>
        )}

        {/* Enhanced Analytics for Starred Trades */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">
              {activeTab === 'starred' ? 'Starred Tokens' : 'Added Tokens'}
            </h3>
            <p className="text-xl sm:text-2xl font-semibold text-yellow-400">{totalTokens}</p>
            <p className="text-xs text-gray-500 mt-1">
              {activeTab === 'starred' ? 'Tokens you\'ve starred' : 'Tokens you\'ve added to track'}
            </p>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">
              {activeTab === 'starred' ? 'Avg. Trade Size' : 'Total Added'}
            </h3>
            <p className="text-xl sm:text-2xl font-semibold text-white">
              {activeTab === 'starred' ? (
                totalTokens > 0 ? formatPriceWithTwoDecimals(totalVolume / totalTokens) : 'N/A'
              ) : (
                totalTokens
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {activeTab === 'starred' ? 'Average volume per trade' : 'Number of tracked tokens'}
            </p>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">
              {activeTab === 'starred' ? 'Total Volume' : 'With Price Data'}
            </h3>
            <p className="text-xl sm:text-2xl font-semibold text-white">
              {activeTab === 'starred' ? (
                totalTokens > 0 ? formatPriceWithTwoDecimals(totalVolume) : 'N/A'
              ) : (
                currentTokens.filter(token => token.current_price).length
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {activeTab === 'starred' ? 'Combined trade value' : 'Tokens with current price'}
            </p>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">
              {activeTab === 'starred' ? 'Total P/L' : 'Avg. Price'}
            </h3>
            <p className={`text-xl sm:text-2xl font-semibold ${
              activeTab === 'starred' ? (totalPnL >= 0 ? 'text-green-400' : 'text-red-400') : 'text-white'
            }`}>
              {activeTab === 'starred' ? (
                totalTokens > 0 ? (totalPnL >= 0 ? `+${formatPriceWithTwoDecimals(totalPnL)}` : formatPriceWithTwoDecimals(totalPnL)) : 'N/A'
              ) : (
                (() => {
                  const tokensWithPrices = currentTokens.filter(token => token.current_price);
                  const avgPrice = tokensWithPrices.length > 0 
                    ? tokensWithPrices.reduce((sum, token) => sum + (token.current_price || 0), 0) / tokensWithPrices.length
                    : 0;
                  return avgPrice > 0 ? formatPriceWithTwoDecimals(avgPrice) : 'N/A';
                })()
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {activeTab === 'starred' ? 'Profit/loss across all tokens' : 'Average current price'}
            </p>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4 sm:mb-6">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setActiveTab('starred')}
                className={`text-xl sm:text-2xl font-semibold transition-colors ${
                  activeTab === 'starred' 
                    ? 'text-indigo-200' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Starred Tokens
              </button>
              <span className="text-xl sm:text-2xl font-semibold text-gray-500">|</span>
              <button
                onClick={() => setActiveTab('added')}
                className={`text-xl sm:text-2xl font-semibold transition-colors ${
                  activeTab === 'added' 
                    ? 'text-indigo-200' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Added Tokens
              </button>
            </div>

            {/* Sorting Controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">Sort by:</span>
              {activeTab === 'starred' ? (
                <>
                  <button
                    onClick={() => handleSortChange('time')}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      sortField === 'time'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#252525] text-gray-400 hover:text-white'
                    }`}
                  >
                    Time
                    {sortField === 'time' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleSortChange('value')}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      sortField === 'value'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#252525] text-gray-400 hover:text-white'
                    }`}
                  >
                    Value
                    {sortField === 'value' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleSortChange('size')}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      sortField === 'size'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#252525] text-gray-400 hover:text-white'
                    }`}
                  >
                    Size
                    {sortField === 'size' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleSortChange('price')}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      sortField === 'price'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#252525] text-gray-400 hover:text-white'
                    }`}
                  >
                    Price
                    {sortField === 'price' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleSortChange('time')}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      sortField === 'time'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#252525] text-gray-400 hover:text-white'
                    }`}
                  >
                    Time
                    {sortField === 'time' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Desktop table - hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Star</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  {activeTab === 'starred' ? (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Trades</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Total Volume</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Total P/L</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Remaining Balance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Est. Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Trade</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Current Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Added</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={activeTab === 'starred' ? 8 : 4} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{currentLoadingMessage || 'Loading trades...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : getSortedTokenList().length > 0 ? (
                  getSortedTokenList().map((token) => {
                    // Calculate token-level metrics
                    const totalVolume = token.trades.reduce((sum, trade) => sum + trade.totalVolume, 0);
                    const totalPnL = token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
                    const latestTrade = token.trades.length > 0 ? token.trades.sort((a, b) => b.timestamp - a.timestamp)[0] : null;
                    
                    // For tokens without trades, we need to show N/A values but can show current price
                    const hasNoTrades = !token.present_trades || token.trades.length === 0;
                    
                    // Create a mock trade object for tokens without trades to handle click events
                    const mockTradeForClick = latestTrade || {
                      tokenAddress: token.tokenAddress,
                      tokenSymbol: token.tokenSymbol,
                      tokenName: token.tokenName,
                      tokenLogoURI: token.tokenLogoURI,
                      timestamp: Date.now(),
                      amount: 0,
                      totalVolume: 0,
                      profitLoss: 0,
                      signature: '',
                      starred: true
                    } as TradeLogEntry;

                    return (
                      <tr 
                        key={token.tokenAddress}
                        onClick={() => handleTradeClick(mockTradeForClick)}
                        className="hover:bg-[#252525] cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStarTrade(token.tokenAddress);
                            }}
                            disabled={starringTrade === token.tokenAddress}
                            className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                            aria-label={token.starred ? 'Unstar token' : 'Star token'}
                          >
                            {starringTrade === token.tokenAddress ? (
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg 
                                className={`h-4 w-4 ${token.starred ? 'text-yellow-400 fill-current' : 'text-gray-400'}`} 
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex items-center space-x-2">
                            {token.tokenLogoURI && (
                              <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-5 h-5 rounded-full" />
                            )}
                            <span>{token.tokenSymbol}</span>
                            {hasNoTrades && (
                              <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded-full">
                                {activeTab === 'starred' ? 'Tracked' : 'Added'}
                              </span>
                            )}
                          </div>
                        </td>
                        {activeTab === 'starred' && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {hasNoTrades ? 'N/A' : token.trades.length}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {hasNoTrades ? 'N/A' : formatPriceWithTwoDecimals(totalVolume)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${hasNoTrades ? 'text-gray-300' : (totalPnL >= 0 ? 'text-green-400' : 'text-red-400')}`}>
                              {hasNoTrades ? 'N/A' : (totalPnL >= 0 ? `+${formatPriceWithTwoDecimals(totalPnL)}` : formatPriceWithTwoDecimals(totalPnL))}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {hasNoTrades ? 'N/A' : formatTokenAmount(latestTrade!.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {hasNoTrades ? 'N/A' : formatPriceWithTwoDecimals(latestTrade!.totalVolume)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {hasNoTrades ? 'N/A' : formatTimeAgo(latestTrade!.timestamp)}
                            </td>
                          </>
                        )}
                        {activeTab === 'added' && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {token.current_price ? formatSmallPrice(token.current_price) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {(() => {
                                const untrackedToken = untrackedTokens.find(t => t.contract_address === token.tokenAddress);
                                return untrackedToken ? formatTimeAgo(new Date(untrackedToken.created_at).getTime()) : 'N/A';
                              })()}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={activeTab === 'starred' ? 8 : 4} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                      {selectedWalletId 
                        ? (activeTab === 'starred' 
                            ? 'No starred tokens found. Star some tokens from other pages to see them here.' 
                            : 'No added tokens found. Add some tokens to track from other pages to see them here.')
                        : 'Select a wallet to view your tokens'
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
            ) : getSortedTokenList().length > 0 ? (
              <div className="space-y-4">
                {getSortedTokenList().map((token) => {
                  // Calculate token-level metrics
                  const totalVolume = token.trades.reduce((sum, trade) => sum + trade.totalVolume, 0);
                  const totalPnL = token.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
                  const latestTrade = token.trades.length > 0 ? token.trades.sort((a, b) => b.timestamp - a.timestamp)[0] : null;
                  
                  // For tokens without trades, we need to show N/A values but can show current price
                  const hasNoTrades = !token.present_trades || token.trades.length === 0;
                  
                  // Create a mock trade object for tokens without trades to handle click events
                  const mockTradeForClick = latestTrade || {
                    tokenAddress: token.tokenAddress,
                    tokenSymbol: token.tokenSymbol,
                    tokenName: token.tokenName,
                    tokenLogoURI: token.tokenLogoURI,
                    timestamp: Date.now(),
                    amount: 0,
                    totalVolume: 0,
                    profitLoss: 0,
                    signature: '',
                    starred: true
                  } as TradeLogEntry;

                  return (
                    <div 
                      key={token.tokenAddress} 
                      onClick={() => handleTradeClick(mockTradeForClick)}
                      className="bg-[#252525] p-4 rounded-lg cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {token.tokenLogoURI && (
                            <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-6 h-6 rounded-full" />
                          )}
                          <span className="text-white font-medium">{token.tokenSymbol}</span>
                          {hasNoTrades && (
                            <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded-full">
                              {activeTab === 'starred' ? 'Tracked' : 'Added'}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStarTrade(token.tokenAddress);
                          }}
                          disabled={starringTrade === token.tokenAddress}
                          className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                          aria-label={token.starred ? 'Unstar token' : 'Star token'}
                        >
                          {starringTrade === token.tokenAddress ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg 
                              className={`h-5 w-5 ${token.starred ? 'text-yellow-400 fill-current' : 'text-gray-400'}`} 
                              xmlns="http://www.w3.org/2000/svg" 
                              fill={token.starred ? 'currentColor' : 'none'} 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {activeTab === 'starred' ? (
                          <>
                            <div>
                              <p className="text-gray-400">Trades</p>
                              <p className="text-gray-300">{hasNoTrades ? 'N/A' : token.trades.length}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Volume</p>
                              <p className="text-gray-300">{hasNoTrades ? 'N/A' : formatPriceWithTwoDecimals(totalVolume)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">P/L</p>
                              <p className={hasNoTrades ? 'text-gray-300' : (totalPnL >= 0 ? 'text-green-400' : 'text-red-400')}>
                                {hasNoTrades ? 'N/A' : (totalPnL >= 0 ? `+${formatPriceWithTwoDecimals(totalPnL)}` : formatPriceWithTwoDecimals(totalPnL))}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400">Remaining Balance</p>
                              <p className="text-gray-300">{hasNoTrades ? 'N/A' : formatTokenAmount(latestTrade!.amount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Est. Value</p>
                              <p className="text-gray-300">{hasNoTrades ? 'N/A' : formatPriceWithTwoDecimals(latestTrade!.totalVolume)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Last Trade</p>
                              <p className="text-gray-300">
                                {hasNoTrades ? 'N/A' : formatTimeAgo(latestTrade!.timestamp)}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-gray-400">Current Price</p>
                              <p className="text-gray-300">{token.current_price ? formatSmallPrice(token.current_price) : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Added</p>
                              <p className="text-gray-300">
                                {(() => {
                                  const untrackedToken = untrackedTokens.find(t => t.contract_address === token.tokenAddress);
                                  return untrackedToken ? formatTimeAgo(new Date(untrackedToken.created_at).getTime()) : 'N/A';
                                })()}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-300 text-center py-4">
                {selectedWalletId 
                  ? (activeTab === 'starred' 
                      ? 'No starred tokens found. Star some tokens from other pages to see them here.' 
                      : 'No added tokens found. Add some tokens to track from other pages to see them here.')
                  : 'Select a wallet to view your tokens'
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
    </DashboardLayout>
  );
}
