const axios = require('axios');

async function testJupiterApi() {
  const priceApiBaseUrl = 'https://lite-api.jup.ag/price/v2';
  const tokenApiBaseUrl = 'https://lite-api.jup.ag/tokens/v1/token';

  try {
    // Test token info endpoint with USDC
    const usdcAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    console.log('Testing token info endpoint with USDC...');
    const tokenInfoResponse = await axios.get(`${tokenApiBaseUrl}/${usdcAddress}`, {
      headers: { 'Accept': 'application/json' }
    });
    console.log('Token Info Response:', JSON.stringify(tokenInfoResponse.data, null, 2));

    // Test price endpoint with USDC
    console.log('\nTesting price endpoint with USDC...');
    const priceResponse = await axios.get(priceApiBaseUrl, {
      params: {
        ids: usdcAddress,
        showExtraInfo: true
      },
      headers: { 'Accept': 'application/json' }
    });
    console.log('Price Info Response:', JSON.stringify(priceResponse.data, null, 2));

    // Test with SOL
    const solAddress = 'So11111111111111111111111111111111111111112';
    console.log('\nTesting token info endpoint with SOL...');
    const solTokenInfoResponse = await axios.get(`${tokenApiBaseUrl}/${solAddress}`, {
      headers: { 'Accept': 'application/json' }
    });
    console.log('SOL Token Info Response:', JSON.stringify(solTokenInfoResponse.data, null, 2));

    console.log('\nTesting price endpoint with SOL...');
    const solPriceResponse = await axios.get(priceApiBaseUrl, {
      params: {
        ids: solAddress,
        showExtraInfo: true
      },
      headers: { 'Accept': 'application/json' }
    });
    console.log('SOL Price Info Response:', JSON.stringify(solPriceResponse.data, null, 2));

  } catch (error) {
    console.error('Error testing Jupiter API:', error);
  }
}

testJupiterApi(); 