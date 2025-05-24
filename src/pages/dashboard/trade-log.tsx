import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingToast from '../../components/LoadingToast';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import { ProcessedTrade } from '../../services/tradeProcessor';
import { formatTokenAmount, formatSmallPrice, formatDate, formatTime } from '../../utils/formatters';

const TRADES_PER_PAGE = 20;

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
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [solscanLink, setSolscanLink] = useState<string>('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [addingTrade, setAddingTrade] = useState(false);
  const [unstarringTrade, setUnstarringTrade] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

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

  // Filter trades based on search
  const filteredTrades = starredTrades.filter(trade => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        trade.tokenSymbol.toLowerCase().includes(query) ||
        trade.tokenAddress.toLowerCase().includes(query) ||
        trade.signature.toLowerCase().includes(query) ||
        (trade.notes && trade.notes.toLowerCase().includes(query));
      
      if (!matchesSearch) return false;
    }

    return true;
  });

  const handleEditNotes = (trade: ProcessedTrade) => {
    if (editingNotes === trade.signature) {
      setEditingNotes(null);
      setTempNotes('');
    } else {
      setEditingNotes(trade.signature);
      setTempNotes(trade.notes || '');
    }
  };

  const handleSaveNotes = async (trade: ProcessedTrade) => {
    if (!user?.id) return;

    try {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;

      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, selectedWallet.wallet_address);
      
      await tradingHistoryService.updateTradeNotes(walletId, trade.signature, tempNotes, '');
      
      // Update local state
      setStarredTrades(prev => prev.map(t => 
        t.signature === trade.signature 
          ? { ...t, notes: tempNotes }
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
  };

  const handleUnstarTrade = async (trade: ProcessedTrade) => {
    if (!user?.id) return;

    setUnstarringTrade(trade.signature);
    try {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;

      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, selectedWallet.wallet_address);
      await tradingHistoryService.toggleStarredTrade(walletId, trade.signature, false);
      
      // Remove from local starred trades list
      setStarredTrades(prev => prev.filter(t => t.signature !== trade.signature));
      
      // Close the editing panel
      setEditingNotes(null);
      setTempNotes('');
    } catch (err) {
      console.error('Error unstarring trade:', err);
      setError('Failed to unstar trade. Please try again.');
    } finally {
      setUnstarringTrade(null);
    }
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

  const handleRefresh = async () => {
    if (!user?.id || refreshing) return;
    
    const selectedWallet = selectedWalletId ? wallets.find(w => w.id === selectedWalletId) : null;
    if (selectedWallet && !selectedWallet.initial_scan_complete) return;
    
    setRefreshing(true);
    setRefreshMessage(null);
    
    try {
      if (selectedWallet) {
        const result = await tradingHistoryService.refreshTradingHistory(
          user.id,
          selectedWallet.wallet_address
        );
        
        setRefreshMessage(result.message);
        
        // If new trades were found, reload the starred trades
        if (result.newTradesCount > 0) {
          const starredResult = await tradingHistoryService.getStarredTrades(
            user.id,
            selectedWallet.wallet_address,
            TRADES_PER_PAGE,
            (currentPage - 1) * TRADES_PER_PAGE
          );
          
          setStarredTrades(starredResult.trades);
          setTotalTrades(starredResult.totalCount);
          setTotalPages(Math.ceil(starredResult.totalCount / TRADES_PER_PAGE));
        }
      } else {
        setRefreshMessage('Please select a wallet to refresh data.');
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Trade Log</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
          <p className="text-gray-500">Your personal collection of starred trades, notes, and learning insights</p>
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
          onRetry={() => {}} 
          errorType={errorType as 'rpc' | 'auth' | 'timeout' | 'general'} 
        />}

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
                placeholder="Search trades, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-[#23232b] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</th>
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
                      <tr key={trade.signature} className="bg-[#1a1a1a] hover:bg-[#23232b] transition-colors cursor-pointer" onClick={() => handleEditNotes(trade)}>
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
                          {formatSmallPrice(trade.profitLoss || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatDate(trade.timestamp)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatTime(trade.timestamp)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <span className="text-gray-500 text-xs">
                            {trade.notes ? 'Has notes' : 'Click to add notes'}
                          </span>
                        </td>
                      </tr>
                      {editingNotes === trade.signature && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-[#252525]">
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
                                <textarea
                                  value={tempNotes}
                                  onChange={(e) => setTempNotes(e.target.value)}
                                  className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  rows={4}
                                  placeholder="What did you learn from this trade?"
                                  autoFocus
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSaveNotes(trade);
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelEdit();
                                    }}
                                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnstarTrade(trade);
                                  }}
                                  disabled={unstarringTrade === trade.signature}
                                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm flex items-center space-x-2"
                                >
                                  {unstarringTrade === trade.signature ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      <span>Unstarring...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                      </svg>
                                      <span>Unstar</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
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
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading starred trades...</span>
                </div>
              </div>
            ) : filteredTrades.length > 0 ? (
              <div className="space-y-4">
                {filteredTrades.map((trade) => (
                  <div key={trade.signature} className="bg-[#252525] p-4 rounded-lg cursor-pointer" onClick={() => handleEditNotes(trade)}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {trade.tokenLogoURI && (
                          <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-white font-medium">{trade.tokenSymbol}</span>
                        <span className="text-gray-400 text-sm">{trade.type}</span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {trade.notes ? 'Has notes' : 'Tap to add notes'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                      <div>
                        <p className="text-gray-400">P/L</p>
                        <p className={`${(trade.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatSmallPrice(trade.profitLoss || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Time</p>
                        <p className="text-gray-300">{formatTime(trade.timestamp)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Date</p>
                        <p className="text-gray-300">{formatDate(trade.timestamp)}</p>
                      </div>
                    </div>

                    {editingNotes === trade.signature && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
                            <textarea
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              rows={4}
                              placeholder="What did you learn from this trade?"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveNotes(trade);
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnstarTrade(trade);
                              }}
                              disabled={unstarringTrade === trade.signature}
                              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm flex items-center justify-center space-x-2"
                            >
                              {unstarringTrade === trade.signature ? (
                                <>
                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Removing from starred...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                  <span>Remove from starred</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
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
