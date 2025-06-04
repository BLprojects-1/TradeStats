import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import NewDashboardLayout from '../layouts/NewDashboardLayout';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import { processTradesToHoldings } from '../../utils/tradeProcessing';
import { formatTokenAmount, formatSmallPrice } from '../../utils/formatters';
import LoadingToast from '../LoadingToast';
import ApiErrorBanner from '../ApiErrorBanner';
import TradeInfoModal from '../TradeInfoModal';
import { supabase } from '../../utils/supabaseClient';

interface CachedTrade {
  token_address: string;
}

export interface Position {
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

const OpenTrades = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const { selectedWalletId, wallets } = useWalletSelection();

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedTradeModal, setSelectedTradeModal] = useState<Position | null>(null);

  // Fetch trading history when wallet changes
  useEffect(() => {
    if (!userId || !selectedWalletId) return;

    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet) return;

    fetchTradingHistory(selectedWallet.wallet_address);
  }, [userId, selectedWalletId, wallets]);

  const fetchTradingHistory = async (walletAddress: string) => {
    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First get the list of tokens from our database
      const { data: cachedTrades, error } = await supabase
        .from('trading_history')
        .select('token_address')
        .eq('wallet_id', (await tradingHistoryService.ensureWalletExists(userId, walletAddress)).walletId)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching token list:', error);
        throw new Error('Failed to fetch token list');
      }

      // Get unique token addresses
      const tokenAddresses = [...new Set(cachedTrades.map((t: CachedTrade) => t.token_address))];

      // Get historical data for these tokens
      const historicalData = await tradingHistoryService.getHistoricalDataForTokens(
        userId,
        walletAddress,
        tokenAddresses as string[]
      );

      // Process all trades into positions
      const allTrades = Object.values(historicalData).flat();
      const positions = await processTradesToHoldings(allTrades);
      setOpenPositions(positions);
      setTotalCount(allTrades.length);
    } catch (error) {
      console.error('Error fetching trading history:', error);
      setError('Failed to fetch trading history');
      toast.error('Failed to fetch trading history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!userId || !selectedWalletId) {
      toast.error('User not authenticated or no wallet selected');
      return;
    }

    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet) {
      toast.error('Selected wallet not found');
      return;
    }

    try {
      setIsRefreshing(true);
      setError(null);
      const { newTradesCount, message } = await tradingHistoryService.refreshTradingHistory(
        userId,
        selectedWallet.wallet_address
      );

      if (newTradesCount > 0) {
        // Refetch trading history to update positions
        await fetchTradingHistory(selectedWallet.wallet_address);
        toast.success(message);
      } else {
        toast.success('No new trades found');
      }
    } catch (error) {
      console.error('Error refreshing trading history:', error);
      setError('Failed to refresh trading history');
      toast.error('Failed to refresh trading history');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenTradeModal = (position: Position) => {
    setSelectedTradeModal(position);
  };

  const handleCloseModal = () => {
    setSelectedTradeModal(null);
  };

  return (
    <NewDashboardLayout title="Open Trades">
      <div className="space-y-6">
        {/* Header with refresh button */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-white">Open Trades</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Error banner */}
        {error && <ApiErrorBanner message={error} onRetry={() => selectedWalletId && fetchTradingHistory(wallets.find(w => w.id === selectedWalletId)?.wallet_address || '')} />}

        {/* Open positions grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {openPositions.map((position) => (
            <div
              key={position.tokenAddress}
              className="bg-[#1a1a1a] rounded-lg p-4 cursor-pointer hover:bg-[#252525] transition-colors"
              onClick={() => handleOpenTradeModal(position)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {position.tokenLogoURI ? (
                    <img
                      src={position.tokenLogoURI}
                      alt={position.tokenSymbol}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                      <span className="text-white text-sm">{position.tokenSymbol[0]}</span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-white font-medium">{position.tokenSymbol}</h3>
                    <p className="text-gray-400 text-sm">
                      {formatTokenAmount(position.remaining)} tokens
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">
                    {formatSmallPrice(position.totalValue)}
                  </p>
                  <p className={`text-sm ${position.profitLoss && position.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {position.profitLoss && position.profitLoss >= 0 ? '+' : ''}
                    {formatSmallPrice(position.profitLoss || 0)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-400">Bought</p>
                  <p className="text-white">{formatTokenAmount(position.totalBought)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Sold</p>
                  <p className="text-white">{formatTokenAmount(position.totalSold)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading toast */}
        <LoadingToast
          isVisible={isLoading || isRefreshing}
          message={isRefreshing ? 'Refreshing trades...' : 'Loading trades...'}
        />

        {/* Trade info modal */}
        {selectedTradeModal && selectedWalletId && (
          <TradeInfoModal
            isOpen={!!selectedTradeModal}
            onClose={handleCloseModal}
            tokenAddress={selectedTradeModal.tokenAddress}
            tokenSymbol={selectedTradeModal.tokenSymbol}
            tokenLogoURI={selectedTradeModal.tokenLogoURI}
            walletAddress={wallets.find(w => w.id === selectedWalletId)?.wallet_address || ''}
            mode="open-trades"
          />
        )}
      </div>
    </NewDashboardLayout>
  );
};

export default OpenTrades; 
