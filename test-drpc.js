// Simple test script for DrpcClient
const { drpcClient } = require('./src/services/drpcClient');

// A known active Solana wallet address to test with
const testWallet = '83astBRguLMdt2h5U1Tpdq5tjFoJ6noeGwaY3mDLVcri';

async function testDrpcClient() {
  console.log('Testing DrpcClient...');
  console.log('Fetching transactions for wallet:', testWallet);
  
  try {
    const result = await drpcClient.getTransactions(testWallet, 3);
    
    console.log(`Successfully fetched ${result.transactions.length} transactions`);
    console.log('Last signature:', result.lastSignature);
    
    if (result.transactions.length > 0) {
      console.log('\nFirst transaction details:');
      console.log('- Signature:', result.transactions[0].signature);
      console.log('- Type:', result.transactions[0].type);
      console.log('- Status:', result.transactions[0].status);
      console.log('- Timestamp:', new Date(result.transactions[0].timestamp).toISOString());
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing DrpcClient:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testDrpcClient(); 