import { useState, useEffect } from 'react';
import { comprehensivePoolDiscovery } from '../services/comprehensivePoolDiscovery';

export default function TestComprehensiveDiscovery() {
  const [targetToken] = useState('EdfRrkHUkzg1LM3qf8titmZrYrdMLhLwHyHqRSGtdcXH');
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Capture console logs
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      const logMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev.slice(-100), `LOG: ${logMessage}`]); // Keep last 100 logs
      originalLog(...args);
    };

    console.error = (...args) => {
      const logMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev.slice(-100), `ERROR: ${logMessage}`]);
      originalError(...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  const testPoolDiscovery = async () => {
    setLoading(true);
    setError(null);
    setDiscoveryResult(null);
    setLogs([]);

    try {
      console.log(`🎯 Testing comprehensive pool discovery for token: ${targetToken}`);
      console.log(`📊 This token was previously causing "No liquidity pool found" errors`);
      
      const startTime = Date.now();
      const pool = await comprehensivePoolDiscovery.getBestPool(targetToken);
      const endTime = Date.now();
      
      console.log(`⏱️ Discovery completed in ${endTime - startTime}ms`);
      
      if (pool) {
        console.log(`🎉 SUCCESS! Pool discovered for previously failing token!`);
        setDiscoveryResult({
          found: true,
          address: pool.address.toString(),
          tokenA: pool.tokenA.toString(),
          tokenB: pool.tokenB.toString(),
          programId: pool.programId.toString(),
          source: pool.source,
          poolType: pool.poolType,
          decimalsA: pool.decimalsA,
          decimalsB: pool.decimalsB,
          liquidity: pool.liquidity,
          lastUpdated: new Date(pool.lastUpdated).toLocaleString(),
          discoveryTime: endTime - startTime
        });
      } else {
        console.log(`❌ No pool found - this indicates the issue persists`);
        setDiscoveryResult({
          found: false,
          message: 'No pool found for this token via comprehensive discovery',
          discoveryTime: endTime - startTime
        });
      }
    } catch (err: any) {
      console.error('❌ Comprehensive pool discovery test failed:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testStatsDiscovery = async () => {
    try {
      console.log('📊 Getting discovery service stats...');
      const stats = comprehensivePoolDiscovery.getStats();
      console.log('Stats:', stats);
    } catch (err) {
      console.error('Error getting stats:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔍 Comprehensive Pool Discovery Test</h1>
        
        {/* Target Token Info */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🎯 Target Token (Previously Failing)</h2>
          <div className="bg-gray-800 p-4 rounded">
            <p className="font-mono text-sm break-all text-yellow-300">{targetToken}</p>
            <p className="text-gray-400 text-sm mt-2">
              ⚠️ This token was causing "No liquidity pool found" errors in onChainPriceService
            </p>
            <p className="text-blue-300 text-sm mt-1">
              🎯 Testing if comprehensive discovery can find pools that were previously missed
            </p>
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🧪 Discovery Tests</h2>
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={testPoolDiscovery}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded font-medium text-lg"
            >
              {loading ? '🔍 Discovering Pools...' : '🎯 Test Pool Discovery'}
            </button>
            
            <button
              onClick={testStatsDiscovery}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-3 rounded font-medium"
            >
              📊 Get Stats
            </button>
            
            <button
              onClick={clearLogs}
              className="bg-gray-600 hover:bg-gray-700 px-4 py-3 rounded font-medium"
            >
              🗑️ Clear Logs
            </button>
          </div>
          
          {loading && (
            <div className="mt-4 p-4 bg-blue-900/30 border border-blue-500 rounded">
              <p className="text-blue-200">
                🔍 Scanning all major DEX programs for pools containing this token...
              </p>
              <p className="text-blue-300 text-sm mt-1">
                📡 Checking Raydium V4/V5, Orca V1, Whirlpool, Meteora, etc.
              </p>
              <p className="text-blue-400 text-sm mt-1">
                ⏱️ This may take 30-60 seconds due to multiple RPC calls
              </p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-500 text-red-200 px-6 py-4 rounded mb-8">
            <h3 className="font-semibold mb-2">❌ Discovery Failed</h3>
            <p>{error}</p>
          </div>
        )}

        {/* Results Display */}
        {discoveryResult && (
          <div className={`border rounded-lg p-6 mb-8 ${
            discoveryResult.found 
              ? 'bg-green-900 border-green-500 text-green-200' 
              : 'bg-yellow-900 border-yellow-500 text-yellow-200'
          }`}>
            <h3 className="text-xl font-semibold mb-4">
              {discoveryResult.found ? '✅ BREAKTHROUGH! Pool Discovered!' : '⚠️ No Pool Found'}
            </h3>
            
            {discoveryResult.found ? (
              <div className="space-y-3">
                <div className="bg-green-800 p-3 rounded">
                  <p className="font-semibold text-green-100">
                    🎉 SUCCESS: The comprehensive discovery found a pool for this previously failing token!
                  </p>
                  <p className="text-green-200 text-sm mt-1">
                    This proves that the new system can discover pools that the old hardcoded approach missed.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Pool Address:</strong>
                    <p className="font-mono break-all">{discoveryResult.address}</p>
                  </div>
                  <div>
                    <strong>DEX Source:</strong>
                    <p className="font-semibold">{discoveryResult.source} ({discoveryResult.poolType})</p>
                  </div>
                  <div>
                    <strong>Token A:</strong>
                    <p className="font-mono break-all">{discoveryResult.tokenA}</p>
                  </div>
                  <div>
                    <strong>Token B:</strong>
                    <p className="font-mono break-all">{discoveryResult.tokenB}</p>
                  </div>
                  <div>
                    <strong>Program ID:</strong>
                    <p className="font-mono break-all">{discoveryResult.programId}</p>
                  </div>
                  <div>
                    <strong>Discovery Time:</strong>
                    <p className="font-semibold">{discoveryResult.discoveryTime}ms</p>
                  </div>
                </div>
                
                {discoveryResult.liquidity && (
                  <div>
                    <strong>Liquidity:</strong>
                    <p>${discoveryResult.liquidity.toLocaleString()}</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p>{discoveryResult.message}</p>
                <p className="text-sm mt-2">Discovery Time: {discoveryResult.discoveryTime}ms</p>
                <div className="bg-yellow-800 p-3 rounded mt-3">
                  <p className="text-yellow-100 text-sm">
                    🔍 This suggests the token might be in a less common DEX or have very low liquidity.
                    Consider adding more DEX programs to the discovery service.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Console Logs */}
        <div className="bg-gray-900 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📜 Live Discovery Logs</h2>
            <div className="flex gap-2">
              <span className="text-sm text-gray-400">
                Showing last {logs.length} entries
              </span>
              <button
                onClick={clearLogs}
                className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm"
              >
                Clear
              </button>
            </div>
          </div>
          
          <div className="bg-black rounded p-4 h-96 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">Console logs will appear here during discovery...</p>
            ) : (
              logs.map((log, index) => {
                let colorClass = 'text-gray-300';
                if (log.startsWith('ERROR:')) colorClass = 'text-red-400';
                else if (log.includes('✅')) colorClass = 'text-green-400';
                else if (log.includes('🎯') || log.includes('🎉')) colorClass = 'text-blue-400';
                else if (log.includes('📡')) colorClass = 'text-purple-400';
                else if (log.includes('⚠️') || log.includes('❌')) colorClass = 'text-yellow-400';
                
                return (
                  <div key={index} className={`mb-1 ${colorClass}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-900 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">📖 How This Works</h2>
          <div className="text-gray-300 space-y-2">
            <p>🔍 <strong>Comprehensive Discovery:</strong> Uses getProgramAccounts to scan all major DEX programs</p>
            <p>📡 <strong>Multi-DEX Support:</strong> Searches Raydium V4/V5, Orca V1, Whirlpool, Meteora, Lifinity, Saber</p>
            <p>🎯 <strong>Targeted Search:</strong> Uses memcmp filters to find pools containing the specific token</p>
            <p>⚡ <strong>Smart Caching:</strong> Caches discovered pools to avoid repeated RPC calls</p>
            <p>🏆 <strong>Best Pool Selection:</strong> Scores pools by liquidity, DEX reliability, and quote token preference</p>
            <p>🔧 <strong>Problem Solving:</strong> Eliminates "No liquidity pool found" errors by finding real on-chain pools</p>
          </div>
        </div>
      </div>
    </div>
  );
} 