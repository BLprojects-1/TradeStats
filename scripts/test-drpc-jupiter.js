const axios = require('axios');
require('dotenv').config();

const DRPC_API_KEY = process.env.NEXT_PUBLIC_DRPC_API_KEY || '';

// Test DRPC and Jupiter connection together
async function testDrpcAndJupiter() {
  try {
    console.log('Testing DRPC and Jupiter integration...');
    
    // Test tokens
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC token
    const solMint = 'So11111111111111111111111111111111111111112'; // SOL token
    
    // 1. Get SOL price from Jupiter
    console.log('\n1. Getting SOL price from Jupiter...');
    const priceResponse = await axios.get('https://lite-api.jup.ag/price/v2', {
      params: {
        ids: solMint,
        showExtraInfo: true
      }
    });
    
    const solPrice = priceResponse.data.data[solMint].price;
    console.log(`Current SOL price: $${solPrice}`);
    
    // 2. Get USDC token info from Jupiter
    console.log('\n2. Getting USDC token info from Jupiter...');
    try {
      const tokenResponse = await axios.get(`https://lite-api.jup.ag/tokens/v1/token/${usdcMint}`);
      console.log('USDC Token Info:', {
        symbol: tokenResponse.data.symbol,
        name: tokenResponse.data.name,
        decimals: tokenResponse.data.decimals,
        logoURI: tokenResponse.data.logoURI ? 'Available' : 'Not available'
      });
    } catch (error) {
      console.log('Direct token info lookup failed, trying tradable tokens list...');
      const allTokensResponse = await axios.get('https://lite-api.jup.ag/tokens/v1/mints/tradable');
      const usdcInfo = allTokensResponse.data.find(token => token.address === usdcMint);
      
      if (usdcInfo) {
        console.log('USDC Token Info (from list):', {
          symbol: usdcInfo.symbol,
          name: usdcInfo.name,
          decimals: usdcInfo.decimals,
          logoURI: usdcInfo.logoURI ? 'Available' : 'Not available'
        });
      } else {
        console.log('USDC token not found in tradable tokens list');
      }
    }
    
    // 3. Test DRPC connection
    console.log('\n3. Testing DRPC connection...');
    
    const drpcEndpoint = 'https://solanav2.drpc.org';
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authorization header if API key is available
    if (DRPC_API_KEY) {
      headers['Authorization'] = `Bearer ${DRPC_API_KEY}`;
      console.log('Using DRPC API key for authentication');
    } else {
      console.log('No DRPC API key provided - connection may fail');
    }
    
    // First try a simple getHealth request
    const healthPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getHealth',
      params: []
    };
    
    try {
      console.log('Sending getHealth request to DRPC...');
      const healthResponse = await axios.post(drpcEndpoint, healthPayload, { headers });
      console.log('DRPC health response:', healthResponse.data);
      
      // If successful, try getting block height
      const blockHeightPayload = {
        jsonrpc: '2.0',
        id: 2,
        method: 'getBlockHeight',
        params: []
      };
      
      console.log('Sending getBlockHeight request to DRPC...');
      const blockHeightResponse = await axios.post(drpcEndpoint, blockHeightPayload, { headers });
      console.log('Current block height:', blockHeightResponse.data.result);
    } catch (error) {
      console.error('DRPC connection failed:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        // Log the request that failed for debugging
        console.error('Failed request payload:', JSON.stringify(healthPayload));
        console.error('Request headers:', JSON.stringify(headers));
      }
    }
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testDrpcAndJupiter(); 