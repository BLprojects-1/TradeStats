import { useState } from 'react';
import { jupiterApiService } from '../services/jupiterApiService';
import { onChainPriceService } from '../services/onChainPriceService';

interface PriceTestResult {
  source: string;
  price: number;
  error?: string;
  timestamp: string;
}

export default function TestHistoricalPrices() {
  const [testToken, setTestToken] = useState('4zYpBjAZQjktpmx4NEjjMXuAtNh2FpnXFkr81xiFapeV'); // DREAMFITS
  const [testTimestamp, setTestTimestamp] = useState('1747971000000'); // 23/05/2025 04:30 AM
  const [results, setResults] = useState<PriceTestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const testSources = [
    {
      name: 'Jupiter API Service',
      test: async (token: string, timestamp: string) => {
        const price = await jupiterApiService.getTokenPriceInUSD(token, parseInt(timestamp));
        return { price, source: 'jupiterApiService' };
      }
    },
    {
      name: 'OnChain Price Service', 
      test: async (token: string, timestamp: string) => {
        const price = await onChainPriceService.getHistoricalPrice(token, parseInt(timestamp));
        return { price, source: 'onChainPriceService' };
      }
    },
    {
      name: 'Local Pools Service Direct',
      test: async (token: string, timestamp: string) => {
        const response = await fetch(`http://127.0.0.1:3001/token/historical-price/${token}/${timestamp}`);
        const data = await response.json();
        return { price: data.price, source: 'localPoolsService', extra: data };
      }
    },
    {
      name: 'DexScreener Direct',
      test: async (token: string) => {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`);
        const data = await response.json();
        const bestPair = data.pairs?.reduce((best: any, current: any) => {
          const bestLiq = best.liquidity?.usd || 0;
          const currentLiq = current.liquidity?.usd || 0;
          return currentLiq > bestLiq ? current : best;
        });
        return { price: parseFloat(bestPair?.priceUsd || '0'), source: 'dexScreener', extra: bestPair };
      }
    }
  ];

  const handleTest = async () => {
    setLoading(true);
    setResults([]);
    
    const testResults: PriceTestResult[] = [];
    const targetDate = new Date(parseInt(testTimestamp));
    
    for (const source of testSources) {
      try {
        console.log(`Testing ${source.name}...`);
        const result = await source.test(testToken, testTimestamp);
        testResults.push({
          source: source.name,
          price: result.price,
          timestamp: targetDate.toISOString()
        });
        console.log(`✅ ${source.name}: $${result.price}`);
      } catch (error) {
        console.error(`❌ ${source.name} failed:`, error);
        testResults.push({
          source: source.name,
          price: 0,
          error: error instanceof Error ? error.message : String(error),
          timestamp: targetDate.toISOString()
        });
      }
    }
    
    setResults(testResults);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Historical Price Testing</h1>
        
        <div className="bg-gray-900 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Token Mint Address</label>
              <select 
                value={testToken} 
                onChange={(e) => setTestToken(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-white"
              >
                <option value="4zYpBjAZQjktpmx4NEjjMXuAtNh2FpnXFkr81xiFapeV">DREAMFITS</option>
                <option value="jQxGhh5r78RVp8Q5yAcjoy6ing5tFx5BSHV2nprP3cu">UFUN</option>
                <option value="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v">USDC</option>
                <option value="So11111111111111111111111111111111111111112">SOL</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Target Timestamp</label>
              <select 
                value={testTimestamp} 
                onChange={(e) => setTestTimestamp(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-white"
              >
                <option value="1747971000000">2025-05-23 04:30:00 (DREAMFITS time)</option>
                <option value="1747968648000">2025-05-23 06:17:28 (UFUN time)</option>
                <option value="{Date.now()}">Current time</option>
              </select>
            </div>
          </div>
          
          <button
            onClick={handleTest}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md font-medium"
          >
            {loading ? 'Testing...' : 'Test All Sources'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            <p className="text-sm text-gray-400 mb-4">
              Target: {new Date(parseInt(testTimestamp)).toISOString()}
            </p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Price (USD)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {results.map((result, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {result.source}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {result.price > 0 ? (
                          <span className="text-green-400 font-mono">
                            ${result.price.toFixed(8)}
                          </span>
                        ) : (
                          <span className="text-red-400">$0.00000000</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.error ? (
                          <span className="text-red-400">Error: {result.error}</span>
                        ) : (
                          <span className="text-green-400">✅ Success</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Price Comparison</h3>
              <div className="text-xs text-gray-400">
                {results.filter(r => r.price > 0).map((result, index) => (
                  <div key={index}>
                    {result.source}: ${result.price.toFixed(8)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 