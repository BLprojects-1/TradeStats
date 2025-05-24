import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import { ProcessedTrade } from '../../services/tradeProcessor';
import { formatTokenAmount, formatSmallPrice, formatDate, formatTime } from '../../utils/formatters';
import TradeInfoModal from '../../components/TradeInfoModal';
import { useRefreshButton } from '../../hooks/useRefreshButton';
import NotificationToast from '../../components/NotificationToast';

const TRADES_PER_PAGE = 20;

export interface TokenTradeData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
  totalBought: number;
  totalSold: number;
  totalTrades: number;
  profitLoss: number;
  lastTransactionTimestamp: number;
  starred?: boolean;
  hasNotes?: boolean;
}

// Helper function to process trades into token summaries with discrepancy checking
const processTradesIntoTokens = async (trades: ProcessedTrade[], userId: string, walletAddress: string): Promise<TokenTradeData[]> => {
  // Group trades by token
  const tokenMap = new Map<string, {
    tokenSymbol: string,
    tokenLogoURI: string | null,
    buys: { amount: number, timestamp: number, valueUSD: number }[],
    sells: { amount: number, timestamp: number, valueUSD: number }[],
    buyValue: number,
    sellValue: number,
    latestTimestamp: number,
    starred: boolean,
    hasNotes: boolean
  }>();
  
  // Process each trade
  for (const trade of trades) {
    // Skip trades without required data
    if (!trade.tokenAddress || !trade.amount) continue;
    
    // Get or create token entry
    let tokenData = tokenMap.get(trade.tokenAddress);
    if (!tokenData) {
      tokenData = {
        tokenSymbol: trade.tokenSymbol,
        tokenLogoURI: trade.tokenLogoURI,
        buys: [],
        sells: [],
        buyValue: 0,
        sellValue: 0,
        latestTimestamp: 0,
        starred: trade.starred || false,
        hasNotes: !!(trade.notes && trade.notes.trim())
      };
      tokenMap.set(trade.tokenAddress, tokenData);
    }
    
    // Update latest timestamp if this trade is more recent
    if (trade.timestamp > tokenData.latestTimestamp) {
      tokenData.latestTimestamp = trade.timestamp;
    }
    
    // Update starred status if any trade for this token is starred
    if (trade.starred) {
      tokenData.starred = true;
    }
    
    // Update notes status if any trade has notes
    if (trade.notes && trade.notes.trim()) {
      tokenData.hasNotes = true;
    }
    
    // Add to buys or sells
    if (trade.type === 'BUY') {
      tokenData.buys.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD
      });
      tokenData.buyValue += trade.valueUSD;
    } else if (trade.type === 'SELL') {
      tokenData.sells.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD
      });
      tokenData.sellValue += trade.valueUSD;
    }
  }
  
  // Calculate metrics for each token and check for discrepancies
  const result: TokenTradeData[] = [];
  
  for (const [tokenAddress, data] of tokenMap.entries()) {
    // Calculate total bought/sold
    const totalBought = data.buys.reduce((sum, buy) => sum + buy.amount, 0);
    const totalSold = data.sells.reduce((sum, sell) => sum + sell.amount, 0);
    
    // Check for 2.5% discrepancy - if found, trigger additional all-time scrape
    const netPosition = Math.abs(totalBought - totalSold);
    const maxAmount = Math.max(totalBought, totalSold);
    const discrepancyPercent = maxAmount > 0 ? (netPosition / maxAmount) * 100 : 0;
    
    if (discrepancyPercent > 2.5) {
      console.log(`Discrepancy detected for ${data.tokenSymbol}: ${discrepancyPercent.toFixed(2)}% - triggering all-time scrape`);
      try {
        // Get all-time trades for this specific token to ensure accuracy
        const allTimeResult = await tradingHistoryService.getAllTokenTrades(
          userId,
          walletAddress,
          tokenAddress
        );
        
        // Recalculate with all-time data
        const allTimeBuys = allTimeResult.trades.filter(t => t.type === 'BUY');
        const allTimeSells = allTimeResult.trades.filter(t => t.type === 'SELL');
        
        if (allTimeBuys.length > 0 || allTimeSells.length > 0) {
          // Update with more accurate all-time data
          data.buys = allTimeBuys.map(t => ({ amount: t.amount || 0, timestamp: t.timestamp, valueUSD: t.valueUSD || 0 }));
          data.sells = allTimeSells.map(t => ({ amount: t.amount || 0, timestamp: t.timestamp, valueUSD: t.valueUSD || 0 }));
          data.buyValue = data.buys.reduce((sum, buy) => sum + buy.valueUSD, 0);
          data.sellValue = data.sells.reduce((sum, sell) => sum + sell.valueUSD, 0);
        }
      } catch (error) {
        console.error(`Error fetching all-time trades for ${tokenAddress}:`, error);
        // Continue with original data if all-time fetch fails
      }
    }
    
    // Recalculate with potentially updated data
    const finalTotalBought = data.buys.reduce((sum, buy) => sum + buy.amount, 0);
    const finalTotalSold = data.sells.reduce((sum, sell) => sum + sell.amount, 0);
    const totalTrades = data.buys.length + data.sells.length;
    const profitLoss = data.sellValue - data.buyValue;
    
    result.push({
      tokenAddress,
      tokenSymbol: data.tokenSymbol,
      tokenLogoURI: data.tokenLogoURI || undefined,
      totalBought: finalTotalBought,
      totalSold: finalTotalSold,
      totalTrades,
      profitLoss,
      lastTransactionTimestamp: data.latestTimestamp,
      starred: data.starred,
      hasNotes: data.hasNotes
    });
  }
  
  // Sort by last transaction timestamp (most recent first)
  return result.sort((a, b) => b.lastTransactionTimestamp - a.lastTransactionTimestamp);
};

