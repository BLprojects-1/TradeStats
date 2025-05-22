import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import { ProcessedTrade } from '../../services/tradeProcessor';
import { jupiterApiService } from '../../services/jupiterApiService';

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
  starred?: boolean;
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
    latestTimestamp: number // Track the most recent transaction timestamp
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
        latestTimestamp: 0
      };
      tokenMap.set(trade.tokenAddress, tokenData);
    }
    
    // Update latest timestamp if this trade is more recent
    if (trade.timestamp > tokenData.latestTimestamp) {
      tokenData.latestTimestamp = trade.timestamp;
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
  
  // Calculate remaining tokens and fetch current prices
  const holdings: TokenData[] = [];
  
  // Create all token data objects first before fetching prices
  const tokensToFetch: {tokenData: TokenData, tokenAddress: string, timestamp: number}[] = [];
  
  for (const [tokenAddress, data] of tokenMap.entries()) {
    const remaining = data.buys.reduce((sum, buy) => sum + buy.amount, 0) - 
                     data.sells.reduce((sum, sell) => sum + sell.amount, 0);
    
    // Only include tokens with a positive remaining balance
    if (remaining <= 0) continue;
    
    const tokenData: TokenData = {
      tokenAddress,
      tokenSymbol: data.tokenSymbol,
      tokenLogoURI: data.tokenLogoURI || undefined,
      totalBought: data.buys.reduce((sum, buy) => sum + buy.amount, 0),
      totalSold: data.sells.reduce((sum, sell) => sum + sell.amount, 0),
      remaining,
      totalValue: 0, // Will be calculated after getting price
      lastTransactionTimestamp: data.latestTimestamp
    };
    
    holdings.push(tokenData);
    tokensToFetch.push({
      tokenData, 
      tokenAddress, 
      timestamp: data.latestTimestamp
    });
  }
  
  // Now fetch prices in small batches to avoid rate limiting
  const BATCH_SIZE = 5;
  for (let i = 0; i < tokensToFetch.length; i += BATCH_SIZE) {
    const batch = tokensToFetch.slice(i, i + BATCH_SIZE);
    
    // Process each batch with a small delay between batches if needed
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
    
    // Wait for the current batch to complete
    await Promise.all(batchPromises);
    
    // Add a small delay between batches if we have more to process
    if (i + BATCH_SIZE < tokensToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Sort by total value (highest first)
  return holdings.sort((a, b) => b.totalValue - a.totalValue);
};

export default function OpenTrades() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets, setSelectedWalletId, isWalletScanning, markWalletAsScanning, markWalletScanComplete } = useWalletSelection();
  const router = useRouter();
  const [walletData, setWalletData] = useState<TokenData[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [scannedWallets, setScannedWallets] = useState<Set<string>>(new Set());
  const walletsRef = useRef(wallets);
  const [starringTrade, setStarringTrade] = useState<string | null>(null);

  // Keep wallets ref updated
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load data when a wallet is selected
  useEffect(() => {
    const getWalletData = async () => {
      if (!selectedWalletId) return;
      
      const selectedWallet = walletsRef.current.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;
      
      setDataLoading(true);
      setLoadingMessage("Loading your open trades...");
      setError(null);
      setApiError(null);
      
      // Check if initial scan is complete
      const isInitialScanComplete = selectedWallet.initial_scan_complete === true;
      
      // If wallet is already complete, skip scanning logic
      if (isInitialScanComplete) {
        setLoadingMessage("Loading your open trades...");
        
        try {
          // Use the tradingHistoryService to get all trading history
          const result = await tradingHistoryService.getTradingHistory(
            user!.id,
            selectedWallet.wallet_address,
            500, // Get a larger number of trades for better analysis
            1
          );
          
          // Process the trades to find open positions
          const openPositions = await processTradesToHoldings(result.trades);
          setWalletData(openPositions);
        } catch (err: any) {
          console.error('Error loading wallet data:', err);
          if (err.message?.includes('Minimum context slot')) {
            console.log('RPC provider reported: Minimum context slot has not been reached');
            setApiError('The Solana RPC service reported a sync delay. We\'re using cached data for now.');
            setErrorType('rpc');
          } else {
            setError('Failed to load wallet data. Please try again.');
          }
        } finally {
          setDataLoading(false);
          setLoadingMessage('');
        }
        return;
      }
      
      const walletIsCurrentlyScanning = isWalletScanning(selectedWalletId);
      const hasBeenScanned = scannedWallets.has(selectedWalletId);
      
      // Track if we initiated the scan in this call
      let weInitiatedScan = false;
      
      // Only show initial scan message and mark as scanning if we're actually doing an initial scan
      if (!isInitialScanComplete && !walletIsCurrentlyScanning && !hasBeenScanned) {
        markWalletAsScanning(selectedWalletId);
        setScannedWallets(prev => new Set(prev).add(selectedWalletId));
        weInitiatedScan = true;
        setLoadingMessage("Initial wallet scan in progress. This may take up to 2 minutes for the first scan.");
      } else {
        // Wallet is currently scanning, just show the scanning message
        setLoadingMessage("Wallet scan in progress...");
      }
      
      try {
        // Use the tradingHistoryService to get all trading history
        const result = await tradingHistoryService.getTradingHistory(
          user!.id,
          selectedWallet.wallet_address,
          500, // Get a larger number of trades for better analysis
          1
        );
        
        // Process the trades to find open positions
        const openPositions = await processTradesToHoldings(result.trades);
        setWalletData(openPositions);
        
        // Only mark as complete if we were the ones who initiated the scan
        if (!isInitialScanComplete && weInitiatedScan) {
          markWalletScanComplete(selectedWalletId);
          setScannedWallets(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedWalletId);
            return newSet;
          });
        }
      } catch (err: any) {
        console.error('Error loading wallet data:', err);
        
        // If error during initial scan that we initiated, mark it as complete to prevent endless retries
        if (!isInitialScanComplete && weInitiatedScan) {
          markWalletScanComplete(selectedWalletId);
          setScannedWallets(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedWalletId);
            return newSet;
          });
        }
        
        // Enhanced error handling with more specific messages
        if (err.message?.includes('Minimum context slot')) {
          // This is a known DRPC API limitation
          console.log('RPC provider reported: Minimum context slot has not been reached');
          setApiError('The Solana RPC service reported a sync delay. We\'re using cached data for now.');
          setErrorType('rpc');
        } else if (err.message?.includes('TRANSACTION_FETCH_ERROR') || err.message?.includes('getTransaction')) {
          setApiError('Unable to connect to Solana network to fetch your transaction data. We are using public RPC endpoints which have lower reliability. Please try again in a few moments.');
          setErrorType('rpc');
        } else if (err.message?.includes('Service Unavailable') || err.message?.includes('503')) {
          setApiError('The Solana RPC service is currently unavailable. We are using public endpoints with limited capacity. Please try again later.');
          setErrorType('rpc');
        } else if (err.message?.includes('NOT_FOUND')) {
          // This is a legitimate response for transactions that don't exist or were pruned
          console.log('Some transactions were not found in the ledger. This is normal for older transactions.');
          // Don't show an error banner for this case
        } else if (err.message?.includes('API key') || err.message?.includes('403') || err.message?.includes('401')) {
          setApiError('Authentication issue with Solana RPC providers. We are using public endpoints which may occasionally limit access. Please try again later.');
          setErrorType('auth');
        } else if (err.message?.includes('timeout') || err.message?.includes('ECONNABORTED')) {
          setApiError('Request timeout. The Solana network may be experiencing high traffic or the public RPC endpoints we use may be rate-limiting our requests.');
          setErrorType('timeout');
        } else if (err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
          // Handle rate limiting specifically for Jupiter API
          console.log('Rate limit hit on Jupiter API, using rate-limited service which will retry automatically');
          // Our rate-limited service will handle this internally with exponential backoff
        } else {
          setError('Failed to load wallet data. Please try again.');
        }
      } finally {
        setDataLoading(false);
        setLoadingMessage('');
      }
    };
    
    getWalletData();
  }, [selectedWalletId, user?.id]);

  const handleRetry = () => {
    if (selectedWalletId) {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (selectedWallet) {
        setApiError(null);
        const getWalletData = async () => {
          try {
            setDataLoading(true);
            setLoadingMessage("Retrying...");
            
            // Use the tradingHistoryService to get all trading history
            const result = await tradingHistoryService.getTradingHistory(
              user!.id,
              selectedWallet.wallet_address,
              500,
              1
            );
            
            // Process the trades to find open positions
            const openPositions = await processTradesToHoldings(result.trades);
            setWalletData(openPositions);
            
          } catch (err) {
            console.error('Error retrying wallet data fetch:', err);
          } finally {
            setDataLoading(false);
            setLoadingMessage('');
          }
        };
        getWalletData();
      }
    }
  };

  const handleRefresh = async () => {
    if (!selectedWalletId || !user?.id || refreshing) return;
    
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet || !selectedWallet.initial_scan_complete) return;
    
    setRefreshing(true);
    setRefreshMessage(null);
    
    try {
      const result = await tradingHistoryService.refreshTradingHistory(
        user.id,
        selectedWallet.wallet_address
      );
      
      setRefreshMessage(result.message);
      
      // If new trades were found, reload the data
      if (result.newTradesCount > 0) {
        // Reload the data to show new trades
        const dataResult = await tradingHistoryService.getTradingHistory(
          user.id,
          selectedWallet.wallet_address,
          500,
          1
        );
        
        const openPositions = await processTradesToHoldings(dataResult.trades);
        setWalletData(openPositions);
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

  const handleStarTrade = async (tokenAddress: string) => {
    if (!user?.id || !selectedWalletId) return;
    
    setStarringTrade(tokenAddress);
    try {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;

      // Find the first transaction signature for this token (we'll use this as a placeholder)
      // In a real implementation, you might want to star all trades for this token
      // For now, we'll use the token address as a pseudo-signature
      const pseudoSignature = `open_trade_${tokenAddress}`;
      
      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, selectedWallet.wallet_address);
      
      // Check if already starred (we'll store this as a note)
      const currentlyStarred = walletData.find(token => token.tokenAddress === tokenAddress)?.starred || false;
      
      await tradingHistoryService.toggleStarredTrade(walletId, pseudoSignature, !currentlyStarred);
      
      // Update local state
      setWalletData(prev => prev.map(token => 
        token.tokenAddress === tokenAddress 
          ? { ...token, starred: !currentlyStarred }
          : token
      ));
    } catch (err) {
      console.error('Error starring trade:', err);
      setError('Failed to star trade. Please try again.');
    } finally {
      setStarringTrade(null);
    }
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
    <DashboardLayout 
      title="Open Trades"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">24h Open Trades</h1>
            {selectedWalletId && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
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
          <p className="text-gray-500">View your active positions from trades in the last 24 hours</p>
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
          onRetry={handleRetry} 
          errorType={errorType as 'rpc' | 'auth' | 'timeout' | 'general'} 
        />}

        {!selectedWalletId && (
          <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-4 sm:mb-6">
            Please select a wallet from the dropdown menu to view your open trades.
          </div>
        )}
        
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Active Positions (24h)</h2>
          
          {/* Desktop table - hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Star</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Bought</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P/L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {dataLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{loadingMessage || 'Loading open trades...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : walletData.length > 0 ? (
                  walletData.map((token) => (
                    <tr key={token.tokenAddress}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <button
                          onClick={() => handleStarTrade(token.tokenAddress)}
                          disabled={starringTrade === token.tokenAddress}
                          className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                          aria-label={token.starred ? 'Unstar token' : 'Star token'}
                        >
                          {starringTrade === token.tokenAddress ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                      {selectedWalletId ? 'No open trades found for this wallet' : 'Select a wallet to view open trades'}
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
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{loadingMessage || 'Loading open trades...'}</span>
                </div>
              </div>
            ) : walletData.length > 0 ? (
              <div className="space-y-4">
                {walletData.map((token) => (
                  <div key={token.tokenAddress} className="bg-[#252525] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {token.tokenLogoURI && (
                          <img src={token.tokenLogoURI} alt={token.tokenSymbol} className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-white font-medium">{token.tokenSymbol}</span>
                      </div>
                      <button
                        onClick={() => handleStarTrade(token.tokenAddress)}
                        disabled={starringTrade === token.tokenAddress}
                        className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                        aria-label={token.starred ? 'Unstar token' : 'Star token'}
                      >
                        {starringTrade === token.tokenAddress ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                {selectedWalletId ? 'No open trades found for this wallet' : 'Select a wallet to view open trades'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">24h Position Summary</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Open Positions</h3>
              <p className="text-xl sm:text-2xl font-semibold text-white">{walletData.length}</p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Total Value</h3>
              <p className="text-xl sm:text-2xl font-semibold text-white">
                ${walletData.reduce((sum, token) => sum + (token.totalValue || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">24h Unrealized P/L</h3>
              <p className="text-xl sm:text-2xl font-semibold text-white">
                ${walletData.reduce((sum, token) => sum + (token.profitLoss || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <LoadingToast 
          isVisible={!!(dataLoading || (selectedWalletId && isWalletScanning(selectedWalletId) && walletData.length === 0))} 
          message={selectedWalletId && isWalletScanning(selectedWalletId) && wallets.find(w => w.id === selectedWalletId)?.initial_scan_complete !== true ? 
            "Initial wallet scan in progress. This may take a moment. We're scanning your transaction history." : 
            loadingMessage || ''
          } 
        />
      </div>
    </DashboardLayout>
  );
}
