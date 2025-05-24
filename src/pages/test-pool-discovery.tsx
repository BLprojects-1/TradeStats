import { useState, useEffect } from 'react';
import { poolDiscoveryService } from '../services/poolDiscoveryService';

export default function TestPoolDiscovery() {
  const [stats, setStats] = useState<any>(null);
  const [testToken, setTestToken] = useState('jQxGhh5r78RVp8Q5yAcjoy6ing5tFx5BSHV2nprP3cu');
  const [poolResult, setPoolResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load stats on component mount
  useEffect(() => {
    const loadStats = () => {
      try {
        const serviceStats = poolDiscoveryService.getStats();
        setStats(serviceStats);
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const testPoolDiscovery = async () => {
    if (!testToken.trim()) return;
    
    setLoading(true);
    setError(null);
    setPoolResult(null);

    try {
      console.log(`Testing pool discovery for token: ${testToken}`);
      const pool = await poolDiscoveryService.getBestPool(testToken);
      
      if (pool) {
        setPoolResult({
          found: true,
          address: pool.address.toString(),
          tokenA: pool.tokenA.toString(),
          tokenB: pool.tokenB.toString(),
          programId: pool.programId.toString(),
          liquidity: pool.liquidity,
          source: pool.source,
          lastUpdated: new Date(pool.lastUpdated).toLocaleString()
        });
      } else {
        setPoolResult({
          found: false,
          message: 'No pool found for this token'
        });
      }
    } catch (err) {
      console.error('Pool discovery test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const refreshPools = async () => {
    setLoading(true);
    try {
      await poolDiscoveryService.forceRefresh();
      const serviceStats = poolDiscoveryService.getStats();
      setStats(serviceStats);
    } catch (err) {
      console.error('Failed to refresh pools:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Pool Discovery Service Test</h1>
        
        {/* Service Stats */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Service Statistics</h2>
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 p-4 rounded">
                <h3 className="font-medium text-blue-400">Total Pools</h3>
                <p className="text-2xl font-bold">{stats.totalPools.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 p-4 rounded">
                <h3 className="font-medium text-green-400">Last Indexed</h3>
                <p className="text-sm">{stats.lastIndexed.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 p-4 rounded">
                <h3 className="font-medium text-purple-400">Pools by DEX</h3>
                <div className="text-sm">
                  {Object.entries(stats.poolsByDex).map(([dex, count]: [string, any]) => (
                    <div key={dex} className="flex justify-between">
                      <span>{dex}:</span>
                      <span>{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">Loading stats...</p>
          )}
        </div>

        {/* Pool Discovery Test */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Pool Discovery</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Token Mint Address</label>
            <input
              type="text"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              placeholder="Enter token mint address"
            />
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={testPoolDiscovery}
              disabled={loading || !testToken.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium"
            >
              {loading ? 'Testing...' : 'Find Best Pool'}
            </button>
            
            <button
              onClick={refreshPools}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium"
            >
              {loading ? 'Refreshing...' : 'Refresh Pool Index'}
            </button>
          </div>

          {error && (
            <div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
              Error: {error}
            </div>
          )}

          {poolResult && (
            <div className={`border rounded p-4 ${
              poolResult.found 
                ? 'bg-green-900 border-green-500 text-green-200' 
                : 'bg-yellow-900 border-yellow-500 text-yellow-200'
            }`}>
              <h3 className="font-semibold mb-2">
                {poolResult.found ? '✅ Pool Found!' : '⚠️ No Pool Found'}
              </h3>
              
              {poolResult.found ? (
                <div className="space-y-2 text-sm">
                  <div><strong>Pool Address:</strong> {poolResult.address}</div>
                  <div><strong>Token A:</strong> {poolResult.tokenA}</div>
                  <div><strong>Token B:</strong> {poolResult.tokenB}</div>
                  <div><strong>Program ID:</strong> {poolResult.programId}</div>
                  <div><strong>Source:</strong> {poolResult.source}</div>
                  <div><strong>Liquidity:</strong> ${poolResult.liquidity?.toLocaleString() || 'N/A'}</div>
                  <div><strong>Last Updated:</strong> {poolResult.lastUpdated}</div>
                </div>
              ) : (
                <p>{poolResult.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Common Test Tokens */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Test Tokens</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
              { name: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
              { name: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
              { name: 'Problem Token', mint: 'jQxGhh5r78RVp8Q5yAcjoy6ing5tFx5BSHV2nprP3cu' },
            ].map((token) => (
              <button
                key={token.name}
                onClick={() => setTestToken(token.mint)}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 p-3 rounded text-left"
              >
                <div className="font-medium">{token.name}</div>
                <div className="text-xs text-gray-400 break-all">{token.mint}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 