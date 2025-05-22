import { jupiterApiService } from './src/services/jupiterApiService';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function testJupiterApi() {
    console.log('Starting Jupiter API connectivity test...\n');

    try {
        // Test 1: Get SOL token info
        console.log('Test 1: Fetching SOL token info...');
        const solMint = 'So11111111111111111111111111111111111111112';
        try {
            const solInfo = await jupiterApiService.getTokenInfo(solMint);
            console.log('SOL Token Info:', {
                name: solInfo.name,
                symbol: solInfo.symbol,
                decimals: solInfo.decimals,
                address: solInfo.address
            });
            console.log('✅ Token info test passed!\n');
        } catch (error) {
            console.error('❌ SOL token info test failed:', error instanceof Error ? error.message : String(error));
        }

        // Add delay between requests
        await delay(2000);

        // Test 2: Get SOL price
        console.log('Test 2: Fetching SOL price...');
        try {
            const solPrice = await jupiterApiService.getTokenPriceInUSD(solMint);
            console.log('SOL Price (USD):', solPrice);
            console.log('✅ Price fetch test passed!\n');
        } catch (error) {
            console.error('❌ SOL price test failed:', error instanceof Error ? error.message : String(error));
        }

        // Add delay between requests
        await delay(2000);

        // Test 3: Get USDC token info and price
        console.log('Test 3: Fetching USDC info and price...');
        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        try {
            const usdcInfo = await jupiterApiService.getTokenInfo(usdcMint);
            const usdcPrice = await jupiterApiService.getTokenPriceInUSD(usdcMint);
            console.log('USDC Info:', {
                name: usdcInfo.name,
                symbol: usdcInfo.symbol,
                decimals: usdcInfo.decimals,
                price: usdcPrice
            });
            console.log('✅ USDC test passed!\n');
        } catch (error) {
            console.error('❌ USDC test failed:', error instanceof Error ? error.message : String(error));
        }

        console.log('🎉 Test suite completed!');
    } catch (error) {
        console.error('❌ Test suite failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

testJupiterApi(); 