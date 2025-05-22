import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import { ProcessedTrade } from '../../services/tradeProcessor';

const TRADES_PER_PAGE = 20;

// Format helper functions
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

const formatTokenAmount = (amount: number, decimals = 6) => {
  if (amount > 1_000_000) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (amount > 1000) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (amount >= 1) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  if (amount < 0.000001) {
    return amount.toExponential(4);
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 8 });
};

export default function TradeLog() {
  const { user, loading } = useAuth();
  const { selectedWalletId, wallets } = useWalletSelection();
  const router = useRouter();
  const [starredTrades, setStarredTrades] = useState<ProcessedTrade[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTrades, setTotalTrades] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [tempTags, setTempTags] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [solscanLink, setSolscanLink] = useState<string>('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [addingTrade, setAddingTrade] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load starred trades
  useEffect(() => {
    const loadStarredTrades = async () => {
      if (!user?.id) return;

      setDataLoading(true);
      setError(null);
      setApiError(null);

      try {
        const selectedWallet = selectedWalletId ? wallets.find(w => w.id === selectedWalletId) : null;
        const walletAddress = selectedWallet?.wallet_address;

        const result = await tradingHistoryService.getStarredTrades(
          user.id,
          walletAddress,
          TRADES_PER_PAGE,
          (currentPage - 1) * TRADES_PER_PAGE
        );

        setStarredTrades(result.trades);
        setTotalTrades(result.totalCount);
        setTotalPages(Math.ceil(result.totalCount / TRADES_PER_PAGE));
      } catch (err: any) {
        console.error('Error loading starred trades:', err);
        setError('Failed to load starred trades. Please try again.');
      } finally {
        setDataLoading(false);
      }
    };

    if (user?.id) {
      loadStarredTrades();
    }
  }, [user?.id, selectedWalletId, currentPage]);

  // Filter trades based on search and tags
  const filteredTrades = starredTrades.filter(trade => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        trade.tokenSymbol.toLowerCase().includes(query) ||
        trade.tokenAddress.toLowerCase().includes(query) ||
        trade.signature.toLowerCase().includes(query) ||
        (trade.notes && trade.notes.toLowerCase().includes(query)) ||
        (trade.tags && trade.tags.toLowerCase().includes(query));
      
      if (!matchesSearch) return false;
    }

    // Tag filter
    if (selectedTag !== 'all') {
      if (!trade.tags || !trade.tags.toLowerCase().includes(selectedTag.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Get all unique tags
  const allTags = Array.from(new Set(
    starredTrades
      .filter(trade => trade.tags)
      .flatMap(trade => 
        trade.tags!.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      )
  ));

  // Performance metrics
  const totalLoggedTrades = starredTrades.length;
  const avgProfitLoss = starredTrades.length > 0 
    ? starredTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0) / starredTrades.length 
    : 0;
  const mostUsedTags = allTags.slice(0, 3);

  const handleExpandTrade = (signature: string) => {
    setExpandedTrade(expandedTrade === signature ? null : signature);
  };

  const handleEditNotes = (trade: ProcessedTrade) => {
    setEditingNotes(trade.signature);
    setTempNotes(trade.notes || '');
    setTempTags(trade.tags || '');
  };

  const handleSaveNotes = async (trade: ProcessedTrade) => {
    if (!user?.id) return;

    try {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;

      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, selectedWallet.wallet_address);
      
      await tradingHistoryService.updateTradeNotes(walletId, trade.signature, tempNotes, tempTags);
      
      // Update local state
      setStarredTrades(prev => prev.map(t => 
        t.signature === trade.signature 
          ? { ...t, notes: tempNotes, tags: tempTags }
          : t
      ));
      
      setEditingNotes(null);
    } catch (err) {
      console.error('Error saving notes:', err);
      setError('Failed to save notes. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setTempNotes('');
    setTempTags('');
  };

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
          <h1 className="text-xl sm:text-2xl font-semibold text-white mb-2">Trade Log</h1>
          <p className="text-gray-500">Your personal collection of starred trades, notes, and learning insights</p>
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

        {/* Performance Snapshot */}
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Performance Snapshot</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Total Trades Logged</h3>
              <p className="text-xl sm:text-2xl font-semibold text-white">{totalLoggedTrades}</p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Average P/L per Trade</h3>
              <p className={`text-xl sm:text-2xl font-semibold ${avgProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${avgProfitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1 sm:mb-2">Most Used Tags</h3>
              <p className="text-lg sm:text-xl font-semibold text-white">
                {mostUsedTags.length > 0 ? mostUsedTags.join(', ') : 'None yet'}
              </p>
            </div>
          </div>
        </div>

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
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                placeholder="Search trades, notes, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-[#23232b] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:w-48">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full bg-[#23232b] text-gray-300 rounded-md px-3 py-2 text-sm border border-gray-700"
              >
                <option value="all">All Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Starred Trades Feed */}
          <h2 className="text-lg sm:text-xl font-semibold text-indigo-200 mb-4">Starred Trades ({filteredTrades.length})</h2>
          
          {/* Desktop table - hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P/L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tags</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {dataLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Loading starred trades...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTrades.length > 0 ? (
                  filteredTrades.map((trade) => (
                    <>
                      <tr key={trade.signature} className="bg-[#1a1a1a] hover:bg-[#23232b] transition-colors cursor-pointer" onClick={() => handleExpandTrade(trade.signature)}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex items-center space-x-2">
                            {trade.tokenLogoURI && (
                              <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-5 h-5 rounded-full" />
                            )}
                            <span>{trade.tokenSymbol}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{trade.type}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${(trade.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${(trade.profitLoss || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatDate(trade.timestamp)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {trade.tags ? (
                            <div className="flex flex-wrap gap-1">
                              {trade.tags.split(',').map((tag, index) => (
                                <span key={index} className="bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded text-xs">
                                  {tag.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500">No tags</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditNotes(trade);
                            }}
                            className="text-indigo-400 hover:text-indigo-300"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                      {expandedTrade === trade.signature && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-[#252525]">
                            {editingNotes === trade.signature ? (
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
                                  <textarea
                                    value={tempNotes}
                                    onChange={(e) => setTempNotes(e.target.value)}
                                    className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    rows={4}
                                    placeholder="What did you learn from this trade?"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-400 mb-2">Tags (comma-separated)</label>
                                  <input
                                    value={tempTags}
                                    onChange={(e) => setTempTags(e.target.value)}
                                    className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="swing, scalp, accumulate"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveNotes(trade)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div>
                                  <h4 className="text-sm font-medium text-gray-400 mb-2">Trade Details</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-400">Amount:</span>
                                      <span className="text-white ml-2">{formatTokenAmount(trade.amount)}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Value:</span>
                                      <span className="text-white ml-2">${trade.valueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Time:</span>
                                      <span className="text-white ml-2">{formatTime(trade.timestamp)}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Signature:</span>
                                      <span className="text-white ml-2 font-mono">{trade.signature.slice(0, 8)}...</span>
                                    </div>
                                  </div>
                                </div>
                                {trade.notes && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-400 mb-2">Notes</h4>
                                    <p className="text-white text-sm bg-[#1a1a1a] p-3 rounded">{trade.notes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">
                      {selectedWalletId ? 'No starred trades found. Star some trades from your trading history to see them here.' : 'Select a wallet to view starred trades'}
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
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading starred trades...</span>
                </div>
              </div>
            ) : filteredTrades.length > 0 ? (
              <div className="space-y-4">
                {filteredTrades.map((trade) => (
                  <div key={trade.signature} className="bg-[#252525] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {trade.tokenLogoURI && (
                          <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-white font-medium">{trade.tokenSymbol}</span>
                        <span className="text-gray-400 text-sm">{trade.type}</span>
                      </div>
                      <button
                        onClick={() => handleExpandTrade(trade.signature)}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        {expandedTrade === trade.signature ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div>
                        <p className="text-gray-400">P/L</p>
                        <p className={`${(trade.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${(trade.profitLoss || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Date</p>
                        <p className="text-gray-300">{formatDate(trade.timestamp)}</p>
                      </div>
                    </div>

                    {trade.tags && (
                      <div className="mb-2">
                        <p className="text-gray-400 text-sm mb-1">Tags</p>
                        <div className="flex flex-wrap gap-1">
                          {trade.tags.split(',').map((tag, index) => (
                            <span key={index} className="bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded text-xs">
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {expandedTrade === trade.signature && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        {editingNotes === trade.signature ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
                              <textarea
                                value={tempNotes}
                                onChange={(e) => setTempNotes(e.target.value)}
                                className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                rows={4}
                                placeholder="What did you learn from this trade?"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-400 mb-2">Tags (comma-separated)</label>
                              <input
                                value={tempTags}
                                onChange={(e) => setTempTags(e.target.value)}
                                className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="swing, scalp, accumulate"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveNotes(trade)}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-400">Amount:</span>
                                <span className="text-white ml-2">{formatTokenAmount(trade.amount)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Value:</span>
                                <span className="text-white ml-2">${trade.valueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                            {trade.notes && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-400 mb-2">Notes</h4>
                                <p className="text-white text-sm bg-[#1a1a1a] p-3 rounded">{trade.notes}</p>
                              </div>
                            )}
                            <button
                              onClick={() => handleEditNotes(trade)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
                            >
                              Edit Notes
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-300 text-center py-4">
                {selectedWalletId ? 'No starred trades found. Star some trades from your trading history to see them here.' : 'Select a wallet to view starred trades'}
              </div>
            )}
          </div>
        </div>

        <LoadingToast 
          isVisible={dataLoading} 
          message="Loading your trade log..." 
        />
      </div>
    </DashboardLayout>
  );
}
