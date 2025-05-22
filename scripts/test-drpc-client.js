const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
require('dotenv').config();

// Mock implementation of our drpcClient for testing
class DrpcClient {
  constructor() {
    this.endpoints = {
      primary: 'https://solanav2.drpc.org',
      fallbacks: [
        'https://api.mainnet-beta.solana.com' // Solana's public RPC as fallback
      ]
    };
    
    this.API_KEYS = {
      DRPC: process.env.NEXT_PUBLIC_DRPC_API_KEY || '',
    };
    
    console.log(`DRPC API Key available: ${!!this.API_KEYS.DRPC}`);
  }
  
  async makeRequest(endpoint, payload) {
    const axios = require('axios');
    
    // Ensure payload follows the JSON-RPC 2.0 standard
    if (!payload.jsonrpc) {
      payload.jsonrpc = '2.0';
    }
    
    if (!payload.id) {
      payload.id = Date.now();
    }
    
    const config = {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Add API key to the headers for DRPC endpoint
    if (endpoint.includes('drpc.org') && this.API_KEYS.DRPC) {
      config.headers['Authorization'] = `Bearer ${this.API_KEYS.DRPC}`;
      console.log(`Using API key for DRPC endpoint: ${endpoint}`);
    } else if (endpoint.includes('drpc.org') && !this.API_KEYS.DRPC) {
      console.log(`Warning: No API key provided for DRPC endpoint: ${endpoint}`);
      // Fallback to a public endpoint if no API key
      return this.makeRequest(this.endpoints.fallbacks[0], payload);
    }
    
    try {
      console.log(`Sending request to ${endpoint}:`, JSON.stringify(payload));
      const response = await axios.post(endpoint, payload, config);
      
      // Check for RPC-specific error responses
      if (response.data?.error) {
        throw new Error(`RPC Error: ${response.data.error.message || 'Unknown RPC error'}`);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Request failed for endpoint ${endpoint}:`, error.message);
      
      // If this is the primary endpoint and it failed, try the fallback
      if (endpoint === this.endpoints.primary) {
        console.log('Trying fallback endpoint...');
        return this.makeRequest(this.endpoints.fallbacks[0], payload);
      }
      
      throw error;
    }
  }
  
  async getBalance(publicKey) {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [publicKey]
    };
    
    try {
      const response = await this.makeRequest(this.endpoints.primary, payload);
      return response.result;
    } catch (error) {
      console.error('Error getting balance:', error.message);
      throw error;
    }
  }
  
  async getBlockHeight() {
    const payload = {
      jsonrpc: '2.0',
      id: 2,
      method: 'getBlockHeight',
      params: []
    };
    
    try {
      const response = await this.makeRequest(this.endpoints.primary, payload);
      return response.result;
    } catch (error) {
      console.error('Error getting block height:', error.message);
      throw error;
    }
  }
}

async function testDrpcClient() {
  try {
    console.log('Testing DRPC client with fallback capability...');
    
    const client = new DrpcClient();
    
    // Test getBlockHeight
    console.log('\n1. Testing getBlockHeight()...');
    const blockHeight = await client.getBlockHeight();
    console.log(`Current block height: ${blockHeight}`);
    
    // Test getBalance - use a known wallet
    console.log('\n2. Testing getBalance()...');
    const testWalletAddress = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
    const balance = await client.getBalance(testWalletAddress);
    console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testDrpcClient(); 