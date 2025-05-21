// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local file
const result = dotenv.config({ 
  path: path.resolve(process.cwd(), '.env.local'),
  override: true 
});

if (result.error) {
  console.error('Error loading .env.local file:', result.error);
  process.exit(1);
}

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GCP_PROJECT_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env.local file');
  process.exit(1);
}

console.log('Environment configuration:');
console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log('- GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID);

// Now import the rest of the modules
import { testBigQueryConnection } from '../src/utils/testBigQuery.js';

// Test wallet address - this should be a wallet with known transactions
const TEST_WALLET = 'LT42y5yGt13TJUR8iLBu3y37PPYAB32GzDhMCQvJvEX';

async function main() {
  console.log('\nStarting BigQuery test...');
  console.log('Using test wallet:', TEST_WALLET);
  
  const success = await testBigQueryConnection(TEST_WALLET);
  
  if (success) {
    console.log('\n✅ BigQuery test completed successfully');
    process.exit(0);
  } else {
    console.error('\n❌ BigQuery test failed');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 