export default function TradeLog() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { selectedWalletId, wallets } = useWalletSelection();
  const [tokenTrades, setTokenTrades] = useState<TokenTradeData[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTrades, setTotalTrades] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [solscanLink, setSolscanLink] = useState<string>('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [addingTrade, setAddingTrade] = useState(false);
  const [unstarringTrade, setUnstarringTrade] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number>(0);
  const [swingPlans, setSwingPlans] = useState<Map<string, string>>(new Map());
  
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
    handleRefresh: handleRefreshButton,
    handleDismissNotification
  } = useRefreshButton({
    onRefresh: async () => {
      if (!user?.id || !selectedWalletId) {
        throw new Error('Please select a wallet first.');
      }

      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) {
        throw new Error('Selected wallet not found.');
      }

      return tradingHistoryService.refreshTradingHistory(
        user.id,
        selectedWallet.wallet_address
      );
    }
  });

  // Cooldown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cooldownTimeLeft > 0) {
      interval = setInterval(() => {
        setCooldownTimeLeft(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cooldownTimeLeft]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load token trades
  useEffect(() => {
    const loadTokenTrades = async () => {
      if (!user?.id) return;

      setDataLoading(true);
      setError(null);
      setApiError(null);

      try {
        const selectedWallet = selectedWalletId ? wallets.find(w => w.id === selectedWalletId) : null;
        const walletAddress = selectedWallet?.wallet_address;

        // Get all trading history (not just starred trades)
        const result = await tradingHistoryService.getTradingHistory(
          user.id,
          walletAddress || '',
          1000, // Get more trades to ensure we have comprehensive data
          1
        );

        // Process trades into token summaries with discrepancy checking
        const processedTokens = await processTradesIntoTokens(result.trades, user.id, walletAddress || '');
        setTokenTrades(processedTokens);
        setTotalTrades(processedTokens.length);
        setTotalPages(Math.ceil(processedTokens.length / TRADES_PER_PAGE));
      } catch (err: any) {
        console.error('Error loading token trades:', err);
        setError('Failed to load token trades. Please try again.');
      } finally {
        setDataLoading(false);
      }
    };

    if (user?.id) {
      loadTokenTrades();
    }
  }, [user?.id, selectedWalletId, currentPage]);

  // Load swing plans from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const savedPlans = localStorage.getItem(`swing_plans_${user.id}`);
      if (savedPlans) {
        setSwingPlans(new Map(JSON.parse(savedPlans)));
      }
    }
  }, [user?.id]);

  // Filter trades based on search
  const filteredTrades = tokenTrades.filter(token => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return token.tokenSymbol.toLowerCase().includes(query) ||
             token.tokenAddress.toLowerCase().includes(query);
    }
    return true;
  });

  const handleQuickAdd = async () => {
    if (!solscanLink.trim() || !user?.id) return;

    setAddingTrade(true);
    try {
      // Extract transaction signature from Solscan link
      const signatureMatch = solscanLink.match(/tx\/([A-Za-z0-9]+)/);
      if (!signatureMatch) {
        setError('Invalid Solscan link. Please provide a valid transaction URL.');
        return;
      }

      const signature = signatureMatch[1];
      
      // Here you would implement logic to fetch transaction details and add to starred trades
      // For now, we'll show a placeholder message
      setError('Quick-add functionality will be implemented soon. For now, please star trades from your trading history.');
      setSolscanLink('');
    } catch (err) {
      console.error('Error adding trade:', err);
      setError('Failed to add trade. Please try again.');
    } finally {
      setAddingTrade(false);
    }
  };

  const handleTokenClick = (token: TokenTradeData) => {
    setSelectedTradeModal({
      tokenAddress: token.tokenAddress,
      tokenSymbol: token.tokenSymbol,
      tokenLogoURI: token.tokenLogoURI
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
    <DashboardLayout title="Trade Log">
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-white">Trade Log</h1>
            <button
              onClick={handleRefreshButton}
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
          <p className="text-gray-500">Your personal collection of token trades, notes, and learning insights</p>
          {refreshMessage && (
            <div className={`mt-3 p-3 rounded-md text-sm ${
              refreshMessage.includes('Failed') || refreshMessage.includes('unavailable') 
                ? 'bg-red-900/30 border border-red-500 text-red-200' 
                : 'bg-green-900/30 border border-green-500 text-green-200'
            }`}>
              {refreshMessage}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6">
            {error}
          </div>
        )}

        {apiError && <ApiErrorBanner 
          message={apiError} 
          onRetry={() => {}} 
          errorType={errorType as 'rpc' | 'auth' | 'timeout' | 'general'} 
        />}

        {/* Quick-Add Widget */}
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200">Quick-Add Trade</h2>
            <svg 
              className={`w-6 h-6 text-indigo-400 transform transition-transform ${showQuickAdd ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showQuickAdd && (
            <div className="mt-4 space-y-4">
              <p className="text-gray-400 text-sm">Paste a Solscan transaction link to quickly add it to your trade log</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="https://solscan.io/tx/..."
                  value={solscanLink}
                  onChange={(e) => setSolscanLink(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#23232b] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={addingTrade}
                />
                <button
                  onClick={handleQuickAdd}
                  disabled={addingTrade || !solscanLink.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                >
                  {addingTrade ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add Trade</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter & Search */}
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-[#23232b] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Token Trades Feed */}
          <h2 className="text-lg sm:text-xl font-semibold text-indigo-200 mb-4">Token Trading History ({filteredTrades.length})</h2>
          
          {/* Desktop table - hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Total Trades</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Bought</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P/L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Trade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {dataLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Loading token trades...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTrades.length > 0 ? (
                  filteredTrades.map((token) => (
                    <tr 
                      key={token.tokenAddress} 
                      onClick={() => handleTokenClick(token)}
                      className="bg-[#1a1a1a] hover:bg-[#23232b] transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex items-center space-x-2">
                          {token.tokenLogoURI && (
                            <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-5 h-5 rounded-full" />
                          )}
                          <span>{token.tokenSymbol}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{token.totalTrades}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatTokenAmount(token.totalBought)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatTokenAmount(token.totalSold)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${token.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {token.profitLoss >= 0 ? `+${formatSmallPrice(token.profitLoss)}` : formatSmallPrice(token.profitLoss)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDate(token.lastTransactionTimestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex items-center space-x-2">
                          {token.starred && (
                            <svg className="h-4 w-4 text-yellow-400 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          )}
                          {token.hasNotes && (
                            <svg className="h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">
                      {selectedWalletId ? 'No token trades found for this wallet' : 'Select a wallet to view token trades'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card view - visible only on small screens */}
          <div className="sm:hidden">
            {dataLoading ? (
              <div className="flex items-center justify-center py-4 text-gray-400">
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading token trades...</span>
                </div>
              </div>
            ) : filteredTrades.length > 0 ? (
              <div className="space-y-4">
                {filteredTrades.map((token) => (
                  <div 
                    key={token.tokenAddress} 
                    onClick={() => handleTokenClick(token)}
                    className="bg-[#252525] p-4 rounded-lg cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {token.tokenLogoURI && (
                          <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-white font-medium">{token.tokenSymbol}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {token.starred && (
                          <svg className="h-4 w-4 text-yellow-400 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        )}
                        {token.hasNotes && (
                          <svg className="h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div>
                        <p className="text-gray-400">Total Trades</p>
                        <p className="text-gray-300">{token.totalTrades}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">P/L</p>
                        <p className={`${token.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {token.profitLoss >= 0 ? `+${formatSmallPrice(token.profitLoss)}` : formatSmallPrice(token.profitLoss)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Bought</p>
                        <p className="text-gray-300">{formatTokenAmount(token.totalBought)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Sold</p>
                        <p className="text-gray-300">{formatTokenAmount(token.totalSold)}</p>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400 border-t border-gray-700 pt-2">
                      <span>Last trade: {formatDate(token.lastTransactionTimestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-300 text-center py-4">
                {selectedWalletId ? 'No token trades found for this wallet' : 'Select a wallet to view token trades'}
              </div>
            )}
          </div>
        </div>

        <LoadingToast 
          isVisible={dataLoading} 
          message="Loading your trade log..." 
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
