import * as dotenv from 'dotenv';
import { config } from 'dotenv';
import * as path from 'path';
import axios from 'axios';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const API_KEY = process.env.HELIUS_API_KEY!;
if (!API_KEY) throw new Error('Missing HELIUS_API_KEY in env');

export interface TransactionDetail {
  txSignature: string;
  solSpent: number;            // in SOL
  tokenAmount: number;         // token units
  tokenAddress: string;        // mint address
  tokenSymbol: string;         // e.g. "USDC"
  timestamp: string;           // ISO string
}

interface HeliusResponse {
  jsonrpc: string;
  id: string;
  result: any;
  error?: {
    message: string;
  };
}

// Helper function to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// fetch recent transactions from Helius
export async function fetchRawTransactions(
  wallet: string,
  limit = 50
): Promise<any[]> {
  try {
    // Get signatures first
    const sigResp = await axios.post<HeliusResponse>(HELIUS_RPC_URL, {
      jsonrpc: "2.0",
      id: "my-id",
      method: "getSignaturesForAddress",
      params: [wallet, { limit }]
    });

    if (sigResp.data.error) {
      throw new Error(`Helius API error: ${sigResp.data.error.message}`);
    }

    const signatures = sigResp.data.result.map((tx: any) => tx.signature);
    const transactions = [];

    // Process signatures in smaller batches
    const batchSize = 5;
    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(signatures.length / batchSize)}`);

      for (const sig of batch) {
        try {
          const txResp = await axios.post<HeliusResponse>(HELIUS_RPC_URL, {
            jsonrpc: "2.0",
            id: "my-id",
            method: "getTransaction",
            params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]
          });
          
          if (txResp.data.result) {
            transactions.push(txResp.data.result);
          }
        } catch (error: any) {
          if (error?.response?.status === 429) {
            console.log('Rate limited, waiting 1 second...');
            await delay(1000);
            i -= batchSize; // Retry this batch
            break;
          }
          console.error(`Error fetching transaction ${sig}:`, error.message);
        }
        
        // Add small delay between requests
        await delay(200);
      }
    }

    return transactions;
  } catch (error: any) {
    console.error('Error fetching transactions:', error.message);
    throw error;
  }
}

// parse out the details we care about
export function extractTransactionDetails(
  wallet: string,
  rawTxs: any[]
): TransactionDetail[] {
  console.log(`Processing ${rawTxs.length} transactions`);
  
  return rawTxs.map((tx) => {
    if (!tx) {
      console.log('Skipping null transaction');
      return null;
    }

    console.log(`Processing transaction: ${tx.transaction?.signatures?.[0]}`);

    const sig = tx.transaction?.signatures?.[0] ?? '';
    const timestamp = new Date(tx.blockTime * 1000).toISOString();

    // Track all token balance changes for the wallet
    const walletTokenChanges = new Map<string, number>();
    const walletSolChange = { amount: 0 };

    // Process all token balance changes
    tx.meta?.postTokenBalances?.forEach((post: any) => {
      const pre = tx.meta.preTokenBalances.find((pre: any) => pre.accountIndex === post.accountIndex);
      if (!pre) return;

      const accountKey = tx.transaction.message.accountKeys[post.accountIndex];
      if (accountKey !== wallet) return;

      const amount = (post.uiTokenAmount.uiAmount ?? 0) - (pre.uiTokenAmount.uiAmount ?? 0);
      console.log(`Token change for ${post.mint}: ${amount}`);
      walletTokenChanges.set(post.mint, (walletTokenChanges.get(post.mint) ?? 0) + amount);
    });

    // Process SOL balance changes
    tx.meta?.postBalances?.forEach((post: number, index: number) => {
      const pre = tx.meta.preBalances[index];
      const accountKey = tx.transaction.message.accountKeys[index];
      if (accountKey === wallet) {
        const change = (post - pre) / 1e9;
        walletSolChange.amount += change;
        console.log(`SOL change: ${change}`);
      }
    });

    // Find token received (positive token changes)
    const tokenReceived = Array.from(walletTokenChanges.entries())
      .filter(([mint, amount]) => amount > 0 && mint !== 'So11111111111111111111111111111111111111112')
      .sort((a, b) => b[1] - a[1])[0];

    // Find token spent (negative token changes or SOL spent)
    const tokenSpent = Array.from(walletTokenChanges.entries())
      .filter(([mint, amount]) => amount < 0)
      .sort((a, b) => a[1] - b[1])[0];

    const solSpent = Math.abs(Math.min(0, walletSolChange.amount));

    if (!tokenReceived && solSpent === 0) {
      console.log('No tokens received or SOL spent in this transaction');
      return null;
    }

    if (tokenReceived) {
      console.log(`Found trade: Received ${tokenReceived[1]} of ${tokenReceived[0]}`);
      if (tokenSpent) {
        console.log(`Spent ${Math.abs(tokenSpent[1])} of ${tokenSpent[0]}`);
      }
      if (solSpent > 0) {
        console.log(`Spent ${solSpent} SOL`);
      }
    }

    return tokenReceived ? {
      txSignature: sig,
      solSpent: solSpent || (tokenSpent ? Math.abs(tokenSpent[1]) : 0),
      tokenAmount: tokenReceived[1],
      tokenAddress: tokenReceived[0],
      tokenSymbol: 'Unknown', // We'll need to fetch this separately
      timestamp
    } : null;
  }).filter(Boolean) as TransactionDetail[];
}

// high-level helper to get recent trade details
export async function fetchTopTrades(
  wallet: string,
  limit = 20
): Promise<TransactionDetail[]> {
  // 1. Fetch raw transactions
  const raw = await fetchRawTransactions(wallet, limit * 2);

  // 2. Extract structured details
  const details = extractTransactionDetails(wallet, raw);

  // 3. Sort by solSpent descending (or your own profit metric)
  return details
    .sort((a, b) => b.solSpent - a.solSpent)
    .slice(0, limit);
}

// Test the script with a sample wallet
const testWallet = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

async function runTest() {
  try {
    console.log("Fetching top trades...");
    const trades = await fetchTopTrades(testWallet);
    console.log("Top trades:", JSON.stringify(trades, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

runTest();

