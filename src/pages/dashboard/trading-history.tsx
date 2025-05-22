import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { getTrackedWallets, TrackedWallet } from '../../utils/userProfile';
import LoadingToast from '../../components/LoadingToast';
import { ProcessedTrade } from '../../services/tradeProcessor';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import ApiErrorBanner from '../../components/ApiErrorBanner';

const TRADES_PER_PAGE = 20; // Increase from 10 to 20 for more trades per page

// Add a helper function to format token amounts with appropriate decimal places
const formatTokenAmount = (amount: number, decimals = 6) => {
  // For very large numbers with many decimals, use appropriate formatting
  if (amount > 1_000_000) {
    return amount.toLocaleString(undefined, { 
      maximumFractionDigits: 2 
    });
  }
  
  // For large numbers, use fewer decimal places
  if (amount > 1000) {
    return amount.toLocaleString(undefined, { 
      maximumFractionDigits: 2 
    });
  }
  
  // For medium amounts (1-1000), show more decimals
  if (amount >= 1) {
    return amount.toLocaleString(undefined, { 
      maximumFractionDigits: 4 
    });
  }
  
  // For small amounts (<1), use decimals or significant digits based on size
  if (amount < 0.000001) {
    return amount.toExponential(4);
  }
  
  // For other small amounts, show up to 8 decimal places
  return amount.toLocaleString(undefined, { 
    maximumFractionDigits: 8
  });
};

// Add this helper function to format market cap values
const formatMarketCap = (marketCap?: number) => {
  if (!marketCap || marketCap === 0) {
    return 'N/A';
  }
  
  // Format large numbers with abbreviations
  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toLocaleString(undefined, { 
      maximumFractionDigits: 1
    })}B`;
  } else if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toLocaleString(undefined, { 
      maximumFractionDigits: 1
    })}M`;
  } else if (marketCap >= 1_000) {
    return `$${(marketCap / 1_000).toLocaleString(undefined, { 
      maximumFractionDigits: 1
    })}K`;
  } else {
    return `$${marketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
};

// Add a new formatter for very small price numbers
const formatSmallPrice = (price?: number) => {
  if (!price || price === 0) {
    return 'N/A';
  }
  
  // For normal-sized numbers, just format with $ sign
  if (price >= 0.01) {
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
  }
  
  // For very small numbers, format with leading zeros notation
  const priceStr = price.toString();
  const decimalParts = priceStr.split('.');
  
  if (decimalParts.length === 2) {
    const decimalPart = decimalParts[1];
    // Count leading zeros
    let leadingZeros = 0;
    for (let i = 0; i < decimalPart.length; i++) {
      if (decimalPart[i] === '0') {
        leadingZeros++;
      } else {
        break;
      }
    }
    
    if (leadingZeros >= 3) {
      // Show digits after leading zeros
      const significantPart = decimalPart.substring(leadingZeros);
      // Try to get at least 2 digits after the zeros
      const digitsToShow = Math.min(2, significantPart.length);
      return `$0.0(${leadingZeros})${significantPart.substring(0, digitsToShow)}`;
    }
  }
  
  // For other small numbers, use standard formatting
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 8 })}`;
};

const formatDate = (timestamp: number | string | Date) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  } catch (err) {
    console.error('Error formatting date:', err);
    return 'Invalid Date';
  }
};

const formatTime = (timestamp: number | string | Date) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  } catch (err) {
    console.error('Error formatting time:', err);
    return 'Invalid Time';
  }
};

