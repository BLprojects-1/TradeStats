// Test script to verify improved pagination in trading history
const { drpcClient } = require('./src/services/drpcClient');

// Test wallet with many transactions
const testWallet = '83astBRguLMdt2h5U1Tpdq5tjFoJ6noeGwaY3mDLVcri';

async function testPagination() {
  console.log('🧪 Testing improved pagination for trading history...');
  console.log(`📍 Testing wallet: ${testWallet}`);
  
  try {
    // Test 1: Fetch with default limit (should get 100)
    console.log('\n📊 Test 1: Default limit (100 transactions)');
    const result1 = await drpcClient.getTransactionsByWallet(testWallet);
    console.log(`✅ Fetched ${result1.transactions.length} transactions`);
    console.log(`🔗 Last signature: ${result1.lastSignature ? result1.lastSignature.substring(0, 8) + '...' : 'none'}`);
    
    // Test 2: Fetch next page using lastSignature
    if (result1.lastSignature && result1.transactions.length === 100) {
      console.log('\n📊 Test 2: Next page using pagination cursor');
      const result2 = await drpcClient.getTransactionsByWallet(testWallet, {
        before: result1.lastSignature,
        limit: 50
      });
      console.log(`✅ Fetched ${result2.transactions.length} more transactions`);
      console.log(`🔗 Last signature: ${result2.lastSignature ? result2.lastSignature.substring(0, 8) + '...' : 'none'}`);
      
      // Verify no duplicates
      const duplicates = result1.transactions.filter(tx1 => 
        result2.transactions.some(tx2 => tx1.signature === tx2.signature)
      );
      console.log(`🔍 Duplicate check: ${duplicates.length} duplicates found (should be 0)`);
    }
    
    // Test 3: Fetch with 24-hour filter
    console.log('\n📊 Test 3: Last 24 hours filter');
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const result3 = await drpcClient.getTransactionsByWallet(testWallet, {
      from: twentyFourHoursAgo,
      limit: 200
    });
    console.log(`✅ Fetched ${result3.transactions.length} transactions from last 24 hours`);
    
    if (result3.transactions.length > 0) {
      const oldestTx = result3.transactions[result3.transactions.length - 1];
      const oldestDate = new Date(oldestTx.timestamp);
      console.log(`📅 Oldest transaction: ${oldestDate.toISOString()}`);
      console.log(`⏰ Hours ago: ${Math.round((Date.now() - oldestTx.timestamp) / (1000 * 60 * 60))}`);
    }
    
    console.log('\n✅ Pagination test completed successfully!');
    console.log(`📈 Total unique transactions found: ${result3.transactions.length} (vs previous limit of 50)`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPagination(); 