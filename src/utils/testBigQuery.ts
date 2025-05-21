import { queryWalletTransactions, testBigQueryAccess } from './bigquerySolana.js';

/**
 * Tests the BigQuery connection and wallet transaction querying
 * @param wallet - Test wallet address to query
 */
export const testBigQueryConnection = async (wallet: string) => {
  try {
    console.log('Testing BigQuery connection...');
    
    // Check environment variables
    console.log('Configuration check:');
    console.log('- GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID);
    console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    if (!process.env.GCP_PROJECT_ID || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('Environment variables not properly set');
    }
    
    // First test basic BigQuery access
    console.log('\nTesting basic BigQuery access...');
    const hasAccess = await testBigQueryAccess();
    if (!hasAccess) {
      throw new Error('Failed to access BigQuery. Please check your service account permissions.');
    }
    console.log('✅ Basic BigQuery access test passed');
    
    // Now try to get last 24 hours of transactions
    console.log('\nTesting Solana transaction query...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    console.log(`Querying transactions for wallet: ${wallet}`);
    console.log('Time range:', yesterday.toISOString(), 'to', new Date().toISOString());
    
    const transactions = await queryWalletTransactions(
      wallet,
      10, // limit to 10 transactions
      yesterday.toISOString().split('T')[0], // just the date part
      new Date().toISOString().split('T')[0] // just the date part
    );
    
    console.log('✅ Successfully queried BigQuery');
    console.log(`Found ${transactions.length} transactions`);
    
    if (transactions.length > 0) {
      console.log('\nSample transaction:');
      console.log('- Signature:', transactions[0].signature);
      console.log('- Block Time:', transactions[0].blockTime);
      console.log('- Slot:', transactions[0].slot);
      console.log('- Success:', transactions[0].success);
      console.log('- Fee (lamports):', transactions[0].fee);
      console.log('- Number of Instructions:', transactions[0].numInstructions);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error testing BigQuery connection:', error);
    return false;
  }
}; 