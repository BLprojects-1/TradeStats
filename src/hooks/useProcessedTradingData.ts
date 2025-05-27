/**
 * Hook for accessing processed trading data
 * 
 * This hook provides direct access to the processed data for each page,
 * allowing pages to get their specific data format without having to process
 * the raw data themselves.
 */

import { useState, useEffect } from 'react';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { supabaseTradingService } from '../services/supabaseTradingService';

interface UseProcessedTradingDataOptions {
  autoLoad?: boolean;
  dataType: 'openTrades' | 'topTrades' | 'tradeLog' | 'tradingHistory';
}

export function useProcessedTradingData(options: UseProcessedTradingDataOptions) {
  const { selectedWalletId, wallets } = useWalletSelection();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh: boolean = false) => {
    if (!selectedWalletId) {
      setData([]);
      return;
    }

    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet) {
      setError('Selected wallet not found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use the Supabase trading service to get data directly from the trading_history table
      let result: any[] = [];

      switch (options.dataType) {
        case 'openTrades':
          result = await supabaseTradingService.getOpenTrades(selectedWalletId);
          break;
        case 'topTrades':
          result = await supabaseTradingService.getTopTrades(selectedWalletId);
          break;
        case 'tradeLog':
          result = await supabaseTradingService.getTradeLog(selectedWalletId);
          break;
        case 'tradingHistory':
          result = await supabaseTradingService.getTradingHistory(selectedWalletId);
          break;
      }

      setData(result);
    } catch (err) {
      console.error('Error loading processed trading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trading data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load data when selectedWalletId changes or on initial load if autoLoad is true
    if (options.autoLoad || selectedWalletId) {
      loadData();
    }
  }, [selectedWalletId, options.dataType]);

  const refreshData = async () => {
    await loadData(true); // Force refresh
  };

  return {
    data,
    loading,
    error,
    refreshData
  };
}
