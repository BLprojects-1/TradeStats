import * as dotenv from 'dotenv';
import * as path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export const testHeliusConnection = async () => {
  try {
    console.log('Using Helius API Key:', HELIUS_API_KEY);
    const connection = new Connection(HELIUS_RPC_URL);
    
    // Test 1: Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    console.log('✅ Successfully connected to Helius RPC');
    console.log('Latest blockhash:', blockhash);

    // Test 2: Get SOL price
    const response = await fetch('https://api.helius.xyz/v0/token-metadata?api-key=' + HELIUS_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mintAccounts: ['So11111111111111111111111111111111111111112'],
      }),
    });
    
    const data = await response.json();
    console.log('✅ Successfully fetched SOL metadata');
    console.log('SOL metadata:', data);

    return true;
  } catch (error) {
    console.error('❌ Error testing Helius connection:', error);
    return false;
  }
}; 