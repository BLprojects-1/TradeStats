// Initialize the Helius API client for Solana
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
const HELIUS_RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || '';

interface TransactionHistoryParams {
  address: string;
  until?: string;  // ISO timestamp to fetch transactions until
  before?: string; // Transaction signature to fetch transactions before (for pagination)
  limit?: number;  // Number of transactions to fetch per request
}

/**
 * Fetches complete transaction history for a given wallet address with pagination
 * 
 * @param walletAddress The Solana wallet address
 * @returns Transaction history array
 */
export const fetchTransactionHistory = async (walletAddress: string) => {
  const allTransactions = [];
  let hasMore = true;
  let lastSignature: string | undefined;
  const BATCH_SIZE = 100; // Maximum number of transactions per request

  console.log('Starting to fetch transaction history for wallet:', walletAddress);

  try {
    while (hasMore) {
      const params: TransactionHistoryParams = {
        address: walletAddress,
        limit: BATCH_SIZE
      };

      // Add pagination parameter if we have a last signature
      if (lastSignature) {
        params.before = lastSignature;
      }

      console.log('Fetching transaction batch with params:', params);

      const response = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'my-id',
          method: 'getTransactionHistory',
          params: params,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.result || !Array.isArray(data.result)) {
        console.error('Unexpected API response format:', data);
        throw new Error('Invalid API response format');
      }

      const transactions = data.result;
      console.log(`Received ${transactions.length} transactions in this batch`);

      // Add transactions to our collection
      allTransactions.push(...transactions);

      // Check if we should continue pagination
      if (transactions.length < BATCH_SIZE) {
        hasMore = false;
        console.log('No more transactions to fetch');
      } else {
        // Get the last transaction's signature for pagination
        lastSignature = transactions[transactions.length - 1].signature;
        console.log('Will fetch more transactions before signature:', lastSignature);
      }
    }

    console.log(`Successfully fetched ${allTransactions.length} total transactions`);
    return allTransactions;

  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw error; // Propagate the error instead of returning empty array
  }
};

/**
 * Fetches current open trades/positions for a wallet
 * 
 * @param walletAddress The Solana wallet address
 * @returns Open positions array
 */
export const fetchOpenTrades = async (walletAddress: string) => {
  throw new Error('fetchOpenTrades must be implemented using real Helius API data');
};

/**
 * Utility to calculate profit/loss from transaction history
 * 
 * @param transactions Array of transactions
 * @returns Calculated profit/loss information
 */
export const calculateProfitLoss = (transactions: any[]) => {
  // Implement calculation logic here
  return {
    totalProfit: 0,
    totalLoss: 0,
    netProfitLoss: 0,
  };
};
