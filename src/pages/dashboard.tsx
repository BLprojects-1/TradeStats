import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { getUserProfile, hasCompletedOnboarding } from '../utils/userProfile';
import OnboardingForm from '../components/OnboardingForm';

import DashboardLayout from '../components/layouts/DashboardLayout';
import { PerformanceChart } from '../components/PerformanceChart';
import { PerformanceStats } from '../components/PerformanceStats';

import { PerformanceService, PerformanceData } from '../services/performanceService';
import { tradingHistoryService } from '../services/tradingHistoryService';
import { ProcessedTrade } from '../services/tradeProcessor';
import { jupiterApiService } from '../services/jupiterApiService';
import { formatTokenAmount, formatSmallPrice } from '../utils/formatters';
import NotificationToast from '../components/NotificationToast';

interface OnboardingData {
  hasCompletedOnboarding: boolean;
  progress: number;
}

export interface TokenData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
  totalBought: number;
  totalSold: number;
  remaining: number;
  totalValue: number;
  currentPrice?: number;
  profitLoss?: number;
  lastTransactionTimestamp: number;
}

// Helper function to process trades into token holdings
const processTradesToHoldings = async (trades: ProcessedTrade[], userId?: string, walletAddress?: string): Promise<TokenData[]> => {
  // Group trades by token
  const tokenMap = new Map<string, {
    tokenSymbol: string,
    tokenLogoURI: string | null,
    buys: { amount: number, timestamp: number, valueUSD: number }[],
    sells: { amount: number, timestamp: number, valueUSD: number }[],
    buyValue: number,
    sellValue: number,
    latestTimestamp: number
  }>();
  
  // Process each trade
  for (const trade of trades) {
    if (!trade.tokenAddress || !trade.amount) continue;
    
    let tokenData = tokenMap.get(trade.tokenAddress);
    if (!tokenData) {
      tokenData = {
        tokenSymbol: trade.tokenSymbol,
        tokenLogoURI: trade.tokenLogoURI,
        buys: [],
        sells: [],
        buyValue: 0,
        sellValue: 0,
        latestTimestamp: 0
      };
      tokenMap.set(trade.tokenAddress, tokenData);
    }
    
    if (trade.timestamp > tokenData.latestTimestamp) {
      tokenData.latestTimestamp = trade.timestamp;
    }
    
    if (trade.type === 'BUY') {
      tokenData.buys.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD || 0
      });
      tokenData.buyValue += trade.valueUSD || 0;
    } else if (trade.type === 'SELL') {
      tokenData.sells.push({
        amount: trade.amount,
        timestamp: trade.timestamp,
        valueUSD: trade.valueUSD || 0
      });
      tokenData.sellValue += trade.valueUSD || 0;
    }
  }
  
  // Calculate remaining tokens and check for discrepancies
  const holdings: TokenData[] = [];
  const tokensToFetch: {tokenData: TokenData, tokenAddress: string, timestamp: number}[] = [];
  
  for (const [tokenAddress, data] of tokenMap.entries()) {
    const totalBought = data.buys.reduce((sum, buy) => sum + buy.amount, 0);
    const totalSold = data.sells.reduce((sum, sell) => sum + sell.amount, 0);
    const remaining = totalBought - totalSold;
    
    // Only include tokens with a positive remaining balance
    if (remaining <= 0) continue;
    
    const tokenData: TokenData = {
      tokenAddress,
      tokenSymbol: data.tokenSymbol,
      tokenLogoURI: data.tokenLogoURI || undefined,
      totalBought,
      totalSold,
      remaining,
      totalValue: 0, // Will be updated with current price
      lastTransactionTimestamp: data.latestTimestamp
    };
    
    holdings.push(tokenData);
    tokensToFetch.push({
      tokenData,
      tokenAddress,
      timestamp: data.latestTimestamp
    });
  }
  
  // Fetch current prices in small batches
  const BATCH_SIZE = 5;
  for (let i = 0; i < tokensToFetch.length; i += BATCH_SIZE) {
    const batch = tokensToFetch.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(({tokenData, tokenAddress}) => {
      return jupiterApiService.getTokenPriceInUSD(tokenAddress)
        .then(price => {
          tokenData.currentPrice = price;
          tokenData.totalValue = tokenData.remaining * price;
          const buyValue = tokenMap.get(tokenAddress)?.buyValue || 0;
          const sellValue = tokenMap.get(tokenAddress)?.sellValue || 0;
          tokenData.profitLoss = tokenData.totalValue - (buyValue - sellValue);
        })
        .catch(err => {
          console.error(`Error fetching current price for ${tokenAddress}:`, err);
          tokenData.currentPrice = 0;
          tokenData.totalValue = 0;
        });
    });
    
    await Promise.all(batchPromises);
    
    if (i + BATCH_SIZE < tokensToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return holdings.sort((a, b) => b.totalValue - a.totalValue);
};

export default function Dashboard() {
  const { user, loading, refreshSession } = useAuth();
  const { selectedWalletId, wallets, isWalletScanning, markWalletAsScanning, markWalletScanComplete, getWalletCache, setWalletCache, isCacheValid, reloadWallets } = useWalletSelection();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLoadingNotification, setShowLoadingNotification] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [scannedWallets, setScannedWallets] = useState<Set<string>>(new Set());
  const walletsRef = useRef(wallets);

  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [openTrades, setOpenTrades] = useState<TokenData[]>([]);
  const [openTradesLoading, setOpenTradesLoading] = useState(false);
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
        setShowOnboarding(!completed);
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

  // Load data when a wallet is selected
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!selectedWalletId || !user?.id || showOnboarding) {
        setOpenTrades([]);
        setPerformanceData(null);
        return;
      }
      
      const selectedWallet = walletsRef.current.find(w => w.id === selectedWalletId);
      if (!selectedWallet) {
        setOpenTrades([]);
        setPerformanceData(null);
        return;
      }

      // Check if we have cached data first
      const cachedData = getWalletCache(selectedWalletId);
      if (cachedData && isCacheValid(selectedWalletId)) {
        console.log('Using cached data for dashboard');
        const processedTrades = await processTradesToHoldings(cachedData, user.id, selectedWallet.wallet_address);
        setOpenTrades(processedTrades);
        return;
      }
      
      setOpenTradesLoading(true);
      setPerformanceLoading(true);
      setLoadingMessage("Loading your trading data...");
      setShowLoadingNotification(true);
      setError(null);
      
      // Check if initial scan is complete
      const isInitialScanComplete = selectedWallet.initial_scan_complete === true;
      console.log(`Wallet ${selectedWallet.wallet_address} initial_scan_complete:`, isInitialScanComplete);
      
      const walletIsCurrentlyScanning = isWalletScanning(selectedWalletId);
      const hasBeenScanned = scannedWallets.has(selectedWalletId);
      let weInitiatedScan = false;
      
      if (!isInitialScanComplete && !walletIsCurrentlyScanning && !hasBeenScanned) {
        markWalletAsScanning(selectedWalletId);
        setScannedWallets(prev => new Set(prev).add(selectedWalletId));
        weInitiatedScan = true;
        setLoadingMessage("Initial wallet scan in progress. This may take up to 2 minutes for the first scan.");
      } else if (isInitialScanComplete) {
        setLoadingMessage("Loading trade data from database...");
      } else {
        setLoadingMessage("Wallet scan in progress...");
      }
      
      try {
        console.log(`Loading data for wallet: ${selectedWallet.wallet_address}`);
        
        // Calculate timestamp for 24 hours ago
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);
        
        // Load both trading history and performance data
        const [tradeResult, performanceResult] = await Promise.all([
          tradingHistoryService.getTradingHistory(
            user.id,
            selectedWallet.wallet_address,
            500,
            1,
            oneDayAgo.getTime()
          ),
          PerformanceService.getPerformanceData(user.id, selectedWalletId)
        ]);
        
        if (tradeResult && tradeResult.trades.length > 0) {
          const openPositions = await processTradesToHoldings(tradeResult.trades, user.id, selectedWallet.wallet_address);
          setOpenTrades(openPositions);
          setWalletCache(selectedWalletId, tradeResult.trades);
        } else {
          setOpenTrades([]);
        }
        
        setPerformanceData(performanceResult);
        
        // Update loading state
        setLoadingMessage('Data loaded successfully!');
        setTimeout(() => {
          setShowLoadingNotification(false);
          setLoadingMessage(null);
        }, 3000);
        
        // Handle scan completion
        if (!isInitialScanComplete && weInitiatedScan) {
          markWalletScanComplete(selectedWalletId);
          setScannedWallets(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedWalletId);
            return newSet;
          });
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Failed to load trading data. Please try again.');
        setOpenTrades([]);
        setPerformanceData(null);
        
        if (!isInitialScanComplete && weInitiatedScan) {
          markWalletScanComplete(selectedWalletId);
          setScannedWallets(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedWalletId);
            return newSet;
          });
        }
      } finally {
        setOpenTradesLoading(false);
        setPerformanceLoading(false);
      }
    };

    loadDashboardData();
  }, [selectedWalletId, user?.id, showOnboarding]);

  const handleOnboardingComplete = async () => {
    if (user) {
      try {
        await refreshSession();
        setShowOnboarding(false);
        
        // Force a reload of wallets and wait for it to complete
        await reloadWallets();
        
        // The wallet selection will happen automatically in the WalletSelectionContext
        // since we've updated it to auto-select the first wallet when wallets are loaded
      } catch (err) {
        console.error('Error completing onboarding:', err);
        setError('Failed to complete onboarding. Please try again.');
      }
    }
  };

  const handleRefreshPerformance = async () => {
    if (!user?.id || showOnboarding) return;
    
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
      const result = await tradingHistoryService.refreshTradingHistory(
        user.id,
        selectedWallet.wallet_address
      );
      
      if (result.newTradesCount === 0) {
        setRefreshMessage("You're up to date!");
      } else {
        setRefreshMessage(result.message);
        
        // If new trades were found, reload the open trades data
        const dataResult = await tradingHistoryService.getTradingHistory(
          user.id,
          selectedWallet.wallet_address,
          500,
          1
        );
        
        const openPositions = await processTradesToHoldings(dataResult.trades, user?.id, selectedWallet.wallet_address);
        setOpenTrades(openPositions);
      }
      
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

  // Show onboarding for first-time users
  if (showOnboarding) {
    return <OnboardingForm userId={user.id} onComplete={handleOnboardingComplete} />;
  }

  return (
    <DashboardLayout title="Dashboard">
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

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6">
            {error}
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
              <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200">Open Positions (24h)</h2>
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
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P/L</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {openTradesLoading ? (
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
                          {formatTokenAmount(token.totalBought - token.totalSold)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {formatTokenAmount(token.remaining)}
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
              {openTradesLoading ? (
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
                          <p className="text-gray-400">P/L</p>
                          <p className="text-gray-300">
                            {formatTokenAmount(token.totalBought - token.totalSold)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Remaining</p>
                          <p className="text-gray-300">{formatTokenAmount(token.remaining)}</p>
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
                <h3 className="text-lg font-semibold text-indigo-200 mb-4">24h Position Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
                  <div className="bg-[#252525] p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Open Positions</h4>
                    <p className="text-xl sm:text-2xl font-semibold text-white">{openTrades.length}</p>
                  </div>
                  
                  <div className="bg-[#252525] p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Total Value</h4>
                    <p className="text-xl sm:text-2xl font-semibold text-white">
                      {formatSmallPrice(openTrades.reduce((sum, token) => sum + (token.totalValue || 0), 0))}
                    </p>
                  </div>
                  
                  <div className="bg-[#252525] p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Unrealized P/L</h4>
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
    </DashboardLayout>
  );
} 