import { useState, useEffect } from 'react';
import { localPoolsService } from '../services/localPoolsService';
import { onChainPriceService } from '../services/onChainPriceService';

export default function TestLocalPools() {
  const [targetToken] = useState('EdfRrkHUkzg1LM3qf8titmZrYrdMLhLwHyHqRSGtdcXH');
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);
  const [priceResult, setPriceResult] = useState<any>(null);
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
      setLogs(prev => [...prev.slice(-100), `LOG: ${logMessage}`]);
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

  // Check service availability on mount
  useEffect(() => {
    checkServiceAvailability();
  }, []);

  const checkServiceAvailability = async () => {
    try {
      console.log('🔍 Checking local pools service availability...');
      const available = await localPoolsService.isServiceAvailable();
      setServiceAvailable(available);
      if (available) {
        console.log('✅ Local pools service is available');
      } else {
        console.log('❌ Local pools service is not available');
      }
    } catch (error) {
      console.error('Error checking service availability:', error);
      setServiceAvailable(false);
    }
  };

  const testPoolDiscovery = async () => {
    setLoading(true);
    setError(null);
    setDiscoveryResult(null);
    setLogs([]);

    try {
      console.log(`🎯 Testing local pools discovery for token: ${targetToken}`);
      
      const startTime = Date.now();
      const pools = await localPoolsService.getPoolsByToken(targetToken);
      const endTime = Date.now();
      
      console.log(`⏱️ Discovery completed in ${endTime - startTime}ms`);
      
      if (pools.length > 0) {
        console.log(`🎉 SUCCESS! Found ${pools.length} pools for previously failing token!`);
        setDiscoveryResult({
          found: true,
          poolCount: pools.length,
          pools: pools.map(pool => ({
            id: pool.id,
            type: pool.type,
            token0: {
              mint: pool.token0.mint,
              symbol: pool.token0.symbol,
              decimals: pool.token0.decimals
            },
            token1: {
              mint: pool.token1.mint,
              symbol: pool.token1.symbol,
              decimals: pool.token1.decimals
            },
            liquidity: pool.liquidity,
            volume24h: pool.volume24h,
            address: pool.address
          })),
          discoveryTime: endTime - startTime
        });
      } else {
        console.log(`❌ No pools found via local pools service`);
        setDiscoveryResult({
          found: false,
          message: 'No pools found for this token via local pools service',
          discoveryTime: endTime - startTime
        });
      }
    } catch (err: any) {
      console.error('❌ Local pools discovery test failed:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testPriceService = async () => {
    setLoading(true);
    setError(null);
    setPriceResult(null);

    try {
      console.log(`💰 Testing price service for token: ${targetToken}`);
      
      const startTime = Date.now();
      const price = await onChainPriceService.getTokenPrice(targetToken);
      const endTime = Date.now();
      
      console.log(`⏱️ Price lookup completed in ${endTime - startTime}ms`);
      
      if (price) {
        console.log(`🎉 SUCCESS! Price found: ${price.price}`);
        setPriceResult({
          found: true,
          price: price.price,
          decimals: price.decimals,
          slot: price.slot,
          poolId: price.poolId,
          source: price.source,
          lookupTime: endTime - startTime
        });
      } else {
        console.log(`❌ No price found`);
        setPriceResult({
          found: false,
          message: 'No price found for this token',
          lookupTime: endTime - startTime
        });
      }
    } catch (err: any) {
      console.error('❌ Price service test failed:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testStats = async () => {
    try {
      console.log('📊 Getting local pools service stats...');
      const stats = localPoolsService.getStats();
      console.log('Local Pools Stats:', stats);
      
      const serviceStats = onChainPriceService.getStats();
      console.log('Price Service Stats:', serviceStats);
    } catch (err) {
      console.error('Error getting stats:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🏊 Local Pools Service Test</h1>
        
        {/* Service Status */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🔌 Service Status</h2>
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded ${
              serviceAvailable === null 
                ? 'bg-yellow-600' 
                : serviceAvailable 
                  ? 'bg-green-600' 
                  : 'bg-red-600'
            }`}>
              {serviceAvailable === null 
                ? '🔍 Checking...' 
                : serviceAvailable 
                  ? '✅ Local Pools Service Available' 
                  : '❌ Local Pools Service Unavailable'
              }
            </div>
            <button
              onClick={checkServiceAvailability}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium"
            >
              🔄 Recheck
            </button>
          </div>
          
          {serviceAvailable === false && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded">
              <p className="text-red-200 font-semibold">⚠️ Local Pools Service Not Running</p>
              <p className="text-red-300 text-sm mt-2">
                Please ensure the local pools service is running on http://127.0.0.1:3001
              </p>
              <p className="text-red-300 text-sm mt-1">
                Expected endpoints: /pool/by-token-ids and /pool/by-id
              </p>
            </div>
          )}
        </div>

        {/* Target Token Info */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🎯 Target Token (Previously Failing)</h2>
          <div className="bg-gray-800 p-4 rounded">
            <p className="font-mono text-sm break-all text-yellow-300">{targetToken}</p>
            <p className="text-gray-400 text-sm mt-2">
              ⚠️ This token was causing "No liquidity pool found" errors
            </p>
            <p className="text-blue-300 text-sm mt-1">
              🎯 Testing if local pools service can find pools that were previously missed
            </p>
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🧪 Local Pools Tests</h2>
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={testPoolDiscovery}
              disabled={loading || !serviceAvailable}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded font-medium text-lg"
            >
              {loading ? '🔍 Discovering...' : '🏊 Test Pool Discovery'}
            </button>
            
            <button
              onClick={testPriceService}
              disabled={loading || !serviceAvailable}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded font-medium text-lg"
            >
              {loading ? '💰 Getting Price...' : '💰 Test Price Service'}
            </button>
            
            <button
              onClick={testStats}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-3 rounded font-medium"
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
                🔍 Using local pools service API to discover pools...
              </p>
              <p className="text-blue-300 text-sm mt-1">
                📡 Making API calls to http://127.0.0.1:3001/pool/*
              </p>
              <p className="text-blue-400 text-sm mt-1">
                ⚡ This should be much faster than direct blockchain queries
              </p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-500 text-red-200 px-6 py-4 rounded mb-8">
            <h3 className="font-semibold mb-2">❌ Test Failed</h3>
            <p>{error}</p>
          </div>
        )}

        {/* Pool Discovery Results */}
        {discoveryResult && (
          <div className={`border rounded-lg p-6 mb-8 ${
            discoveryResult.found 
              ? 'bg-green-900 border-green-500 text-green-200' 
              : 'bg-yellow-900 border-yellow-500 text-yellow-200'
          }`}>
            <h3 className="text-xl font-semibold mb-4">
              {discoveryResult.found ? '✅ POOLS DISCOVERED!' : '⚠️ No Pools Found'}
            </h3>
            
            {discoveryResult.found ? (
              <div className="space-y-4">
                <div className="bg-green-800 p-3 rounded">
                  <p className="font-semibold text-green-100">
                    🎉 SUCCESS: Found {discoveryResult.poolCount} pools via local pools service!
                  </p>
                  <p className="text-green-200 text-sm mt-1">
                    Discovery time: {discoveryResult.discoveryTime}ms
                  </p>
                </div>
                
                <div className="space-y-3">
                  {discoveryResult.pools.map((pool: any, index: number) => (
                    <div key={pool.id} className="bg-green-800/50 p-4 rounded">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Pool #{index + 1} ({pool.type}):</strong>
                          <p className="font-mono break-all">{pool.id}</p>
                        </div>
                        <div>
                          <strong>Address:</strong>
                          <p className="font-mono break-all">{pool.address}</p>
                        </div>
                        <div>
                          <strong>Token 0:</strong>
                          <p className="font-mono break-all">{pool.token0.mint}</p>
                          <p className="text-xs">{pool.token0.symbol} (decimals: {pool.token0.decimals})</p>
                        </div>
                        <div>
                          <strong>Token 1:</strong>
                          <p className="font-mono break-all">{pool.token1.mint}</p>
                          <p className="text-xs">{pool.token1.symbol} (decimals: {pool.token1.decimals})</p>
                        </div>
                        {pool.liquidity && (
                          <div>
                            <strong>Liquidity:</strong>
                            <p>${parseFloat(pool.liquidity).toLocaleString()}</p>
                          </div>
                        )}
                        {pool.volume24h && (
                          <div>
                            <strong>24h Volume:</strong>
                            <p>${parseFloat(pool.volume24h).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p>{discoveryResult.message}</p>
                <p className="text-sm mt-2">Discovery Time: {discoveryResult.discoveryTime}ms</p>
              </div>
            )}
          </div>
        )}

        {/* Price Results */}
        {priceResult && (
          <div className={`border rounded-lg p-6 mb-8 ${
            priceResult.found 
              ? 'bg-blue-900 border-blue-500 text-blue-200' 
              : 'bg-yellow-900 border-yellow-500 text-yellow-200'
          }`}>
            <h3 className="text-xl font-semibold mb-4">
              {priceResult.found ? '💰 PRICE DISCOVERED!' : '⚠️ No Price Found'}
            </h3>
            
            {priceResult.found ? (
              <div className="space-y-3">
                <div className="bg-blue-800 p-3 rounded">
                  <p className="font-semibold text-blue-100">
                    🎉 SUCCESS: Price found via local pools service!
                  </p>
                  <p className="text-blue-200 text-sm mt-1">
                    Lookup time: {priceResult.lookupTime}ms
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Price:</strong>
                    <p className="text-2xl font-bold">{priceResult.price}</p>
                  </div>
                  <div>
                    <strong>Decimals:</strong>
                    <p>{priceResult.decimals}</p>
                  </div>
                  <div>
                    <strong>Pool ID:</strong>
                    <p className="font-mono break-all">{priceResult.poolId}</p>
                  </div>
                  <div>
                    <strong>Source:</strong>
                    <p className="font-semibold">{priceResult.source}</p>
                  </div>
                  <div>
                    <strong>Slot:</strong>
                    <p>{priceResult.slot}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p>{priceResult.message}</p>
                <p className="text-sm mt-2">Lookup Time: {priceResult.lookupTime}ms</p>
              </div>
            )}
          </div>
        )}

        {/* Live Console Logs */}
        <div className="bg-gray-900 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📜 Live API Logs</h2>
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
              <p className="text-gray-500">API logs will appear here during testing...</p>
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
          <h2 className="text-xl font-semibold mb-4">📖 Local Pools Service Approach</h2>
          <div className="text-gray-300 space-y-2">
            <p>🏊 <strong>Local API:</strong> Uses HTTP calls to a local pools service (http://127.0.0.1:3001)</p>
            <p>📡 <strong>Simple Endpoints:</strong> /pool/by-token-ids?token0=&#123;mint&#125; and /pool/by-id/&#123;poolId&#125;</p>
            <p>⚡ <strong>Fast Discovery:</strong> No complex RPC calls or account parsing needed</p>
            <p>🎯 <strong>Comprehensive:</strong> Service indexes all major DEXs (Raydium, Orca, Saber, etc.)</p>
            <p>💰 <strong>Live Prices:</strong> Gets real-time pool state including prices and liquidity</p>
            <p>🚀 <strong>No Rate Limits:</strong> Local service eliminates RPC rate limiting issues</p>
          </div>
        </div>
      </div>
    </div>
  );
} 