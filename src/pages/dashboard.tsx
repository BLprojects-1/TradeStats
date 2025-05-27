import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { getUserProfile, hasCompletedOnboarding, TrackedWallet } from '../utils/userProfile';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { PerformanceChart } from '../components/PerformanceChart';
import { PerformanceStats } from '../components/PerformanceStats';

import { PerformanceService, PerformanceData } from '../services/performanceService';
import { formatTokenAmount, formatSmallPrice } from '../utils/formatters';
import NotificationToast from '../components/NotificationToast';
import { useProcessedTradingData } from '../hooks/useProcessedTradingData';
import { TokenHolding } from '../utils/historicalTradeProcessing';
import ScanTradesModal from '../components/ScanTradesModal';

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
  const [refreshingPerformance, setRefreshingPerformance] = useState(false);
  const [refreshingTrades, setRefreshingTrades] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number>(0);
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedWalletForScan, setSelectedWalletForScan] = useState<TrackedWallet | null>(null);

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

  const handleRefreshPerformance = async () => {
    if (!user?.id) return;

    try {
      setPerformanceLoading(true);
      setError(null);

      if (!selectedWalletId) {
        setPerformanceData(null);
        return;
      }

      const data = await PerformanceService.getPerformanceData(user.id, selectedWalletId);
      setPerformanceData(data);
      setRefreshMessage("You're up to date!");
      setShowNotification(true);

      // Clear message after 5 seconds
      setTimeout(() => {
        setRefreshMessage(null);
        setShowNotification(false);
      }, 5000);
    } catch (err) {
      console.error('Error refreshing performance data:', err);
      setError('Failed to refresh performance data. Please try again.');
    } finally {
      setPerformanceLoading(false);
    }
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-indigo-400 text-xl">Loading...</div>
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
    <DashboardLayout title="Dashboard">
      <div className="space-y-4 sm:space-y-6">
        {/* Header and Checklist */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Dashboard Overview</h1>
          </div>
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-indigo-200 mb-2">Getting Started Checklist</h2>
              <ul className="space-y-2">
                <li className="flex items-center gap-3">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 ${hasWallet ? 'border-green-500 bg-green-500' : 'border-gray-500 bg-gray-800'}`}>{hasWallet ? <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : ''}</span>
                  <span className="text-white">Add your wallet</span>
                  {!hasWallet && (
                    <button
                      className="ml-4 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                      onClick={() => router.push('/dashboard/account')}
                    >
                      Go to Account
                    </button>
                  )}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-semibold mb-2 text-white">Dashboard Overview</h1>
            <p className="text-gray-500">Welcome to your Solana trading dashboard</p>
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

          {(error || tradesError) && (
            <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6">
              {error || tradesError}
              <button 
                onClick={() => window.location.reload()}
                className="ml-2 underline"
              >
                Refresh
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200">Open Positions</h2>
                {selectedWalletId && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete && (
                  <button
                    onClick={handleRefreshTrades}
                    disabled={refreshing || cooldownTimeLeft > 0}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                  >
                    {refreshing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Refreshing...</span>
                      </>
                    ) : cooldownTimeLeft > 0 ? (
                      <>
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{Math.floor(cooldownTimeLeft / 60)}:{(cooldownTimeLeft % 60).toString().padStart(2, '0')}</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Desktop table - hidden on mobile */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-800">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Bought</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sold</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Net Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Unrealized P/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {isLoadingTrades ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                          <div className="flex items-center justify-center space-x-2">
                            <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Loading open trades...</span>
                          </div>
                        </td>
                      </tr>
                    ) : openTrades.length > 0 ? (
                      openTrades.map((token) => (
                        <tr key={token.tokenAddress}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            <div className="flex items-center space-x-2">
                              {token.tokenLogoURI && (
                                <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-5 h-5 rounded-full" />
                              )}
                              <span>{token.tokenSymbol}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {formatTokenAmount(token.totalBought)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {formatTokenAmount(token.totalSold)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {formatTokenAmount(token.netPosition)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${(token.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatSmallPrice(token.profitLoss || 0)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                          {wallets.length === 0 ? 'No wallets connected' : !selectedWalletId ? 'Select a wallet to see your open positions' : 'No trades found for this wallet'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile card view - visible only on small screens */}
              <div className="sm:hidden">
                {isLoadingTrades ? (
                  <div className="flex items-center justify-center py-4 text-gray-400">
                    <div className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading open trades...</span>
                    </div>
                  </div>
                ) : openTrades.length > 0 ? (
                  <div className="space-y-4">
                    {openTrades.map((token) => (
                      <div key={token.tokenAddress} className="bg-[#252525] p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-3">
                          {token.tokenLogoURI && (
                            <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-6 h-6 rounded-full" />
                          )}
                          <span className="text-white font-medium">{token.tokenSymbol}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-400">Bought</p>
                            <p className="text-gray-300">{formatTokenAmount(token.totalBought)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Sold</p>
                            <p className="text-gray-300">{formatTokenAmount(token.totalSold)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Net Position</p>
                            <p className="text-gray-300">{formatTokenAmount(token.netPosition)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Unrealized P/L</p>
                            <p className={`${(token.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatSmallPrice(token.profitLoss || 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-300 text-center py-4">
                    {wallets.length === 0 ? 'No wallets connected' : !selectedWalletId ? 'Select a wallet to see your open positions' : 'No trades found for this wallet'}
                  </div>
                )}
              </div>

              {/* Summary section - only show if there are trades */}
              {openTrades.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <h3 className="text-lg font-semibold text-indigo-200 mb-4">Position Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
                    <div className="bg-[#252525] p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Open Positions</h4>
                      <p className="text-xl sm:text-2xl font-semibold text-white">{openTrades.length}</p>
                    </div>

                    <div className="bg-[#252525] p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Total Value</h4>
                      <p className="text-xl sm:text-2xl font-semibold text-white">
                        {formatSmallPrice(openTrades.reduce((sum, token) => sum + (token.totalValue || 0), 0))}
                      </p>
                    </div>

                    <div className="bg-[#252525] p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Unrealized P/L</h4>
                      <p className="text-xl sm:text-2xl font-semibold text-white">
                        {formatSmallPrice(openTrades.reduce((sum, token) => sum + (token.profitLoss || 0), 0))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200">Performance Overview (24h)</h2>
                <button
                  onClick={handleRefreshPerformance}
                  disabled={performanceLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                >
                  {performanceLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Refreshing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Refresh</span>
                    </>
                  )}
                </button>
              </div>
              {performanceLoading ? (
                <div className="text-center py-8">
                  <div className="text-indigo-400">Loading performance data...</div>
                </div>
              ) : wallets.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">No wallets connected</div>
                </div>
              ) : !selectedWalletId ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Select a wallet to see your performance metrics</div>
                </div>
              ) : performanceData ? (
                <div className="space-y-6">
                  {/* Performance Chart */}
                  <PerformanceChart dataPoints={performanceData.dataPoints} />

                  {/* Performance Statistics */}
                  <PerformanceStats metrics={performanceData.metrics} />
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">Unable to load performance data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading notification */}
      <NotificationToast
        message={loadingMessage || ''}
        isVisible={showLoadingNotification}
        type={loadingMessage?.includes('Failed') ? 'error' : 'info'}
        autoDismissMs={3000}
        onDismiss={() => setShowLoadingNotification(false)}
      />

      {/* Existing refresh notification */}
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
    </DashboardLayout>
  );
} 
