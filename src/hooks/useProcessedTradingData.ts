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
    console.log('🔧 useProcessedTradingData - loadData called for:', options.dataType, 'walletId:', selectedWalletId);
    
    if (!selectedWalletId) {
      console.log('⚠️ No selectedWalletId, clearing data');
      setData([]);
      return;
    }

    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet) {
      console.log('❌ Selected wallet not found in wallets list');
      setError('Selected wallet not found');
      return;
    }

    console.log('🚀 Starting data load for', options.dataType);
    setLoading(true);
    setError(null);

    try {
      // Test database connection first (only for debugging)
      if (process.env.NODE_ENV === 'development') {
        await supabaseTradingService.testDatabaseConnection(selectedWalletId);
      }

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

      console.log('✅ Data loaded successfully for', options.dataType, ':', result.length, 'items');
      setData(result);
    } catch (err) {
      console.error('❌ Error loading processed trading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trading data');
    } finally {
      setLoading(false);
    }
  };

  // Load data immediately when selectedWalletId is available (regardless of autoLoad setting)
  useEffect(() => {
    console.log('🔄 useProcessedTradingData useEffect triggered - selectedWalletId:', selectedWalletId, 'dataType:', options.dataType);
    if (selectedWalletId) {
      loadData();
    } else {
      console.log('⚠️ No selectedWalletId in useEffect, clearing data');
      setData([]);
    }
  }, [selectedWalletId, options.dataType]);

  // Also trigger load on mount if we already have a selectedWalletId
  useEffect(() => {
    console.log('🎯 useProcessedTradingData mount effect - checking if we need to load data immediately');
    if (selectedWalletId) {
      console.log('🎯 selectedWalletId available on mount, loading data');
      loadData();
    }
  }, []); // Only run on mount

  const refreshData = async () => {
    console.log('🔄 refreshData called for', options.dataType);
    await loadData(true); // Force refresh
  };

  return {
    data,
    loading,
    error,
    refreshData
  };
}