export default function TradingHistory() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [trades, setTrades] = useState<ProcessedTrade[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [tokenFilter, setTokenFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTrades, setTotalTrades] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [initialScanInProgress, setInitialScanInProgress] = useState(false);
  const [errorType, setErrorType] = useState<string | null>(null);

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
    
    if (user)
      fetchWallets();
  }, [user]);

  // Load data when a wallet is selected or filters change
  useEffect(() => {
    const getTradeHistory = async () => {
      if (!selectedWalletId || !user?.id) return;
      
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;
      
      setDataLoading(true);
      setLoadingMessage("Loading your trading history...");
      setError(null);
      
      try {
        console.log('Loading trades for wallet:', selectedWallet.wallet_address);
        
        // Reset pagination when filters change
        setCurrentPage(1);
        
        // Check if initial scan is complete
        setInitialScanInProgress(selectedWallet.initial_scan_complete === false);

        // Show more detailed loading messages to set user expectations
        setTimeout(() => {
          if (dataLoading) {
            setLoadingMessage("Connecting to Solana RPC services...");
          }
        }, 1500);
        
        setTimeout(() => {
          if (dataLoading) {
            setLoadingMessage("Fetching your transaction history...");
          }
        }, 3000);
        
        setTimeout(() => {
          if (dataLoading) {
            setLoadingMessage("Processing transaction data...");
          }
        }, 5000);
        
        setTimeout(() => {
          if (dataLoading) {
            setLoadingMessage("Almost there! Formatting your trades...");
          }
        }, 8000);

        // Load first page of trades
        await loadPage(1, selectedWallet.wallet_address);
      } catch (err) {
        console.error('Error loading trade history:', err);
        setError('Failed to load trading history. Please try again.');
      } finally {
        setDataLoading(false);
      }
    };
    
    if (selectedWalletId) {
      getTradeHistory();
    }
  }, [selectedWalletId, timeFilter, tokenFilter, user?.id]);

  const loadPage = async (page: number, walletAddress: string) => {
    try {
      setDataLoading(true);
      setLoadingMessage(`Loading page ${page} of transactions...`);
      setApiError(null);
      setErrorType(null);
      
      // Calculate offset
      const offset = (page - 1) * TRADES_PER_PAGE;
      
      console.log('Loading page', page, 'with offset', offset);

      const result = await tradingHistoryService.getTradingHistory(
        user!.id,
        walletAddress,
        TRADES_PER_PAGE,
        page
      );

      if (result.trades.length === 0 && page === 1) {
        // No trades found for first page
        console.log('No trades found for this wallet');
      } else {
        console.log(`Loaded ${result.trades.length} trades`);
      }

      setTrades(result.trades);
      setTotalTrades(result.totalCount);
      setTotalPages(Math.ceil(result.totalCount / TRADES_PER_PAGE));
      setCurrentPage(page);
    } catch (err: any) {
      console.error('Error loading page:', err);
      
      // Enhanced error handling with more specific messages based on our testing results
      if (err.message?.includes('TRANSACTION_FETCH_ERROR')) {
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
      } else if (err.message?.includes('DRPC API') || err.message?.includes('RPC')) {
        setApiError('We are experiencing issues connecting to the Solana network. Please try again later.');
        setErrorType('rpc');
      } else if (err.message?.includes('Jupiter') || err.message?.includes('price')) {
        setApiError('We are experiencing issues fetching token prices. Some price data may be unavailable.');
        setErrorType('general');
      } else if (err.message?.includes('timeout') || err.message?.includes('ECONNABORTED')) {
        setApiError('Request timeout. The Solana network may be experiencing high traffic or the public RPC endpoints we use may be rate-limiting our requests.');
        setErrorType('timeout');
      } else {
        setError('Failed to load trading history. Please try again.');
      }
    } finally {
      setDataLoading(false);
      setLoadingMessage('');
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet) return;
    
    await loadPage(newPage, selectedWallet.wallet_address);
  };

  const handleRetry = () => {
    if (selectedWalletId) {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (selectedWallet) {
        setApiError(null);
        loadPage(currentPage, selectedWallet.wallet_address);
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
      title="Trading History"
      wallets={wallets}
      selectedWalletId={selectedWalletId}
      onWalletChange={setSelectedWalletId}
    >
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2 text-white">Trading History</h1>
          <p className="text-gray-500">View your Solana trading history across DEXs</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-6" role="alert">
            <p>{error}</p>
          </div>
        )}
        
        {apiError && <ApiErrorBanner 
          message={apiError} 
          onRetry={handleRetry}
          errorType={errorType as 'rpc' | 'auth' | 'timeout' | 'general'} 
        />}

        <div className="bg-[#1a1a1a] rounded-lg p-6 mb-8">
          <div className="mb-4">
            <label htmlFor="wallet-select" className="block text-sm font-medium text-gray-400 mb-2">
              Select Wallet
            </label>
            <select
              id="wallet-select"
              className="block w-full p-2 bg-[#23232b] text-white border border-gray-700 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={selectedWalletId || ''}
              onChange={(e) => setSelectedWalletId(e.target.value)}
            >
              <option value="">Select a wallet</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.wallet_address} {wallet.label || wallet.nickname ? `(${wallet.label || wallet.nickname})` : ''}
                </option>
              ))}
            </select>
          </div>

          {!selectedWalletId && (
            <div className="bg-[#23232b] border border-indigo-500/20 text-indigo-200 px-4 py-3 rounded mb-6">
              Please select a wallet from the dropdown menu to view your trading history.
            </div>
          )}
          
          {initialScanInProgress && (
            <div className="bg-[#23232b] border border-blue-500/20 text-blue-200 px-4 py-3 rounded mb-4">
              <p className="font-bold">Initial wallet scan in progress</p>
              <p>This may take up to 2 minutes for the first scan. Subsequent updates will be much faster.</p>
              <p className="mt-2 text-sm">We're scanning your wallet's transaction history and processing trades. Please wait...</p>
            </div>
          )}

          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-indigo-200">Trade History</h2>
              {dataLoading && (
                <div className="ml-4 flex items-center text-indigo-400 text-sm">
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {loadingMessage || 'Loading...'}
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <select 
                className="bg-[#23232b] text-gray-300 rounded-md px-3 py-2 text-sm border border-gray-700"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                disabled={dataLoading}
              >
                <option value="all">All Time</option>
                <option value="30d">Last 30 Days</option>
                <option value="7d">Last 7 Days</option>
                <option value="24h">Last 24 Hours</option>
              </select>
              <select 
                className="bg-[#23232b] text-gray-300 rounded-md px-3 py-2 text-sm border border-gray-700"
                value={tokenFilter}
                onChange={(e) => setTokenFilter(e.target.value)}
                disabled={dataLoading}
              >
                <option value="all">All Tokens</option>
                {Array.from(new Set(trades.map(trade => trade.tokenSymbol)))
                  .filter(symbol => symbol)
                  .sort()
                  .map(symbol => (
                    <option key={symbol} value={symbol.toLowerCase()}>
                      {symbol}
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Token
                    <span className="text-xs text-indigo-500 ml-1 font-normal">(Jupiter API)</span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Price (USD)
                    <span className="text-xs text-indigo-500 ml-1 font-normal">(Jupiter API)</span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Value (USD)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {dataLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{loadingMessage || 'Loading transactions...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : trades.length > 0 ? (
                  trades.map((trade) => (
                    <tr key={trade.signature} className="bg-[#1a1a1a] hover:bg-[#23232b] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex items-center space-x-2">
                          {trade.tokenLogoURI && (
                            <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-5 h-5 rounded-full" />
                          )}
                          <span className="flex flex-col">
                            <span>{trade.tokenSymbol || 'Unknown'}</span>
                            {trade.tokenAddress && (
                              <span className="text-xs text-gray-500">
                                {`${trade.tokenAddress.substring(0, 4)}...${trade.tokenAddress.substring(trade.tokenAddress.length - 4)}`}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {trade.type || 'UNKNOWN'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {trade.amount ? formatTokenAmount(trade.amount, trade.decimals) : '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {trade.priceUSD ? formatSmallPrice(trade.priceUSD) : '$0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {trade.valueUSD ? `$${trade.valueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '$0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDate(trade.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatTime(trade.timestamp)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">
                      {selectedWalletId ? 'No trades found for this wallet' : 'Select a wallet to view trade history'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1a1a1a] rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Trades</h3>
            <p className="text-2xl font-semibold text-white">{trades.length}</p>
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Volume</h3>
            <p className="text-2xl font-semibold text-white">
              ${trades.reduce((sum, trade) => sum + (trade.valueUSD || trade.value * 70), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Net P/L</h3>
            <p className="text-2xl font-semibold text-white">
              ${trades.reduce((sum, trade) => {
                const value = trade.valueUSD || trade.value * 70;
                return sum + (trade.type === 'BUY' ? -value : value);
              }, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Debug section */}
        <div className="bg-[#1a1a1a] rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-indigo-200">Debugging</h3>
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="bg-[#23232b] text-gray-300 rounded-md px-3 py-2 text-sm hover:bg-[#303030] transition-colors border border-gray-700"
            >
              {showDebug ? 'Hide Raw Data' : 'Show Raw Data'}
            </button>
          </div>
          
          {showDebug && (
            <div className="mt-4 bg-[#23232b] p-4 rounded-md">
              <h4 className="text-md font-semibold text-indigo-200 mb-2">Raw Transaction Data</h4>
              <div className="space-y-4">
                {rawTransactions.map((tx, index) => (
                  <div key={index} className="border-b border-gray-800 pb-4">
                    <div className="text-sm text-gray-400 mb-2">
                      <div className="font-semibold text-indigo-300">Transaction {index + 1}</div>
                      <div>Signature: {tx.signature}</div>
                      <div className="text-yellow-500">
                        SOL Balance Changes:
                        <div className="pl-4">
                          <div>Before: {tx.preBalances?.[0] ? (tx.preBalances[0] / 1e9).toFixed(9) : 'N/A'} SOL</div>
                          <div>After: {tx.postBalances?.[0] ? (tx.postBalances[0] / 1e9).toFixed(9) : 'N/A'} SOL</div>
                          <div>Change: {tx.preBalances?.[0] && tx.postBalances?.[0] 
                            ? ((tx.postBalances[0] - tx.preBalances[0]) / 1e9).toFixed(9) 
                            : 'N/A'} SOL</div>
                        </div>
                      </div>
                    </div>
                    <pre className="text-xs text-gray-400 max-h-40 overflow-auto">
                      {JSON.stringify(tx, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <LoadingToast isVisible={dataLoading} message={loadingMessage} />
    </DashboardLayout>
  );
}
