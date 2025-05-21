import { queryWalletTransactions } from './bigquerySolana';

async function testWalletQuery() {
  const walletAddress = 'LT42y5yGt13TJUR8iLBu3y37PPYAB32GzDhMCQvJvEX';
  
  console.log(`\nQuerying transactions for wallet: ${walletAddress}`);
  console.log('Fetching last 5 transactions from the past week...\n');
  
  try {
    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    // Get date for 7 days ago
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const transactions = await queryWalletTransactions(
      walletAddress,
      5, // limit to 5 transactions
      formatDate(startDate), // from 7 days ago
      formatDate(new Date()) // to now
    );
    
    console.log(`Found ${transactions.length} transactions:`);
    transactions.forEach((tx, index) => {
      console.log(`\nTransaction ${index + 1}:`);
      console.log(`- Signature: ${tx.signature}`);
      console.log(`- Time: ${tx.blockTime}`);
      console.log(`- Slot: ${tx.slot}`);
      console.log(`- Success: ${tx.success}`);
      console.log(`- Fee: ${tx.fee} lamports`);
      console.log(`- Instructions: ${tx.numInstructions}`);
    });
  } catch (error) {
    console.error('Error querying wallet transactions:', error);
  }
}

testWalletQuery(); 