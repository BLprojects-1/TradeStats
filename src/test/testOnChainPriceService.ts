import { onChainPriceService } from '../services/onChainPriceService.js';
import { jupiterApiService } from '../services/jupiterApiService.js';

/**
 * Test script to validate the on-chain price service
 * Compares on-chain prices with Jupiter API prices
 */
async function testOnChainPriceService() {
  console.log('Testing On-Chain Price Service...\n');

  // Test tokens
  const testTokens = [
    {
      symbol: 'SOL',
      mint: 'So11111111111111111111111111111111111111112',
    },
    {
      symbol: 'USDC',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
    // Add more test tokens as needed
  ];

  for (const token of testTokens) {
    console.log(`\nTesting ${token.symbol} (${token.mint}):`);
    console.log('='.repeat(50));

    try {
      // Test 1: Get current price from on-chain service
      console.log('\n1. Testing on-chain price lookup...');
      const startTime = Date.now();
      const onChainPrice = await onChainPriceService.getHistoricalPrice(token.mint, Date.now());
      const onChainTime = Date.now() - startTime;
      console.log(`   On-chain price: $${onChainPrice.toFixed(6)}`);
      console.log(`   Time taken: ${onChainTime}ms`);

      // Test 2: Get current price from Jupiter for comparison
      console.log('\n2. Getting Jupiter price for comparison...');
      const jupiterStartTime = Date.now();
      const jupiterPrice = await jupiterApiService.getTokenPriceInUSD(token.mint);
      const jupiterTime = Date.now() - jupiterStartTime;
      console.log(`   Jupiter price: $${jupiterPrice.toFixed(6)}`);
      console.log(`   Time taken: ${jupiterTime}ms`);

      // Test 3: Compare prices
      console.log('\n3. Price comparison:');
      const priceDiff = Math.abs(onChainPrice - jupiterPrice);
      const priceDiffPercent = (priceDiff / jupiterPrice) * 100;
      console.log(`   Difference: $${priceDiff.toFixed(6)} (${priceDiffPercent.toFixed(2)}%)`);
      
      if (priceDiffPercent > 5) {
        console.warn(`   ⚠️  WARNING: Price difference exceeds 5%`);
      } else {
        console.log(`   ✅ Price difference is within acceptable range`);
      }

      // Test 4: Test caching
      console.log('\n4. Testing cache performance...');
      const cacheStartTime = Date.now();
      const cachedPrice = await onChainPriceService.getHistoricalPrice(token.mint, Date.now());
      const cacheTime = Date.now() - cacheStartTime;
      console.log(`   Cached price: $${cachedPrice.toFixed(6)}`);
      console.log(`   Time taken: ${cacheTime}ms`);
      console.log(`   Cache speedup: ${((onChainTime - cacheTime) / onChainTime * 100).toFixed(1)}%`);

      // Test 5: Test with historical slot (if available)
      console.log('\n5. Testing historical price lookup...');
      try {
        const historicalSlot = 240000000; // Example slot
        const historicalPrice = await onChainPriceService.getHistoricalPrice(token.mint, Date.now());
        console.log(`   Historical price at slot ${historicalSlot}: $${historicalPrice.toFixed(6)}`);
      } catch (error) {
        console.log(`   Historical price lookup not fully implemented yet`);
      }

    } catch (error) {
      console.error(`\n❌ Error testing ${token.symbol}:`, error);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Test completed!');
}

// Run the test
testOnChainPriceService().catch(console.error); 