const { comprehensivePoolDiscovery } = require('./src/services/comprehensivePoolDiscovery.ts');

// Simple test to see if we can discover pools for our target token
async function testDirectDiscovery() {
  const targetToken = 'EdfRrkHUkzg1LM3qf8titmZrYrdMLhLwHyHqRSGtdcXH';
  
  console.log('🎯 Testing direct pool discovery...');
  console.log(`Target token: ${targetToken}`);
  
  try {
    const startTime = Date.now();
    const pool = await comprehensivePoolDiscovery.getBestPool(targetToken);
    const endTime = Date.now();
    
    console.log(`⏱️ Discovery took ${endTime - startTime}ms`);
    
    if (pool) {
      console.log('✅ Pool found!');
      console.log(`  Address: ${pool.address.toString()}`);
      console.log(`  Source: ${pool.source}`);
      console.log(`  Token A: ${pool.tokenA.toString()}`);
      console.log(`  Token B: ${pool.tokenB.toString()}`);
    } else {
      console.log('❌ No pool found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectDiscovery().catch(console.error); 