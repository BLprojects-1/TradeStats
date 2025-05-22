const axios = require('axios');

// Test Jupiter API connections
async function testJupiterAPI() {
  try {
    console.log('Testing Jupiter API connections...');
    
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC token
    const solMint = 'So11111111111111111111111111111111111111112'; // SOL token
    
    // Test token info API
    console.log('1. Testing Jupiter token info API...');
    const tokenResponse = await axios.get('https://lite-api.jup.ag/tokens/v1/mints/tradable');
    
    if (!tokenResponse.data) {
      throw new Error('Invalid token list response from Jupiter API');
    }
    
    const usdcInfo = tokenResponse.data.find(token => token.address === usdcMint);
    const solInfo = tokenResponse.data.find(token => token.address === solMint);
    
    console.log('Jupiter Token Info Results:');
    console.log('- USDC Token:', {
      found: !!usdcInfo,
      symbol: usdcInfo?.symbol,
      name: usdcInfo?.name,
      decimals: usdcInfo?.decimals,
      logoURI: usdcInfo?.logoURI ? 'Available' : 'Not available'
    });
    
    console.log('- SOL Token:', {
      found: !!solInfo,
      symbol: solInfo?.symbol,
      name: solInfo?.name,
      decimals: solInfo?.decimals,
      logoURI: solInfo?.logoURI ? 'Available' : 'Not available'
    });
    
    // Test price API
    console.log('\n2. Testing Jupiter price API...');
    const priceResponse = await axios.get(`https://lite-api.jup.ag/price/v2`, {
      params: {
        ids: `${usdcMint},${solMint}`
      }
    });
    
    if (!priceResponse.data || !priceResponse.data.data) {
      throw new Error('Invalid price response from Jupiter API');
    }
    
    console.log('Jupiter Price API Results:');
    console.log('- USDC Price:', {
      price: priceResponse.data.data[usdcMint]?.price,
      type: priceResponse.data.data[usdcMint]?.type
    });
    
    console.log('- SOL Price:', {
      price: priceResponse.data.data[solMint]?.price,
      type: priceResponse.data.data[solMint]?.type
    });
    
    // Test price API with additional info
    console.log('\n3. Testing Jupiter price API with extra info...');
    const detailedPriceResponse = await axios.get(`https://lite-api.jup.ag/price/v2`, {
      params: {
        ids: solMint,
        showExtraInfo: true
      }
    });
    
    console.log('Jupiter Detailed Price Results:');
    console.log(JSON.stringify(detailedPriceResponse.data.data[solMint], null, 2));
    
    console.log('\nAll Jupiter API tests completed successfully!');
    return true;
  } catch (error) {
    console.error('Jupiter API test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Run the tests
testJupiterAPI();
