import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { fetchTopTrades, fetchTradingHistory, TradeData } from '../../utils/heliusData';
import { getTrackedWallets, TrackedWallet } from '../../utils/userProfile';
import LoadingToast from '../../components/LoadingToast';

export default function TopTrades() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [topTrades, setTopTrades] = useState<TradeData[]>([]);
  const [tradingHistory, setTradingHistory] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const getTradeData = async () => {
      if (!selectedWalletId) return;
      
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (!selectedWallet) return;
      
      setDataLoading(true);
      setLoadingMessage("We're experiencing high traffic, loading your top trades now...");
      setError(null);
      
      try {
        // Fetch top trades and trading history in parallel
        const [tradesData, historyData] = await Promise.all([
          fetchTopTrades(selectedWallet.wallet_address),
          fetchTradingHistory(selectedWallet.wallet_address)
        ]);
        
        setTopTrades(tradesData);
        setTradingHistory(historyData);
      } catch (err) {
        console.error('Error loading trade data:', err);
        setError('Failed to load trade data. Please try again.');
      } finally {
        setDataLoading(false);
        setLoadingMessage('');
      }
    };
    
    getTradeData();
  }, [selectedWalletId, wallets]);

  // Calculate best and worst trades
  const bestTrade = topTrades.length > 0 
    ? topTrades.reduce((best, trade) => trade.profitLoss > best.profitLoss ? trade : best, topTrades[0])
    : null;
    
  const worstTrade = topTrades.length > 0 
    ? topTrades.reduce((worst, trade) => trade.profitLoss < worst.profitLoss ? trade : worst, topTrades[0])
    : null;

  // Calculate performance metrics
  const winningTrades = topTrades.filter(trade => trade.profitLoss > 0);
  const losingTrades = topTrades.filter(trade => trade.profitLoss < 0);
  const winRate = topTrades.length > 0 ? (winningTrades.length / topTrades.length * 100).toFixed(1) : '0';
  const avgWin = winningTrades.length > 0 
    ? winningTrades.reduce((sum, trade) => sum + trade.profitLoss, 0) / winningTrades.length 
    : 0;
  const avgLoss = losingTrades.length > 0 
    ? Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profitLoss, 0) / losingTrades.length)
    : 0;
  const profitFactor = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '0.00';

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
      title="Top Trades"
      wallets={wallets}
      selectedWalletId={selectedWalletId}
      onWalletChange={setSelectedWalletId}
    >
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {!selectedWalletId && (
        <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-6">
          Please select a wallet from the dropdown menu to view your top trades.
        </div>
      )}

      {dataLoading && (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-indigo-200 mb-6">Best Performing Trades</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Bought</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">P/L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {topTrades.length > 0 ? (
                  topTrades
                    .sort((a, b) => b.profitLoss - a.profitLoss) // Sort by profit (highest first)
                    .map((trade) => (
                      <tr key={trade.tokenAddress}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex items-center space-x-2">
                            {trade.tokenLogoURI && (
                              <img src={trade.tokenLogoURI} alt={trade.tokenSymbol} className="w-5 h-5 rounded-full" />
                            )}
                            <span>{trade.tokenSymbol}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {trade.totalBought.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {trade.totalSold.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${trade.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {trade.duration}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                      {selectedWalletId ? 'No trades found for this wallet' : 'Select a wallet to view trades'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-indigo-200 mb-6">Best Trade</h2>
            {bestTrade ? (
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center mb-4">
                  {bestTrade.tokenLogoURI && (
                    <img src={bestTrade.tokenLogoURI} alt={bestTrade.tokenSymbol} className="w-8 h-8 rounded-full mr-3" />
                  )}
                  <h3 className="text-xl font-semibold text-white">{bestTrade.tokenSymbol}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Profit</p>
                    <p className="text-lg font-semibold text-green-400">
                      ${bestTrade.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-lg font-semibold text-white">{bestTrade.duration}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No trades available</p>
              </div>
            )}
          </div>

          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-indigo-200 mb-6">Worst Trade</h2>
            {worstTrade ? (
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center mb-4">
                  {worstTrade.tokenLogoURI && (
                    <img src={worstTrade.tokenLogoURI} alt={worstTrade.tokenSymbol} className="w-8 h-8 rounded-full mr-3" />
                  )}
                  <h3 className="text-xl font-semibold text-white">{worstTrade.tokenSymbol}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Loss</p>
                    <p className="text-lg font-semibold text-red-400">
                      ${worstTrade.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-lg font-semibold text-white">{worstTrade.duration}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No trades available</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-indigo-200 mb-6">Performance Metrics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Win Rate</h3>
              <p className="text-2xl font-semibold text-white">{winRate}%</p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Average Win</h3>
              <p className="text-2xl font-semibold text-green-400">
                ${avgWin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Average Loss</h3>
              <p className="text-2xl font-semibold text-red-400">
                ${avgLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-[#252525] p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Profit Factor</h3>
              <p className="text-2xl font-semibold text-white">{profitFactor}</p>
            </div>
          </div>
        </div>
      </div>

      <LoadingToast isVisible={dataLoading} message={loadingMessage} />
    </DashboardLayout>
  );
}
