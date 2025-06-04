import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import { getUserProfile, hasCompletedOnboarding, TrackedWallet } from '../../utils/userProfile';
import { PerformanceChart } from '../PerformanceChart';
import { PerformanceStats } from '../PerformanceStats';
import { PerformanceService, PerformanceData } from '../../services/performanceService';
import { formatTokenAmount, formatSmallPrice, formatPriceWithTwoDecimals } from '../../utils/formatters';
import NotificationToast from '../NotificationToast';
import { useProcessedTradingData } from '../../hooks/useProcessedTradingData';
import { TokenHolding } from '../../utils/historicalTradeProcessing';
import ScanTradesModal from '../ScanTradesModal';
import TradeInfoModal from '../TradeInfoModal';
import RefreshWalletModal from '../RefreshWalletModal';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import { supabase } from '../../utils/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardNavigation } from '../../contexts/DashboardNavigationContext';
import { useRouter } from 'next/router';
import LoadingToast from '../LoadingToast';
import ApiErrorBanner from '../ApiErrorBanner';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { refreshWalletService } from '../../services/refreshWallet';

interface OnboardingData {
  hasCompletedOnboarding: boolean;
  progress: number;
}

const DashboardContent: React.FC = () => {
  const { user, loading, refreshSession } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning, markWalletAsScanning, markWalletScanComplete, getWalletCache, setWalletCache, isCacheValid, reloadWallets } = useWalletSelection();
  const { navigateToPage } = useDashboardNavigation();
  const router = useRouter();
  
  const [showLoadingNotification, setShowLoadingNotification] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [scannedWallets, setScannedWallets] = useState<Set<string>>(new Set());
  const walletsRef = useRef(wallets);

  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [totalProfitLoss, setTotalProfitLoss] = useState<number>(0);
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'incomplete' | 'complete'>('checking');
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [onboardingProgress, setOnboardingProgress] = useState<number>(0);
  const [refreshingTrades, setRefreshingTrades] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number>(0);
  const [showWalletScanModal, setShowWalletScanModal] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [starringTrade, setStarringTrade] = useState<string | null>(null);
  const [starNotification, setStarNotification] = useState<{ show: boolean; tokenSymbol: string; isUnstarring?: boolean }>({ show: false, tokenSymbol: '' });
  const [selectedTradeModal, setSelectedTradeModal] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenLogoURI?: string;
  } | null>(null);

  // New state for trading stats
  const [tradingStats, setTradingStats] = useState({
    totalPnL: 0,
    tokensTraded: 0,
    winRate: 0,
    volume: 0,
    bestTrade: 0,
    worstTrade: 0,
    avgTradeSize: 0
  });

  // Use our processed trading data hook
  const {
    data: initialOpenTrades,
    loading: tradesLoading,
    error: tradesError,
    refreshData
  } = useProcessedTradingData({
    autoLoad: false,
    dataType: 'openTrades'
  });

  // Add hooks for trading history and top trades data
  const {
    data: tradingHistoryData,
    loading: historyLoading
  } = useProcessedTradingData({
    autoLoad: false,
    dataType: 'tradingHistory'
  });

  const {
    data: topTradesData,
    loading: topTradesLoading
  } = useProcessedTradingData({
    autoLoad: false,
    dataType: 'topTrades'
  });

  // Create a local state to manage the open trades data
  const [openTrades, setOpenTrades] = useState<TokenHolding[]>([]);

  // Update local state when data from the hook changes
  useEffect(() => {
    if (initialOpenTrades) {
      setOpenTrades(initialOpenTrades);
    }
  }, [initialOpenTrades]);

  // Add new state for historical analysis
  const [historicalAnalysis, setHistoricalAnalysis] = useState<any>(null);
  const [analyzingHistory, setAnalyzingHistory] = useState(false);

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
    const checkOnboardingStatus = async () => {
      if (!user?.id) {
        console.error('No user ID available for onboarding check');
        return;
      }

      try {
        setIsCheckingOnboarding(true);
        setError(null);

        // Check if user has completed onboarding
        const completed = await hasCompletedOnboarding(user.id);
      } catch (err) {
        console.error('Error checking onboarding status:', err);
        setError('Failed to check onboarding status. Please refresh the page.');
      } finally {
        setIsCheckingOnboarding(false);
      }
    };

    if (user) {
      checkOnboardingStatus();
    }
  }, [user]);

  // Keep wallets ref updated
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  // Derive selectedWallet from selectedWalletId and wallets
  const selectedWallet = selectedWalletId ? wallets.find(w => w.id === selectedWalletId) : null;

  // Load performance data when wallet is selected
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!selectedWalletId || !user?.id) {
        setPerformanceData(null);
        return;
      }

      setPerformanceLoading(true);
      try {
        const data = await PerformanceService.getPerformanceData(user.id, selectedWalletId);
        setPerformanceData(data);
      } catch (err) {
        console.error('Error loading performance data:', err);
        setError('Failed to load performance data. Please try again.');
      } finally {
        setPerformanceLoading(false);
      }
    };

    loadPerformanceData();
  }, [selectedWalletId, user?.id]);

  // Load trading statistics
  useEffect(() => {
    const loadTradingStats = async () => {
      if (!selectedWalletId || !user?.id) {
        setTradingStats({
          totalPnL: 0,
          tokensTraded: 0,
          winRate: 0,
          volume: 0,
          bestTrade: 0,
          worstTrade: 0,
          avgTradeSize: 0
        });
        return;
      }

      try {
        // Calculate comprehensive stats from trading history and top trades
        const allTrades = tradingHistoryData || [];
        const topTrades = topTradesData || [];
        
        console.log('🔍 Trading Stats Debug:', {
          allTradesCount: allTrades.length,
          topTradesCount: topTrades.length,
          sampleAllTrade: allTrades[0],
          sampleTopTrade: topTrades[0]
        });
        
        // Calculate total volume from trading history
        const totalVolume = allTrades.reduce((sum: number, trade: any) => 
          sum + (trade.valueUSD || 0), 0
        );
        
        // Calculate P&L from top trades data
        const totalPnL = topTrades.reduce((sum: number, trade: any) => 
          sum + (trade.profitLoss || 0), 0
        );
        
        // Calculate unique tokens traded
        const uniqueTokens = new Set(allTrades.map((trade: any) => trade.tokenAddress));
        const tokensTraded = uniqueTokens.size;
        
        // Calculate win rate from top trades data (profitable vs unprofitable trades)
        let winRate = 0;
        if (topTrades.length > 0) {
          // Count profitable vs unprofitable trades from top trades data
          const profitableTrades = topTrades.filter((trade: any) => {
            const profitLoss = trade.profitLoss || trade.profit_loss || trade.pnl || trade.totalProfitLoss || 0;
            return profitLoss > 0;
          });
          
          const unprofitableTrades = topTrades.filter((trade: any) => {
            const profitLoss = trade.profitLoss || trade.profit_loss || trade.pnl || trade.totalProfitLoss || 0;
            return profitLoss < 0;
          });
          
          // Calculate win rate: profitable trades / (profitable + unprofitable trades) * 100
          const totalTradesWithResult = profitableTrades.length + unprofitableTrades.length;
          winRate = totalTradesWithResult > 0 ? (profitableTrades.length / totalTradesWithResult) * 100 : 0;
          
          console.log('🎯 Win Rate Debug:', {
            profitableCount: profitableTrades.length,
            unprofitableCount: unprofitableTrades.length,
            totalWithResult: totalTradesWithResult,
            calculatedWinRate: winRate
          });
        } else if (allTrades.length > 0) {
          // Fallback: use trading history approach
          const buyTrades = allTrades.filter((trade: any) => trade.type === 'BUY');
          const sellTrades = allTrades.filter((trade: any) => trade.type === 'SELL');
          
          // Simple heuristic based on trade balance
          if (buyTrades.length > 0 && sellTrades.length > 0) {
            const totalTrades = buyTrades.length + sellTrades.length;
            const balanceRatio = Math.min(buyTrades.length, sellTrades.length) / Math.max(buyTrades.length, sellTrades.length);
            
            if (balanceRatio > 0.8) { // If trades are roughly balanced (80%+ ratio)
              winRate = 50; // Show 50% for balanced trading
            } else {
              winRate = (sellTrades.length / totalTrades) * 100;
            }
          }
        }
        
        // Find best and worst trades - try multiple field names and fallback options
        let bestTrade = 0;
        let worstTrade = 0;
        
        if (topTrades.length > 0) {
          const profitLossValues = topTrades.map((trade: any) => {
            // Try different possible field names for profit/loss
            return trade.profitLoss || trade.profit_loss || trade.pnl || trade.totalProfitLoss || 0;
          }).filter(val => val !== 0); // Remove zero values
          
          if (profitLossValues.length > 0) {
            bestTrade = Math.max(...profitLossValues);
            worstTrade = Math.min(...profitLossValues);
          }
        }
        
        // If no top trades data, calculate from trading history
        if (bestTrade === 0 && worstTrade === 0 && allTrades.length > 0) {
          const tradeValues = allTrades.map((trade: any) => trade.valueUSD || 0).filter(val => val > 0);
          if (tradeValues.length > 0) {
            bestTrade = Math.max(...tradeValues);
            worstTrade = Math.min(...tradeValues);
          }
        }
        
        // Calculate average trade size from all trades
        const avgTradeSize = allTrades.length > 0 ? totalVolume / allTrades.length : 0;

        console.log('📊 Calculated Stats:', {
          totalPnL,
          tokensTraded,
          winRate,
          volume: totalVolume,
          bestTrade,
          worstTrade,
          avgTradeSize
        });

        setTradingStats({
          totalPnL,
          tokensTraded,
          winRate,
          volume: totalVolume,
          bestTrade,
          worstTrade,
          avgTradeSize
        });
      } catch (error) {
        console.error('Error loading trading stats:', error);
        // Set to defaults on error
        setTradingStats({
          totalPnL: 0,
          tokensTraded: 0,
          winRate: 0,
          volume: 0,
          bestTrade: 0,
          worstTrade: 0,
          avgTradeSize: 0
        });
      }
    };

    loadTradingStats();
  }, [selectedWalletId, user?.id, tradingHistoryData, topTradesData]);

  // Additional handlers from original dashboard
  const handleScanComplete = () => {
    setShowWalletScanModal(false);
  };

  const handleWalletScanSuccess = (result: { newTradesCount: number, message: string }) => {
    setRefreshMessage(result.message);
    setShowWalletScanModal(false);
    setTimeout(() => setRefreshMessage(null), 5000);
    // Refresh the UI data after successful scan
    refreshData();
  };

  const handleStarTrade = async (tokenAddress: string, tokenSymbol: string) => {
    if (!user?.id || !selectedWalletId) return;

    setStarringTrade(tokenAddress);
    try {
      // Star trade logic here
      setStarNotification({ show: true, tokenSymbol });
      setTimeout(() => setStarNotification({ show: false, tokenSymbol: '' }), 3000);
    } catch (error) {
      console.error('Error starring trade:', error);
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

  const handleRefreshTrades = async () => {
    if (refreshing || cooldownTimeLeft > 0) return;
    
    // Check if wallet is selected
    if (!user?.id || !selectedWalletId || !selectedWallet) {
      setRefreshMessage('Please select a wallet first.');
      setTimeout(() => setRefreshMessage(null), 3000);
      return;
    }
    
    // Show the WalletScanModal
    setShowWalletScanModal(true);
  };

  const handleViewHistory = () => {
    navigateToPage('trading-history');
  };

  const handleAccountSettings = () => {
    navigateToPage('account');
  };

  const copyWalletAddress = async () => {
    if (selectedWallet) {
      try {
        await navigator.clipboard.writeText(selectedWallet.wallet_address);
        setRefreshMessage('Wallet address copied to clipboard!');
        setTimeout(() => setRefreshMessage(null), 2000);
      } catch (error) {
        console.error('Failed to copy wallet address:', error);
      }
    }
  };

  // Loading state
  if (loading || isCheckingOnboarding) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Loading TradeStats dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div className="space-y-8">
      {/* 2.3 Portfolio / Open Trades / Wallet Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        role="region"
        aria-label="Portfolio summary cards"
      >
        {/* Portfolio Overview Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-6 hover:border-emerald-400/40 transition-all duration-300">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-200">Portfolio</h3>
          </div>
          <p className="text-gray-400 mb-3">Track your trading performance with real-time analytics</p>
          <div className="text-2xl font-bold text-emerald-300 font-mono">
            {formatPriceWithTwoDecimals(openTrades.reduce((sum, trade) => sum + (trade.totalValue || 0), 0))}
          </div>
          <p className="text-sm text-gray-500">Total Portfolio Value</p>
        </div>

        {/* Open Trades Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-6 hover:border-emerald-400/40 transition-all duration-300">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-200">Open Trades</h3>
          </div>
          <p className="text-gray-400 mb-3">Currently active trading positions</p>
          <div className="text-2xl font-bold text-blue-300 font-mono">{openTrades.length}</div>
          <p className="text-sm text-gray-500">Active Positions</p>
        </div>

        {/* Wallet Status Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-6 hover:border-emerald-400/40 transition-all duration-300">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-200">Wallet</h3>
          </div>
          {selectedWallet ? (
            <div>
              <p className="text-gray-400 mb-3">Currently selected wallet</p>
              <button
                onClick={copyWalletAddress}
                className="text-lg font-bold text-purple-300 hover:text-purple-200 transition-colors duration-200 font-mono cursor-pointer"
                title="Click to copy full wallet address"
                aria-label="Copy wallet address to clipboard"
              >
                {selectedWallet.wallet_address.substring(0, 8)}…{selectedWallet.wallet_address.substring(selectedWallet.wallet_address.length - 6)}
              </button>
              <p className="text-sm text-gray-500">Active Wallet</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 mb-3">No wallet selected</p>
              <div className="text-lg font-bold text-gray-500">Select a wallet</div>
              <p className="text-sm text-gray-500">Get started</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* 2.4 Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-8"
        role="region"
        aria-label="Quick actions"
      >
        <h3 className="text-2xl font-bold text-gray-200 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={handleRefreshTrades}
            disabled={refreshing || cooldownTimeLeft > 0}
            className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 disabled:from-gray-600/20 disabled:to-gray-700/20 text-emerald-200 disabled:text-gray-400 px-6 py-4 rounded-xl font-medium transition-all duration-300 border border-emerald-400/30 hover:border-emerald-300/50 disabled:border-gray-500/30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label={refreshing ? 'Refreshing data' : cooldownTimeLeft > 0 ? `Refresh data (wait ${cooldownTimeLeft}s)` : 'Refresh trading data'}
            title={cooldownTimeLeft > 0 ? `Last updated. Wait ${cooldownTimeLeft} seconds.` : undefined}
          >
            {refreshing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
                <span>Refreshing...</span>
              </div>
            ) : cooldownTimeLeft > 0 ? (
              `Wait ${cooldownTimeLeft}s`
            ) : (
              'Refresh Data'
            )}
          </button>
          <button
            onClick={handleViewHistory}
            className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 text-blue-200 px-6 py-4 rounded-xl font-medium transition-all duration-300 border border-blue-400/30 hover:border-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="View trading history"
          >
            View History
          </button>
          <button
            onClick={handleAccountSettings}
            className="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 text-purple-200 px-6 py-4 rounded-xl font-medium transition-all duration-300 border border-purple-400/30 hover:border-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Open account settings"
          >
            Account Settings
          </button>
        </div>
      </motion.div>

      {/* 2.5 Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-8"
        role="region"
        aria-label="Trading statistics summary"
      >
        <h3 className="text-2xl font-bold text-gray-200 mb-6">Trading Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
          {/* P/L */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <h4 className="text-sm font-medium text-gray-400">P/L</h4>
              <button
                className="ml-1 text-gray-500 hover:text-gray-300 transition-colors"
                title="Profit and Loss from all trades"
                aria-label="What is P/L?"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            <div className={`text-2xl font-bold font-mono ${tradingStats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {tradingStats.totalPnL !== 0 ? formatPriceWithTwoDecimals(tradingStats.totalPnL) : '–'}
            </div>
          </div>

          {/* Tokens Traded */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <h4 className="text-sm font-medium text-gray-400">Tokens Traded</h4>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {tradingStats.tokensTraded || '–'}
            </div>
          </div>

          {/* Win Rate */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <h4 className="text-sm font-medium text-gray-400">Win Rate</h4>
              <button
                className="ml-1 text-gray-500 hover:text-gray-300 transition-colors"
                title="Percentage of profitable trades"
                aria-label="What is Win Rate?"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {tradingStats.tokensTraded > 0 ? `${tradingStats.winRate.toFixed(1)}%` : '–'}
            </div>
            {tradingStats.tokensTraded > 0 && (
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div 
                  className={`h-1 rounded-full ${tradingStats.winRate >= 60 ? 'bg-green-400' : tradingStats.winRate >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(tradingStats.winRate, 100)}%` }}
                ></div>
              </div>
            )}
          </div>

          {/* Volume */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <h4 className="text-sm font-medium text-gray-400">Volume</h4>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {tradingStats.volume > 0 ? formatPriceWithTwoDecimals(tradingStats.volume) : '–'}
            </div>
          </div>

          {/* Best Trade */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <h4 className="text-sm font-medium text-gray-400">Best Trade</h4>
            </div>
            <div className={`text-2xl font-bold font-mono ${tradingStats.bestTrade >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {tradingStats.bestTrade !== 0 ? formatPriceWithTwoDecimals(tradingStats.bestTrade) : '–'}
            </div>
          </div>

          {/* Worst Trade */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <h4 className="text-sm font-medium text-gray-400">Worst Trade</h4>
            </div>
            <div className={`text-2xl font-bold font-mono ${tradingStats.worstTrade >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {tradingStats.worstTrade !== 0 ? formatPriceWithTwoDecimals(tradingStats.worstTrade) : '–'}
            </div>
          </div>

          {/* Avg Trade Size */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <h4 className="text-sm font-medium text-gray-400">Avg Trade Size</h4>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {tradingStats.avgTradeSize > 0 ? formatPriceWithTwoDecimals(tradingStats.avgTradeSize) : '–'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2.6 Realized P/L Chart */}
      {performanceData && performanceData.dataPoints.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-6"
          role="region"
          aria-label="24-hour performance chart"
        >
          <h3 className="text-xl font-bold text-gray-200 mb-4">24-Hour Performance Tracking</h3>
          <PerformanceChart dataPoints={performanceData.dataPoints} />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-6 text-center"
          role="region"
          aria-label="Performance chart placeholder"
        >
          <h3 className="text-xl font-bold text-gray-200 mb-4">24-Hour Performance Tracking</h3>
          <div className="py-12">
            <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-gray-400">No trades in the last 24 hours</p>
            <p className="text-sm text-gray-500 mt-2">Chart will appear once you start trading</p>
          </div>
        </motion.div>
      )}

      {/* Performance Stats */}
      {performanceData && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <PerformanceStats metrics={performanceData.metrics} />
        </motion.div>
      )}

      {/* Modals */}
      {selectedTradeModal && (
        <TradeInfoModal
          isOpen={!!selectedTradeModal}
          onClose={handleCloseModal}
          tokenAddress={selectedTradeModal.tokenAddress}
          tokenSymbol={selectedTradeModal.tokenSymbol}
          tokenLogoURI={selectedTradeModal.tokenLogoURI}
          walletAddress={selectedWallet?.wallet_address || ''}
          mode="open-trades"
        />
      )}

      {showWalletScanModal && selectedWallet && user?.id && (
        <RefreshWalletModal
          isOpen={showWalletScanModal}
          onClose={() => setShowWalletScanModal(false)}
          onSuccess={handleWalletScanSuccess}
          walletAddress={selectedWallet.wallet_address}
          userId={user.id}
        />
      )}

      {/* Notifications */}
      <AnimatePresence>
        {refreshMessage && (
          <NotificationToast
            message={refreshMessage}
            isVisible={!!refreshMessage}
            type="success"
            autoDismissMs={3000}
            onDismiss={() => setRefreshMessage(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DashboardContent; 