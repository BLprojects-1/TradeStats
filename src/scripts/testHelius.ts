import { testHeliusConnection } from '../utils/heliusTest';

const runTest = async () => {
  console.log('Testing Helius connection...');
  const result = await testHeliusConnection();
  if (result) {
    console.log('All tests passed successfully!');
  } else {
    console.log('Some tests failed. Please check the errors above.');
  }
};

runTest().catch(console.error); 