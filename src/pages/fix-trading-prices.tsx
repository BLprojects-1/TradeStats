import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { onChainPriceService } from '../services/onChainPriceService';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';

interface TradeRecord {
  id: string;
  signature: string;
  timestamp: string;
  token_address: string;
  token_symbol: string;
  amount: number;
  price_usd: number;
  value_usd: number;
  type: 'BUY' | 'SELL';
}

interface PriceFixResult {
  signature: string;
  tokenSymbol: string;
  oldPrice: number;
  newPrice: number;
  status: 'success' | 'error';
  error?: string;
}

export default function FixTradingPrices() {
  const { user } = useAuth();
  const { selectedWalletId, wallets } = useWalletSelection();
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [fixing, setFixing] = useState(false);
  const [results, setResults] = useState<PriceFixResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Load trades from the database
  const loadTrades = async () => {
    if (!selectedWalletId) {
      alert('Please select a wallet first');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trading_history')
        .select('*')
        .eq('wallet_id', selectedWalletId)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (data) {
        setTrades(data);
        console.log(`Loaded ${data.length} trades from database`);
      }
    } catch (error) {
      console.error('Error loading trades:', error);
      alert('Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  // Fix prices for all trades
  const fixAllPrices = async () => {
    if (trades.length === 0) {
      alert('Please load trades first');
      return;
    }

    setFixing(true);
    setResults([]);
    
    const fixResults: PriceFixResult[] = [];

    // Process trades in batches to avoid rate limiting
    const BATCH_SIZE = 3;
    for (let i = 0; i < trades.length; i += BATCH_SIZE) {
      const batch = trades.slice(i, i + BATCH_SIZE);
      
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(trades.length / BATCH_SIZE)}`);
      
      const batchPromises = batch.map(async (trade) => {
        try {
          // Get the correct historical price
          const tradeTimestamp = new Date(trade.timestamp).getTime();
          console.log(`Fixing price for ${trade.token_symbol} at ${new Date(tradeTimestamp).toISOString()}`);
          
          const correctPrice = await onChainPriceService.getHistoricalPrice(
            trade.token_address, 
            tradeTimestamp
          );
          
          // Calculate new values
          const newValueUSD = trade.amount * correctPrice;
          const newProfitLoss = trade.type === 'BUY' ? -newValueUSD : newValueUSD;
          
          // Update the database
          const { error } = await supabase
            .from('trading_history')
            .update({
              price_usd: correctPrice,
              value_usd: newValueUSD,
              profit_loss: newProfitLoss
            })
            .eq('signature', trade.signature);
          
          if (error) throw error;
          
          console.log(`✅ Fixed ${trade.token_symbol}: $${trade.price_usd} → $${correctPrice}`);
          
          return {
            signature: trade.signature,
            tokenSymbol: trade.token_symbol,
            oldPrice: trade.price_usd,
            newPrice: correctPrice,
            status: 'success' as const
          };
          
        } catch (error) {
          console.error(`❌ Failed to fix ${trade.token_symbol}:`, error);
          
          return {
            signature: trade.signature,
            tokenSymbol: trade.token_symbol,
            oldPrice: trade.price_usd,
            newPrice: 0,
            status: 'error' as const,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      fixResults.push(...batchResults);
      setResults([...fixResults]); // Update UI after each batch
      
      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < trades.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    setFixing(false);
    console.log(`Completed price fix for ${fixResults.length} trades`);
  };

  const selectedWallet = wallets.find(w => w.id === selectedWalletId);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Fix Trading Prices</h1>
        
        <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          <h3 className="font-semibold">⚠️ Price Correction Tool</h3>
          <p>This tool will recalculate ALL historical prices using real DexScreener data and update your database. Use carefully!</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Selected Wallet</label>
              <div className="p-3 bg-gray-800 border border-gray-700 rounded-md">
                {selectedWallet ? (
                  <span className="text-green-400">
                    {selectedWallet.wallet_address.slice(0, 8)}...{selectedWallet.wallet_address.slice(-8)}
                  </span>
                ) : (
                  <span className="text-red-400">No wallet selected</span>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Loaded Trades</label>
              <div className="p-3 bg-gray-800 border border-gray-700 rounded-md">
                <span className={trades.length > 0 ? 'text-green-400' : 'text-gray-400'}>
                  {trades.length} trades
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={loadTrades}
              disabled={loading || !selectedWalletId}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md font-medium"
            >
              {loading ? 'Loading...' : 'Load Trades'}
            </button>
            
            <button
              onClick={fixAllPrices}
              disabled={fixing || trades.length === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md font-medium"
            >
              {fixing ? 'Fixing Prices...' : 'Fix All Prices'}
            </button>
          </div>
        </div>

        {trades.length > 0 && (
          <div className="bg-gray-900 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Current Trades (Sample)</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Token</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Current Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {trades.slice(0, 10).map((trade) => (
                    <tr key={trade.signature}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                        {trade.token_symbol}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-300">
                        ${trade.price_usd.toFixed(8)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                        {trade.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                        ${trade.value_usd.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(trade.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {trades.length > 10 && (
              <p className="mt-4 text-sm text-gray-400">
                Showing first 10 of {trades.length} trades. All will be processed when fixing.
              </p>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Fix Results</h2>
            
            <div className="mb-4">
              <span className="text-green-400">
                ✅ {results.filter(r => r.status === 'success').length} successful
              </span>
              {' | '}
              <span className="text-red-400">
                ❌ {results.filter(r => r.status === 'error').length} failed
              </span>
            </div>
            
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="sticky top-0 bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Token</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Old Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">New Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Change</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {results.map((result, index) => {
                    const priceChange = result.newPrice > 0 ? 
                      ((result.newPrice - result.oldPrice) / result.oldPrice * 100) : 0;
                    
                    return (
                      <tr key={index}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                          {result.tokenSymbol}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-300">
                          ${result.oldPrice.toFixed(8)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-300">
                          {result.newPrice > 0 ? `$${result.newPrice.toFixed(8)}` : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {result.newPrice > 0 ? (
                            <span className={priceChange > 0 ? 'text-green-400' : 'text-red-400'}>
                              {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {result.status === 'success' ? (
                            <span className="text-green-400">✅ Fixed</span>
                          ) : (
                            <span className="text-red-400" title={result.error}>❌ Error</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 