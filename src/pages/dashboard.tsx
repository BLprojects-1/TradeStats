import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { getUserProfile, hasCompletedOnboarding, TrackedWallet } from '../utils/userProfile';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { PerformanceChart } from '../components/PerformanceChart';
import { PerformanceStats } from '../components/PerformanceStats';

import { PerformanceService, PerformanceData } from '../services/performanceService';
import { formatTokenAmount, formatSmallPrice, formatPriceWithTwoDecimals } from '../utils/formatters';
import NotificationToast from '../components/NotificationToast';
import { useProcessedTradingData } from '../hooks/useProcessedTradingData';
import { TokenHolding } from '../utils/historicalTradeProcessing';
import ScanTradesModal from '../components/ScanTradesModal';
import TradeInfoModal from '../components/TradeInfoModal';
import WalletScanModal from '../components/WalletScanModal';
import { tradingHistoryService } from '../services/tradingHistoryService';
import { supabase } from '../utils/supabaseClient';
import TradeChecklist from '../components/TradeChecklist';
import TrafficInfoModal from '../components/TrafficInfoModal';

interface OnboardingData {
  hasCompletedOnboarding: boolean;
  progress: number;
}

export default function Dashboard() {
  const { user, loading, refreshSession } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning, markWalletAsScanning, markWalletScanComplete, getWalletCache, setWalletCache, isCacheValid, reloadWallets } = useWalletSelection();
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
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedWalletForScan, setSelectedWalletForScan] = useState<TrackedWallet | null>(null);
  const [starringTrade, setStarringTrade] = useState<string | null>(null);
  const [starNotification, setStarNotification] = useState<{ show: boolean; tokenSymbol: string; isUnstarring?: boolean }>({ show: false, tokenSymbol: '' });
  const [selectedTradeModal, setSelectedTradeModal] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenLogoURI?: string;
  } | null>(null);
  const [showWalletScanModal, setShowWalletScanModal] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [hasTradeChecklistItems, setHasTradeChecklistItems] = useState(false);

  // Use our processed trading data hook
  const {
    data: initialOpenTrades,
    loading: tradesLoading,
    error: tradesError,
    refreshData
  } = useProcessedTradingData({
    autoLoad: false, // Don't auto-load data to prevent historicalPriceService from running on refresh
    dataType: 'openTrades'
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
    // If not loading and no user, redirect to home page
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

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
        
        // Check if user has trade checklist items
        await checkTradeChecklistItems();
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

  const checkTradeChecklistItems = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('trade_checklist_items')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.error('Error checking trade checklist items:', error);
        return;
      }

      setHasTradeChecklistItems(data && data.length > 0);
    } catch (error) {
      console.error('Error checking trade checklist items:', error);
    }
  };

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

  const handleScanComplete = () => {
    setRefreshMessage('Trading history analysis completed!');
    setTimeout(() => setRefreshMessage(null), 5000);
  };

  const handleWalletScanSuccess = (result: { newTradesCount: number, message: string }) => {
    setRefreshMessage(result.message);
    setTimeout(() => setRefreshMessage(null), 5000);
  };

  const handleStarTrade = async (tokenAddress: string, tokenSymbol: string) => {
    if (!user?.id || !selectedWalletId) return;

    setStarringTrade(tokenAddress);
    try {
      // Find the token to check its current starred status
      const token = openTrades.find(t => t.tokenAddress === tokenAddress);
      if (!token) return;

      const isCurrentlyStarred = token.starred;
      const newStarredStatus = !isCurrentlyStarred;

      // Update local state
      setOpenTrades(prev => prev.map(token => 
        token.tokenAddress === tokenAddress 
          ? { ...token, starred: newStarredStatus }
          : token
      ));

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
        }
      } catch (dbError) {
        console.error('Error updating starred status in database:', dbError);
      }

      // Show notification based on whether we're starring or unstarring
      setStarNotification({ 
        show: true, 
        tokenSymbol,
        isUnstarring: isCurrentlyStarred
      });

      // Hide notification after 3 seconds
      setTimeout(() => {
        setStarNotification({ show: false, tokenSymbol: '', isUnstarring: false });
      }, 3000);
    } catch (err) {
      console.error('Error starring trades for token:', err);
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
    if (!selectedWalletId || !user?.id || refreshing) return;

    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet || !selectedWallet.initial_scan_complete) return;

    // Check cooldown
    const now = Date.now();
    const cooldownMs = 2 * 60 * 1000; // 2 minutes
    const timeSinceLastRefresh = now - lastRefreshTime;

    if (timeSinceLastRefresh < cooldownMs) {
      const timeLeft = Math.ceil((cooldownMs - timeSinceLastRefresh) / 1000);
      setCooldownTimeLeft(timeLeft);
      setRefreshMessage(`Please try again in ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`);
      setTimeout(() => setRefreshMessage(null), 3000);
      return;
    }

    // Show wallet scan modal instead of directly refreshing
    setShowWalletScanModal(true);
    return;

    // The code below will only run if the wallet scan modal is not shown
    setRefreshing(true);
    setRefreshMessage(null);
    setLastRefreshTime(now);

    try {
      await refreshData();
      setRefreshMessage("Trading data refreshed successfully!");

      // Clear message after 5 seconds
      setTimeout(() => setRefreshMessage(null), 5000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setRefreshMessage('Failed to refresh data. Please try again.');
      setTimeout(() => setRefreshMessage(null), 5000);
    } finally {
      setRefreshing(false);
    }
  };

  // Automatically close scan modal after onboarding
  useEffect(() => {
    if (showScanModal) {
      setShowScanModal(false);
      setSelectedWalletForScan(null);
    }
  }, [showScanModal]);

  // Show loading state while checking authentication
  if (loading || isCheckingOnboarding) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        {/* Background Elements - Reduced glows */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="animate-pulse text-indigo-400 text-xl mb-4">Loading your trading dashboard...</div>
          <div className="w-32 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Only render dashboard if user is authenticated
  if (!user) {
    return null;
  }

  const isLoadingTrades = tradesLoading;

  // Checklist UI
  const hasWallet = wallets.length > 0;

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-gray-100 overflow-hidden">
      {/* Background Elements - Reduced glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3 bg-indigo-500/3 blur-[50px] rounded-full"></div>
      </div>

      <DashboardLayout title="Dashboard">
        <div className="relative z-10 space-y-6">
          {/* Enhanced Header Section - Reduced glows */}
          <div className="relative">
            <div className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    Trading Command Center
                  </h1>
                  <p className="text-gray-300">Master your Solana trading performance</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      activeSection === 'overview'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/15'
                        : 'bg-[#252525]/80 text-gray-400 hover:text-white hover:bg-[#303030]'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Overview</span>
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveSection('checklist')}
                    className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      activeSection === 'checklist'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/15'
                        : 'bg-[#252525]/80 text-gray-400 hover:text-white hover:bg-[#303030]'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Trade Checklist</span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Enhanced Status Message */}
              {refreshMessage && (
                <div className={`p-4 rounded-xl border backdrop-blur-sm ${
                  refreshMessage.includes('Failed') || refreshMessage.includes('unavailable') 
                    ? 'bg-red-900/20 border-red-500/30 text-red-200' 
                    : 'bg-green-900/20 border-green-500/30 text-green-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                      refreshMessage.includes('Failed') ? 'bg-red-400' : 'bg-green-400'
                    }`}></div>
                    <span className="font-medium">{refreshMessage}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Getting Started & Tools Section - Made equal height */}
          {activeSection === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Getting Started Checklist - Enhanced and made equal height */}
              <div className="relative group h-full flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-indigo-500/40 flex-1 flex flex-col min-h-[400px]">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white">Getting Started</h2>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-indigo-500/30 hover:bg-indigo-500/10 hover:border-transparent transition-all duration-300 group/item">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        hasWallet ? 'border-green-500 bg-green-500/20' : 'border-gray-500 bg-gray-800/50'
                      }`}>
                        {hasWallet && <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="text-white font-medium flex-1 group-hover/item:text-gray-200 transition-colors">Add your wallet</span>
                      {!hasWallet && (
                        <button
                          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-500 hover:to-indigo-400 text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg shadow-indigo-900/15"
                          onClick={() => router.push('/dashboard/account')}
                        >
                          Get Started
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-indigo-500/30 hover:bg-indigo-500/10 hover:border-transparent transition-all duration-300 group/item">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        hasTradeChecklistItems ? 'border-green-500 bg-green-500/20' : 'border-gray-500 bg-gray-800/50'
                      }`}>
                        {hasTradeChecklistItems && <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="text-white font-medium flex-1 group-hover/item:text-gray-200 transition-colors">Create trading criteria</span>
                      {!hasTradeChecklistItems && (
                        <button
                          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-500 hover:to-indigo-400 text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg shadow-indigo-900/15"
                          onClick={() => router.push('/dashboard/trade-checklist')}
                        >
                          Create
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Trading Tools Section - Enhanced */}
              <div className="relative group h-full flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-indigo-500/40 flex-1 flex flex-col min-h-[400px]">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white">Trading Tools</h2>
                  </div>
                  
                  <div className="space-y-3 flex-1">
                    {[
                      { name: 'Dexscreener', desc: 'Real-time DEX charts & analytics', logo: '/dexscreener.png', url: 'https://dexscreener.com' },
                      { name: 'Axiom', desc: 'Advanced trading platform', logo: '/axiom.jpg', url: 'https://axiom.trade/@ryvu' },
                      { name: 'BullX', desc: 'Multi-chain trading bot', logo: '/bullx.jpg', url: 'https://bull-x.io' }
                    ].map((tool, index) => (
                      <a
                        key={tool.name}
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-purple-500/30 hover:bg-purple-500/10 hover:border-transparent transition-all duration-300 group/tool transform hover:scale-[1.02]"
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg">
                          <img src={tool.logo} alt={tool.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-white font-medium group-hover/tool:text-gray-200 transition-colors">{tool.name}</h3>
                          <p className="text-gray-400 text-sm group-hover/tool:text-gray-300 transition-colors">{tool.desc}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover/tool:text-purple-400 transition-colors transform group-hover/tool:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'overview' ? (
            <>
              {/* Error Display */}
              {(error || tradesError) && (
                <div className="bg-gradient-to-r from-red-900/30 to-red-800/30 backdrop-blur-sm border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl shadow-lg shadow-red-900/10">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error || tradesError}</span>
                    <button 
                      onClick={() => window.location.reload()}
                      className="ml-auto underline hover:text-white transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              )}

              {/* Enhanced Open Positions Section - Reduced glows */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-50 blur-md transition-all duration-700 rounded-3xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl p-8 shadow-xl shadow-indigo-900/10 transition-all duration-500 hover:border-indigo-500/40">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-900/15">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                          Open Positions
                        </h2>
                        <p className="text-gray-400">Real-time portfolio tracking</p>
                      </div>
                    </div>
                    
                    {selectedWalletId && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete && (
                      <button
                        onClick={handleRefreshTrades}
                        disabled={refreshing || cooldownTimeLeft > 0}
                        className="group/btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2 shadow-lg shadow-indigo-900/15 transition-all duration-300 transform hover:scale-105 disabled:scale-100"
                      >
                        {refreshing ? (
                          <>
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Refreshing...</span>
                          </>
                        ) : cooldownTimeLeft > 0 ? (
                          <>
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{Math.floor(cooldownTimeLeft / 60)}:{(cooldownTimeLeft % 60).toString().padStart(2, '0')}</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-5 w-5 group-hover/btn:rotate-180 transition-transform duration-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Refresh Data</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Responsive table - scrollable on all screen sizes */}
                  <div className="overflow-x-auto">
                    <div className="min-w-full inline-block align-middle">
                      <table className="min-w-full divide-y divide-indigo-500/20">
                        <thead>
                          <tr className="bg-slate-950/40">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Star</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Token</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Bought</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Sold</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Remaining Balance</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Unrealized P/L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-500/10">
                          {isLoadingTrades ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center">
                                <div className="flex items-center justify-center space-x-3">
                                  <div className="relative">
                                    <div className="w-8 h-8 border-4 border-slate-600/30 border-t-slate-500 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-t-indigo-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                  </div>
                                  <span className="text-slate-400 font-medium">Loading open trades...</span>
                                </div>
                              </td>
                            </tr>
                          ) : openTrades.length > 0 ? (
                            openTrades.map((token) => (
                              <tr 
                                key={token.tokenAddress} 
                                className="group bg-white/2 hover:bg-indigo-500/10 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/10" 
                                onClick={() => handleTradeClick && handleTradeClick(token)}
                              >
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStarTrade(token.tokenAddress, token.tokenSymbol);
                                    }}
                                    disabled={starringTrade === token.tokenAddress}
                                    className="p-2 rounded-lg hover:bg-slate-800/50 hover:text-yellow-400 transition-all duration-300 disabled:opacity-50"
                                    aria-label={token.starred ? 'Unstar token' : 'Star token'}
                                  >
                                    {starringTrade === token.tokenAddress ? (
                                      <div className="relative">
                                        <div className="w-4 h-4 border-2 border-slate-600/30 border-t-slate-500 rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 w-4 h-4 border-2 border-transparent border-t-indigo-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                      </div>
                                    ) : (
                                      <svg 
                                        className={`h-4 w-4 transition-all duration-300 ${token.starred ? 'text-yellow-400 fill-current' : 'text-slate-400 group-hover:text-slate-300'}`} 
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
                                      <div className="flex-shrink-0">
                                        <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-8 h-8 rounded-full border border-slate-600/30" />
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-sm font-semibold text-slate-100">{token.tokenSymbol}</div>
                                      <div className="text-xs text-slate-400 font-mono truncate max-w-[120px]">
                                        {token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-slate-200">
                                    {formatTokenAmount(token.totalBought)}
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-slate-200">
                                    {formatTokenAmount(token.totalSold)}
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-slate-200">
                                    {formatTokenAmount(token.netPosition)}
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className={`text-sm font-semibold ${(token.profitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {formatPriceWithTwoDecimals(token.profitLoss || 0)}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center">
                                <div className="text-slate-400">
                                  {wallets.length === 0 ? 'No wallets connected' : !selectedWalletId ? 'Select a wallet to see your open positions' : 'No trades found for this wallet'}
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Enhanced Summary Section */}
                  {openTrades.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-indigo-500/20">
                      <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-6">
                        Portfolio Summary
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-25 group-hover:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                          <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-indigo-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-indigo-500/40 hover:transform hover:scale-[1.02]">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                              <h4 className="text-indigo-300 font-semibold">Open Positions</h4>
                            </div>
                            <p className="text-3xl font-bold text-white mb-1">{openTrades.length}</p>
                            <p className="text-gray-400 text-sm">Active trades</p>
                          </div>
                        </div>

                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-25 group-hover:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                          <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-indigo-500/40 p-6 rounded-2xl transition-all duration-500 hover:border-purple-500/40 hover:transform hover:scale-[1.02]">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                              </div>
                              <h4 className="text-purple-300 font-semibold">Total Value</h4>
                            </div>
                            <p className="text-3xl font-bold text-white mb-1">
                              {formatPriceWithTwoDecimals(openTrades.reduce((sum, token) => sum + (token.totalValue || 0), 0))}
                            </p>
                            <p className="text-gray-400 text-sm">Portfolio value</p>
                          </div>
                        </div>

                        <div className="relative group">
                          <div className={`absolute inset-0 opacity-25 group-hover:opacity-40 blur transition-all duration-500 rounded-2xl ${
                            openTrades.reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 
                              ? 'bg-gradient-to-r from-green-600 to-emerald-600' 
                              : 'bg-gradient-to-r from-red-600 to-rose-600'
                          }`}></div>
                          <div className={`relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-indigo-500/40 p-6 rounded-2xl transition-all duration-500 hover:transform hover:scale-[1.02] ${
                            openTrades.reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 
                              ? 'border-green-500/40 hover:border-green-500/40' 
                              : 'border-red-500/40 hover:border-red-500/40'
                          }`}>
                            <div className="flex items-center space-x-3 mb-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                openTrades.reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 
                                  ? 'bg-gradient-to-br from-green-600 to-emerald-600' 
                                  : 'bg-gradient-to-br from-red-600 to-rose-600'
                              }`}>
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                              </div>
                              <h4 className={`font-semibold ${
                                openTrades.reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 ? 'text-green-300' : 'text-red-300'
                              }`}>Unrealized P/L</h4>
                            </div>
                            <p className={`text-3xl font-bold mb-1 flex items-center ${
                              openTrades.reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {openTrades.reduce((sum, token) => sum + (token.profitLoss || 0), 0) >= 0 ? '↗' : '↘'} 
                              {formatPriceWithTwoDecimals(openTrades.reduce((sum, token) => sum + (token.profitLoss || 0), 0))}
                            </p>
                            <p className="text-gray-400 text-sm">Current session</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Performance Overview Section - Reduced glows */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-cyan-600 opacity-0 group-hover:opacity-50 blur-md transition-all duration-700 rounded-3xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-purple-500/40 rounded-3xl p-8 shadow-xl shadow-indigo-900/10 transition-all duration-500 hover:border-indigo-500/40">
                  <div className="flex items-center space-x-4 mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-900/15">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                        Performance Analytics
                      </h2>
                      <p className="text-gray-400">24-hour trading performance insights</p>
                    </div>
                  </div>

                  {performanceLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-purple-600/30 border-t-purple-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                      </div>
                      <span className="text-purple-300 font-medium">Analyzing your performance...</span>
                    </div>
                  ) : wallets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-purple-600/20 to-cyan-600/20 rounded-3xl flex items-center justify-center">
                        <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-300 font-medium text-lg mb-2">No wallets connected</p>
                        <p className="text-gray-500">Connect a wallet to see your performance analytics</p>
                      </div>
                    </div>
                  ) : !selectedWalletId ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-purple-600/20 to-cyan-600/20 rounded-3xl flex items-center justify-center">
                        <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-300 font-medium text-lg mb-2">Select a wallet</p>
                        <p className="text-gray-500">Choose a wallet to view your performance metrics</p>
                      </div>
                    </div>
                  ) : performanceData ? (
                    <div className="space-y-8">
                      {/* Enhanced Performance Chart Container */}
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-25 group-hover:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                        <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-purple-500/40 rounded-2xl p-6 transition-all duration-500 hover:border-purple-500/40 hover:transform hover:scale-[1.01]">
                          <PerformanceChart dataPoints={performanceData.dataPoints} />
                        </div>
                      </div>

                      {/* Enhanced Performance Statistics Container */}
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 opacity-25 group-hover:opacity-40 blur transition-all duration-500 rounded-2xl"></div>
                        <div className="relative bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-cyan-500/40 rounded-2xl p-6 transition-all duration-500 hover:border-cyan-500/40 hover:transform hover:scale-[1.01]">
                          <PerformanceStats metrics={performanceData.metrics} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-red-600/20 to-orange-600/20 rounded-3xl flex items-center justify-center">
                        <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-300 font-medium text-lg mb-2">Unable to load data</p>
                        <p className="text-gray-500">Performance data is temporarily unavailable</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 blur-md transition-all duration-700 rounded-3xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl p-8 shadow-xl shadow-indigo-900/10">
                <TradeChecklist />
              </div>
            </div>
          )}
        </div>

        {/* All existing modals and notifications with enhanced styling */}
        <NotificationToast
          message={loadingMessage || ''}
          isVisible={showLoadingNotification}
          type={loadingMessage?.includes('Failed') ? 'error' : 'info'}
          autoDismissMs={3000}
          onDismiss={() => setShowLoadingNotification(false)}
        />

        <NotificationToast
          message={refreshMessage || ''}
          isVisible={showNotification}
          type="success"
          autoDismissMs={5000}
          onDismiss={() => setShowNotification(false)}
        />

        {showScanModal && selectedWalletForScan && (
          <ScanTradesModal
            wallet={selectedWalletForScan}
            onClose={() => {
              setShowScanModal(false);
              setSelectedWalletForScan(null);
            }}
            onScanComplete={handleScanComplete}
          />
        )}

        {selectedTradeModal && selectedWalletId && (
          <TradeInfoModal
            isOpen={!!selectedTradeModal}
            onClose={handleCloseModal}
            tokenAddress={selectedTradeModal.tokenAddress}
            tokenSymbol={selectedTradeModal.tokenSymbol}
            tokenLogoURI={selectedTradeModal.tokenLogoURI}
            walletAddress={wallets.find(w => w.id === selectedWalletId)?.wallet_address || ''}
            mode="open-trades"
          />
        )}

        <NotificationToast
          message={starNotification.isUnstarring 
            ? `Removed ${starNotification.tokenSymbol} from trade log` 
            : `Added ${starNotification.tokenSymbol} trade to trade log`}
          isVisible={starNotification.show}
          type="success"
          autoDismissMs={3000}
          onDismiss={() => setStarNotification({ show: false, tokenSymbol: '', isUnstarring: false })}
        />

        {user?.id && selectedWallet?.wallet_address && (
          <WalletScanModal
            isOpen={showWalletScanModal}
            onClose={() => setShowWalletScanModal(false)}
            onSuccess={handleWalletScanSuccess}
            walletAddress={selectedWallet.wallet_address}
            userId={user.id}
          />
        )}
        
        <TrafficInfoModal />
      </DashboardLayout>
    </div>
  );
}
