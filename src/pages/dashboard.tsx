import { useEffect, useState } from 'react';
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
const processTradesToHoldings = async (trades: ProcessedTrade[]): Promise<TokenData[]> => {
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
  
  // Calculate remaining tokens and fetch current prices
  const holdings: TokenData[] = [];
  const tokensToFetch: {tokenData: TokenData, tokenAddress: string, timestamp: number}[] = [];
  
  for (const [tokenAddress, data] of tokenMap.entries()) {
    const remaining = data.buys.reduce((sum, buy) => sum + buy.amount, 0) - 
                     data.sells.reduce((sum, sell) => sum + sell.amount, 0);
    
    if (remaining <= 0) continue;
    
    const tokenData: TokenData = {
      tokenAddress,
      tokenSymbol: data.tokenSymbol,
      tokenLogoURI: data.tokenLogoURI || undefined,
      totalBought: data.buys.reduce((sum, buy) => sum + buy.amount, 0),
      totalSold: data.sells.reduce((sum, sell) => sum + sell.amount, 0),
      remaining,
      totalValue: 0,
      lastTransactionTimestamp: data.latestTimestamp
    };
    
    holdings.push(tokenData);
    tokensToFetch.push({
      tokenData, 
      tokenAddress, 
      timestamp: data.latestTimestamp
    });
  }
  
  // Fetch prices in small batches
  const BATCH_SIZE = 5;
  for (let i = 0; i < tokensToFetch.length; i += BATCH_SIZE) {
    const batch = tokensToFetch.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(({tokenData, tokenAddress, timestamp}) => {
      return jupiterApiService.getTokenPriceInUSD(tokenAddress, timestamp)
        .then(price => {
          tokenData.currentPrice = price;
          tokenData.totalValue = tokenData.remaining * price;
          const buyValue = tokenMap.get(tokenAddress)?.buyValue || 0;
          const sellValue = tokenMap.get(tokenAddress)?.sellValue || 0;
          tokenData.profitLoss = tokenData.totalValue - (buyValue - sellValue);
        })
        .catch(err => {
          console.error(`Error fetching price for ${tokenAddress}:`, err);
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
  const { selectedWalletId, wallets, isWalletScanning, markWalletAsScanning, markWalletScanComplete } = useWalletSelection();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [openTrades, setOpenTrades] = useState<TokenData[]>([]);
  const [openTradesLoading, setOpenTradesLoading] = useState(false);

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

  // Load performance data when user is available and has wallets
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!user?.id || showOnboarding) return;
      
      try {
        setPerformanceLoading(true);
        setError(null);
        
        if (wallets.length === 0) {
          // Show sample data when no wallets are connected
          const sampleData = PerformanceService.generateSampleData();
          setPerformanceData(sampleData);
        } else {
          // Load real performance data
          const data = await PerformanceService.getPerformanceData(user.id);
          setPerformanceData(data);
        }
      } catch (err) {
        console.error('Error loading performance data:', err);
        setError('Failed to load performance data. Please refresh the page.');
        
        // Fallback to sample data on error
        const sampleData = PerformanceService.generateSampleData();
        setPerformanceData(sampleData);
      } finally {
        setPerformanceLoading(false);
      }
    };

    loadPerformanceData();
  }, [user, wallets, showOnboarding]);

  // Load open trades data - matches exactly with open-trades.tsx logic
  useEffect(() => {
    const loadOpenTradesData = async () => {
      if (!selectedWalletId || !user?.id || showOnboarding) {
        setOpenTrades([]);
        return;
      }
      
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) {
        setOpenTrades([]);
        return;
      }
      
      try {
        setOpenTradesLoading(true);
        
        // Use the tradingHistoryService to get all trading history
        const result = await tradingHistoryService.getTradingHistory(
          user.id,
          selectedWallet.wallet_address,
          500, // Get a larger number of trades for better analysis
          1
        );
        
        // Process the trades to find open positions
        const openPositions = await processTradesToHoldings(result.trades);
        setOpenTrades(openPositions);
      } catch (err) {
        console.error('Error loading open trades data:', err);
        // Don't show error for open trades, just log it and clear data
        setOpenTrades([]);
      } finally {
        setOpenTradesLoading(false);
      }
    };

    loadOpenTradesData();
  }, [selectedWalletId, user?.id, showOnboarding, wallets]);

  const handleOnboardingComplete = async () => {
    if (user) {
      try {
        await refreshSession();
        setShowOnboarding(false);
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
      
      if (wallets.length === 0) {
        const sampleData = PerformanceService.generateSampleData();
        setPerformanceData(sampleData);
      } else {
        const data = await PerformanceService.getPerformanceData(user.id);
        setPerformanceData(data);
      }
    } catch (err) {
      console.error('Error refreshing performance data:', err);
      setError('Failed to refresh performance data. Please try again.');
    } finally {
      setPerformanceLoading(false);
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
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Open Positions (24h)</h2>
            
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
                          {token.totalBought.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {token.totalSold.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {(token.totalBought - token.totalSold > 0 ? '+' : '') + 
                            (token.totalBought - token.totalSold).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {token.remaining.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                        {wallets.length === 0 ? 'Connect wallets to see open positions' : 'No open trades found for this wallet'}
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
                          <p className="text-gray-300">{token.totalBought.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Sold</p>
                          <p className="text-gray-300">{token.totalSold.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">P/L</p>
                          <p className="text-gray-300">
                            {(token.totalBought - token.totalSold > 0 ? '+' : '') + 
                              (token.totalBought - token.totalSold).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Remaining</p>
                          <p className="text-gray-300">{token.remaining.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-300 text-center py-4">
                  {wallets.length === 0 ? 'Connect wallets to see open positions' : 'No open trades found for this wallet'}
                </div>
                             )}
             </div>

             {/* Summary section */}
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
                     ${openTrades.reduce((sum, token) => sum + (token.totalValue || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                   </p>
                 </div>
                 
                 <div className="bg-[#252525] p-4 rounded-lg">
                   <h4 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Unrealized P/L</h4>
                   <p className="text-xl sm:text-2xl font-semibold text-white">
                     ${openTrades.reduce((sum, token) => sum + (token.profitLoss || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                   </p>
                 </div>
               </div>
             </div>
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200">Performance Overview</h2>
              <button
                onClick={handleRefreshPerformance}
                disabled={performanceLoading}
                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {performanceLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {performanceLoading ? (
              <div className="text-center py-8">
                <div className="text-indigo-400">Loading performance data...</div>
              </div>
            ) : performanceData ? (
              <div className="space-y-6">
                {/* Performance Chart */}
                <PerformanceChart dataPoints={performanceData.dataPoints} />
                
                {/* Performance Statistics */}
                <PerformanceStats metrics={performanceData.metrics} />
                
                {wallets.length === 0 && (
                  <div className="text-center mt-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                    <p className="text-amber-200 text-sm">
                      📊 This is sample data. Connect your wallets to see real performance metrics.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">Unable to load performance data.</p>
              </div>
            )}
          </div>
          

        </div>
      </div>


    </DashboardLayout>
  );
} 