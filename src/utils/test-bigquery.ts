import { testBigQueryAccess } from './bigquerySolana';

async function runTest() {
  console.log('Testing BigQuery Access...');
  try {
    const success = await testBigQueryAccess();
    console.log('\nTest completed:', success ? 'SUCCESS ✅' : 'FAILED ❌');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

runTest(); 