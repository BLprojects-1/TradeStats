import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { tradingHistoryService } from '../services/tradingHistoryService';
import { ProcessedTrade } from '../services/tradeProcessor';

interface UseTradingHistoryOptions {
  limit?: number;
  page?: number;
  minTimestamp?: number;
  autoLoad?: boolean;
}

interface UseTradingHistoryReturn {
  trades: ProcessedTrade[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  apiError: string | null;
  errorType: string | null;
  refreshTrades: () => Promise<void>;
  loadMoreTrades: () => Promise<void>;
  hasMoreTrades: boolean;
  currentPage: number;
  setCurrentPage: (page: number) => void;
}

export const useTradingHistory = (options: UseTradingHistoryOptions = {}): UseTradingHistoryReturn => {
  const { user } = useAuth();
  const { selectedWalletId, wallets } = useWalletSelection();
  
  const {
    limit = 50,
    page = 1,
    minTimestamp,
    autoLoad = true
  } = options;

  const [trades, setTrades] = useState<ProcessedTrade[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(page);
  const [hasMoreTrades, setHasMoreTrades] = useState(false);

  const selectedWallet = wallets.find(w => w.id === selectedWalletId);

  const loadTrades = useCallback(async (pageToLoad: number = currentPage, append: boolean = false) => {
    if (!user?.id || !selectedWallet) {
      setTrades([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    setApiError(null);
    setErrorType(null);

    try {
      console.log(`Loading trades for wallet: ${selectedWallet.wallet_address}, page: ${pageToLoad}`);
      
      const result = await tradingHistoryService.getTradingHistory(
        user.id,
        selectedWallet.wallet_address,
        limit,
        pageToLoad,
        minTimestamp
      );

      if (result) {
        if (append) {
          setTrades(prev => [...prev, ...result.trades]);
        } else {
          setTrades(result.trades);
        }
        setTotalCount(result.totalCount);
        setHasMoreTrades(pageToLoad * limit < result.totalCount);
        console.log(`Loaded ${result.trades.length} trades, total: ${result.totalCount}`);
      } else {
        if (!append) {
          setTrades([]);
          setTotalCount(0);
        }
        setHasMoreTrades(false);
      }
    } catch (err: any) {
      console.error('Error loading trades:', err);
      
      // Enhanced error handling
      if (err.message?.includes('Minimum context slot')) {
        setApiError('The Solana RPC service reported a sync delay. We\'re using cached data for now.');
        setErrorType('rpc');
      } else if (err.message?.includes('TRANSACTION_FETCH_ERROR') || err.message?.includes('getTransaction')) {
        setApiError('Unable to connect to Solana network to fetch your transaction data. Please try again in a few moments.');
        setErrorType('rpc');
      } else if (err.message?.includes('Service Unavailable') || err.message?.includes('503')) {
        setApiError('The Solana RPC service is currently unavailable. Please try again later.');
        setErrorType('rpc');
      } else if (err.message?.includes('API key') || err.message?.includes('403') || err.message?.includes('401')) {
        setApiError('Authentication issue with Solana RPC providers. Please try again later.');
        setErrorType('auth');
      } else if (err.message?.includes('timeout') || err.message?.includes('ECONNABORTED')) {
        setApiError('Request timeout. The Solana network may be experiencing high traffic.');
        setErrorType('timeout');
      } else if (err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
        setApiError('Rate limit reached. Please wait a moment before trying again.');
        setErrorType('rpc');
      } else {
        setError('Failed to load trades. Please try again.');
        setErrorType('general');
      }
      
      if (!append) {
        setTrades([]);
        setTotalCount(0);
      }
      setHasMoreTrades(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedWallet, limit, currentPage, minTimestamp]);

  const refreshTrades = useCallback(async () => {
    if (!user?.id || !selectedWallet) return;
    
    try {
      await tradingHistoryService.refreshTradingHistory(
        user.id,
        selectedWallet.wallet_address
      );
      await loadTrades(1, false);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error refreshing trades:', err);
      throw err;
    }
  }, [user?.id, selectedWallet, loadTrades]);

  const loadMoreTrades = useCallback(async () => {
    const nextPage = currentPage + 1;
    await loadTrades(nextPage, true);
    setCurrentPage(nextPage);
  }, [currentPage, loadTrades]);

  const handlePageChange = useCallback(async (newPage: number) => {
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
      await loadTrades(newPage, false);
    }
  }, [currentPage, loadTrades]);

  // Auto-load trades when dependencies change
  useEffect(() => {
    if (autoLoad && selectedWalletId) {
      loadTrades(1, false);
      setCurrentPage(1);
    }
  }, [selectedWalletId, user?.id, autoLoad, loadTrades]);

  return {
    trades,
    totalCount,
    loading,
    error,
    apiError,
    errorType,
    refreshTrades,
    loadMoreTrades,
    hasMoreTrades,
    currentPage,
    setCurrentPage: handlePageChange
  };
}; 