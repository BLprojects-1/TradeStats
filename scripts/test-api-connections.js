const axios = require('axios');

async function testDrpcConnection() {
  console.log('Testing DRPC connection...');
  
  const drpcApiKey = process.env.NEXT_PUBLIC_DRPC_API_KEY || '';
  const testWallet = '9YbZpnB5AqY9PzHHC4s8vQgQjD3dacx6SYNd88qbev9p'; // Example wallet
  
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getSignaturesForAddress',
    params: [
      testWallet,
      {
        limit: 1
      }
    ]
  };
  
  try {
    const response = await axios.post('https://solanav2.drpc.org', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${drpcApiKey}`
      }
    });
    
    console.log('DRPC Test Result:', {
      success: true,
      signatures: response.data.result ? response.data.result.length : 0
    });
    return true;
  } catch (error) {
    console.error('DRPC Test Failed:', error.message);
    return false;
  }
}

async function testJupiterConnection() {
  console.log('Testing Jupiter API connections...');
  
  const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC token
  const solMint = 'So11111111111111111111111111111111111111112'; // SOL token
  
  try {
    // Test token info API
    console.log('Testing Jupiter token info API...');
    const tokenResponse = await axios.get('https://token.jup.ag/all', {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!tokenResponse.data || !Array.isArray(tokenResponse.data)) {
      throw new Error('Invalid token list response from Jupiter API');
    }
    
    const usdcInfo = tokenResponse.data.find(token => token.address === usdcMint);
    const solInfo = tokenResponse.data.find(token => token.address === solMint);
    
    console.log('Jupiter Token Info Test:', {
      success: true,
      usdcFound: !!usdcInfo,
      solFound: !!solInfo,
      usdcSymbol: usdcInfo?.symbol,
      solSymbol: solInfo?.symbol
    });
    
    // Test price API
    console.log('Testing Jupiter price API...');
    const priceResponse = await axios.get(`https://price.jup.ag/v4`, {
      params: {
        ids: `${usdcMint},${solMint}`,
        showExtraInfo: true
      },
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!priceResponse.data || !priceResponse.data.data) {
      throw new Error('Invalid price response from Jupiter API');
    }
    
    console.log('Jupiter Price API Test:', {
      success: true,
      usdcPrice: priceResponse.data.data[usdcMint]?.price,
      solPrice: priceResponse.data.data[solMint]?.price
    });
    
    return true;
  } catch (error) {
    console.error('Jupiter Test Failed:', error.message);
    return false;
  }
}

async function runTests() {
  try {
    const drpcSuccess = await testDrpcConnection();
    const jupiterSuccess = await testJupiterConnection();
    
    console.log('All Tests Completed:', {
      allSuccessful: drpcSuccess && jupiterSuccess,
      drpcSuccess,
      jupiterSuccess
    });
  } catch (error) {
    console.error('Test Runner Failed:', error.message);
  }
}

runTests(); 