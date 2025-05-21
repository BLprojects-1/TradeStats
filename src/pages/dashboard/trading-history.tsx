import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { getTrackedWallets, TrackedWallet } from '../../utils/userProfile';
import LoadingToast from '../../components/LoadingToast';
import { ProcessedTrade } from '../../services/tradeProcessor';
import { tradingHistoryService } from '../../services/tradingHistoryService';

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
        
        // Load first page of trades
        await loadPage(1, selectedWallet.wallet_address);
      } catch (err) {
        console.error('Error loading trade history:', err);
        setError('Failed to load trading history. Please try again.');
      } finally {
        setDataLoading(false);
        setLoadingMessage('');
      }
    };
    
    getTradeHistory();
  }, [selectedWalletId, wallets, timeFilter, tokenFilter]);

  const loadPage = async (page: number, walletAddress: string) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setDataLoading(true);
    setLoadingMessage(`Loading page ${page} of transactions...`);
    
    try {
      console.log('Fetching page', page, 'for wallet', walletAddress);
      
      // Get trades from the trading history service
      const { trades: processedTrades, totalCount } = await tradingHistoryService.getTradingHistory(
        user.id,
        walletAddress,
        TRADES_PER_PAGE,
        page
      );

      console.log('Received trades:', processedTrades.length, 'Sample trade:', processedTrades[0]);

      // Apply time filter
      let filteredTrades = processedTrades;
      if (timeFilter !== 'all') {
        const now = Date.now();
        const timeFilters = {
          '30d': 30 * 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000
        };
        filteredTrades = processedTrades.filter(t => {
          const tradeTime = new Date(t.timestamp).getTime();
          return (now - tradeTime) <= timeFilters[timeFilter as keyof typeof timeFilters];
        });
      }

      // Apply token filter
      if (tokenFilter !== 'all') {
        filteredTrades = filteredTrades.filter(t => 
          t.tokenSymbol?.toLowerCase().includes(tokenFilter.toLowerCase())
        );
      }

      // Calculate totals
      const totalVolume = filteredTrades.reduce((sum, trade) => 
        sum + (trade.valueUSD || 0), 0
      );

      const netPL = filteredTrades.reduce((sum, trade) => {
        const value = trade.valueUSD || 0;
        return sum + (trade.type === 'BUY' ? -value : value);
      }, 0);

      // Update state
      setTrades(filteredTrades);
      setTotalTrades(totalCount);
      setCurrentPage(page);
      setTotalPages(Math.ceil(totalCount / TRADES_PER_PAGE));
      
    } catch (err) {
      console.error('Error in loadPage:', err);
      throw err;
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
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <h2 className="text-2xl font-semibold text-indigo-200">Trade History</h2>
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
                className="bg-[#252525] text-gray-300 rounded-md px-3 py-2 text-sm"
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
                className="bg-[#252525] text-gray-300 rounded-md px-3 py-2 text-sm"
                value={tokenFilter}
                onChange={(e) => setTokenFilter(e.target.value)}
                disabled={dataLoading}
              >
                <option value="all">All Tokens</option>
                {/* Generate options for each unique token symbol found in trades */}
                {Array.from(new Set(trades.map(trade => trade.tokenSymbol)))
                  .filter(symbol => symbol)  // Just filter out empty symbols
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
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-center text-indigo-300">
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
                    <tr key={trade.signature}>
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
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                      {selectedWalletId ? 'No trades found for this wallet' : 'Select a wallet to view trade history'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {trades.length > 0 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {dataLoading ? 
                    "Loading..." : 
                    `Showing ${trades.length} transaction${trades.length === 1 ? '' : 's'}`
                  }
                  {lastSignature && totalPages > currentPage && 
                    " (More transactions available)"
                  }
                </div>
                
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || dataLoading}
                    className="px-3 py-2 rounded-md bg-[#252525] text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#303030] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Show current page and 2 pages before and after
                      const pageRange = 2;
                      let pageNum = currentPage - pageRange + i;
                      
                      // Adjust if we're at the beginning or end
                      if (currentPage <= pageRange) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - pageRange) {
                        pageNum = totalPages - 4 + i;
                      }
                      
                      // Only show valid page numbers
                      if (pageNum < 1 || pageNum > totalPages) {
                        return null;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          disabled={dataLoading}
                          className={`px-3 py-1 rounded-md ${
                            currentPage === pageNum
                              ? 'bg-indigo-600 text-white'
                              : 'bg-[#252525] text-gray-300 hover:bg-[#303030]'
                          } transition-colors`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    {/* Show ellipsis if there are more pages */}
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <span className="text-gray-500">...</span>
                    )}
                    
                    {/* Always show the last page if we have many pages */}
                    {totalPages > 5 && (
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={dataLoading || currentPage === totalPages}
                        className={`px-3 py-1 rounded-md ${
                          currentPage === totalPages
                            ? 'bg-indigo-600 text-white'
                            : 'bg-[#252525] text-gray-300 hover:bg-[#303030]'
                        } transition-colors`}
                      >
                        {totalPages}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || dataLoading}
                    className="px-3 py-2 rounded-md bg-[#252525] text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#303030] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-indigo-200 mb-4">Total Trades</h3>
            <p className="text-3xl font-bold text-white">{trades.length}</p>
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-indigo-200 mb-4">Total Volume</h3>
            <p className="text-3xl font-bold text-white">
              ${trades.reduce((sum, trade) => sum + (trade.valueUSD || trade.value * 70), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-indigo-200 mb-4">Net P/L</h3>
            <p className="text-3xl font-bold text-white">
              ${trades.reduce((sum, trade) => {
                const value = trade.valueUSD || trade.value * 70;
                return sum + (trade.type === 'BUY' ? -value : value);
              }, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        
        {/* Debug section */}
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-indigo-200">Debugging</h3>
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="bg-[#252525] text-gray-300 rounded-md px-3 py-2 text-sm hover:bg-[#303030]"
            >
              {showDebug ? 'Hide Raw Data' : 'Show Raw Data'}
            </button>
          </div>
          
          {showDebug && (
            <div className="mt-4 bg-[#0d0d0d] p-4 rounded-md">
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
