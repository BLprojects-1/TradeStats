import { useState, useEffect } from 'react';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { supabaseCacheService } from '../services/supabaseCacheService';

interface UseHistoricalTradingDataOptions {
  autoLoad?: boolean;
}

export function useHistoricalTradingData(options: UseHistoricalTradingDataOptions = {}) {
  const { selectedWalletId, wallets } = useWalletSelection();
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh: boolean = false) => {
    if (!selectedWalletId) {
      setAnalysisResult(null);
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
      // Use the cache service to get data
      const result = await supabaseCacheService.getWalletData(selectedWallet.wallet_address, forceRefresh);
      setAnalysisResult(result);
    } catch (err) {
      console.error('Error loading trading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trading data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only auto-load if explicitly enabled (for onboarding)
    if (options.autoLoad) {
      loadData();
    } else if (selectedWalletId) {
      // Check if we already have cached data for this wallet
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (selectedWallet && supabaseCacheService.hasCachedData(selectedWallet.wallet_address)) {
        loadData(); // Load from cache
      }
    }
  }, [selectedWalletId]);

  const refreshData = async () => {
    await loadData(true); // Force refresh
  };

  return {
    analysisResult,
    loading,
    error,
    refreshData
  };
}
