// Simple test script for DRPC transaction fetch with public endpoints
import axios from 'axios';

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

// Test transaction fetching with public endpoints
async function testPublicEndpoints() {
  console.log('Testing public Solana RPC endpoints...');
  
  // Public endpoints to test
  const endpoints = [
    'https://api.mainnet-beta.solana.com',      // Solana's public RPC
    'https://solana-api.projectserum.com',      // Project Serum public RPC
    'https://solana.public-rpc.com'             // Another public RPC
  ];
  
  // Basic JSON-RPC payload for getSlot (simple method that should always work)
  const slotPayload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getSlot',
    params: []
  };
  
  const config = {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000
  };
  
  // Test each endpoint for basic connectivity
  console.log('\nTesting basic connectivity:');
  for (const endpoint of endpoints) {
    try {
      console.log(`\nConnecting to ${endpoint}...`);
      
      const response = await axios.post<RpcResponse>(endpoint, slotPayload, config);
      
      if (response.data?.result) {
        console.log('✅ Connection successful!');
        console.log('Current slot:', response.data.result);
        
        // Now try a known transaction signature
        const signature = 'KAobkZLTAioqMk4VhWUn6sfm9RpDpqKsw5sHWU93Fu25sBqpT3DKK16mr2JApMt1c47JzE5njZhwcqybFPCRpWk';
        console.log(`Testing getTransaction with signature: ${signature.substring(0, 10)}...`);
        
        const txPayload = {
          jsonrpc: '2.0',
          id: 2,
          method: 'getTransaction',
          params: [
            signature,
            {
              encoding: 'jsonParsed',
              maxSupportedTransactionVersion: 0
            }
          ]
        };
        
        try {
          const txResponse = await axios.post<RpcResponse>(endpoint, txPayload, config);
          
          if (txResponse.data?.result) {
            console.log('✅ Transaction fetch successful!');
          } else if (txResponse.data?.error) {
            console.error('❌ RPC Error:', txResponse.data.error);
          } else {
            console.error('❌ Unexpected response:', txResponse.data);
          }
        } catch (txError: any) {
          console.error('❌ Transaction fetch failed:');
          console.error('  Status:', txError.response?.status);
          console.error('  Message:', txError.message);
        }
      } else if (response.data?.error) {
        console.error('❌ RPC Error:', response.data.error);
      } else {
        console.error('❌ Unexpected response:', response.data);
      }
    } catch (error: any) {
      console.error(`❌ Error with ${endpoint}:`);
      if (error.response) {
        console.error('  Status:', error.response.status);
        console.error('  Data:', JSON.stringify(error.response.data || {}).substring(0, 200));
      } else {
        console.error('  Message:', error.message);
      }
    }
  }
  
  console.log('\nTest completed!');
}

testPublicEndpoints(); 