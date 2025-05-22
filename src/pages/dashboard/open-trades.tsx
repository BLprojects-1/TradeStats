import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { getTrackedWallets, TrackedWallet } from '../../utils/userProfile';
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
}

// Helper function to process trades into token holdings
const processTradesToHoldings = async (trades: ProcessedTrade[]): Promise<TokenData[]> => {
  // Group trades by token
  const tokenMap = new Map<string, {
    tokenSymbol: string,
    tokenLogoURI: string | null,
    buys: number,
    sells: number,
    buyValue: number,
    sellValue: number
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
        buys: 0,
        sells: 0,
        buyValue: 0,
        sellValue: 0
      };
      tokenMap.set(trade.tokenAddress, tokenData);
    }
    
    // Add to buys or sells
    if (trade.type === 'BUY') {
      tokenData.buys += trade.amount;
      tokenData.buyValue += trade.valueUSD;
    } else if (trade.type === 'SELL') {
      tokenData.sells += trade.amount;
      tokenData.sellValue += trade.valueUSD;
    }
  }
  
  // Calculate remaining tokens and fetch current prices
  const holdings: TokenData[] = [];
  const pricePromises: Promise<void>[] = [];
  
  for (const [tokenAddress, data] of tokenMap.entries()) {
    const remaining = data.buys - data.sells;
    
    // Only include tokens with a positive remaining balance
    if (remaining <= 0) continue;
    
    const tokenData: TokenData = {
      tokenAddress,
      tokenSymbol: data.tokenSymbol,
      tokenLogoURI: data.tokenLogoURI || undefined,
      totalBought: data.buys,
      totalSold: data.sells,
      remaining,
      totalValue: 0, // Will be calculated after getting price
    };
    
    // Fetch current price
    const pricePromise = jupiterApiService.getTokenPriceInUSD(tokenAddress)
      .then(price => {
        tokenData.currentPrice = price;
        tokenData.totalValue = remaining * price;
        tokenData.profitLoss = tokenData.totalValue - (data.buyValue - data.sellValue);
      })
      .catch(err => {
        console.error(`Error fetching price for ${tokenAddress}:`, err);
        tokenData.currentPrice = 0;
        tokenData.totalValue = 0;
      });
    
    pricePromises.push(pricePromise);
    holdings.push(tokenData);
  }
  
  // Wait for all price fetches to complete
  await Promise.all(pricePromises);
  
  // Sort by total value (highest first)
  return holdings.sort((a, b) => b.totalValue - a.totalValue);
};

export default function OpenTrades() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [walletData, setWalletData] = useState<TokenData[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load wallets when component mounts
  useEffect(() => {
    const fetchWallets = async () => {
      if (!user?.id) return;
      try {
        const userWallets = await getTrackedWallets(user.id);
        setWallets(userWallets);
        
        // If there's only one wallet, automatically select it
        if (userWallets.length === 1) {
          setSelectedWalletId(userWallets[0].id);
        }
      } catch (err) {
        console.error('Error loading wallets:', err);
        setError('Failed to load wallets. Please try again.');
      }
    };
    
    if (user) {
      fetchWallets();
    }
  }, [user]);

  // Load data when a wallet is selected
  useEffect(() => {
    const getWalletData = async () => {
      if (!selectedWalletId) return;
      
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;
      
      setDataLoading(true);
      setLoadingMessage("Loading your open trades...");
      setError(null);
      setApiError(null);
      
      // Show more detailed loading messages to set user expectations
      setTimeout(() => {
        if (dataLoading) {
          setLoadingMessage("Connecting to Solana RPC services...");
        }
      }, 1500);
      
      setTimeout(() => {
        if (dataLoading) {
          setLoadingMessage("Fetching wallet data...");
        }
      }, 3000);
      
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
        } else {
        setError('Failed to load wallet data. Please try again.');
        }
      } finally {
        setDataLoading(false);
        setLoadingMessage('');
      }
    };
    
    getWalletData();
  }, [selectedWalletId, wallets, user?.id]);

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
      wallets={wallets}
      selectedWalletId={selectedWalletId}
      onWalletChange={setSelectedWalletId}
    >
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {apiError && <ApiErrorBanner 
        message={apiError} 
        onRetry={handleRetry} 
        errorType={errorType as 'rpc' | 'auth' | 'timeout' | 'general'} 
      />}

      {!selectedWalletId && (
        <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-6">
          Please select a wallet from the dropdown menu to view your open trades.
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-indigo-200 mb-6">Active Positions</h2>
          
          <div className="overflow-x-auto">
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
                {dataLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
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
                      {selectedWalletId ? 'No open trades found for this wallet' : 'Select a wallet to view open trades'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-indigo-200 mb-6">Position Summary</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Total Open Positions</h3>
              <p className="text-2xl font-semibold text-white">{walletData.length}</p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Total Value</h3>
              <p className="text-2xl font-semibold text-white">
                ${walletData.reduce((sum, token) => sum + (token.totalValue || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Unrealized P/L</h3>
              <p className="text-2xl font-semibold text-white">
                ${walletData.reduce((sum, token) => sum + (token.profitLoss || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <LoadingToast isVisible={dataLoading} message={loadingMessage} />
    </DashboardLayout>
  );
}
