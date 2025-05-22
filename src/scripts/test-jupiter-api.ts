import { jupiterApiService } from '../services/jupiterApiService';

async function testJupiterApi() {
  try {
    // Test token info endpoint with USDC
    const usdcAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    console.log('Testing token info endpoint with USDC...');
    const tokenInfo = await jupiterApiService.getTokenInfo(usdcAddress);
    console.log('Token Info Response:', JSON.stringify(tokenInfo, null, 2));

    // Test price endpoint with USDC
    console.log('\nTesting price endpoint with USDC...');
    const priceInfo = await jupiterApiService.getTokenPrice(usdcAddress);
    console.log('Price Info Response:', JSON.stringify(priceInfo, null, 2));

    // Test with SOL
    const solAddress = 'So11111111111111111111111111111111111111112';
    console.log('\nTesting token info endpoint with SOL...');
    const solTokenInfo = await jupiterApiService.getTokenInfo(solAddress);
    console.log('SOL Token Info Response:', JSON.stringify(solTokenInfo, null, 2));

    console.log('\nTesting price endpoint with SOL...');
    const solPriceInfo = await jupiterApiService.getTokenPrice(solAddress);
    console.log('SOL Price Info Response:', JSON.stringify(solPriceInfo, null, 2));

  } catch (error) {
    console.error('Error testing Jupiter API:', error);
  }
}

testJupiterApi(); 