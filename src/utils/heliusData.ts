import * as dotenv from 'dotenv';
import * as path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const connection = new Connection(HELIUS_RPC_URL);

// Define types for our data structures
export interface TokenData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI?: string;
  totalBought: number;
  totalSold: number;
  remaining: number;
  currentPrice?: number;
  totalValue?: number;
}

export interface TradeData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI?: string;
  totalBought: number;  // Total amount bought in token units
  totalSold: number;    // Total amount sold in token units
  profitLoss: number;   // Profit/loss in SOL
  duration: string;
  firstBuyTimestamp?: number;
  lastSellTimestamp?: number;
  profitLossInSol?: number; // Explicitly track profit/loss in SOL
  avgBuyPrice?: number;    // Average buy price in SOL
  avgSellPrice?: number;   // Average sell price in SOL
}

// Interface for Helius transactions
interface HeliusTransaction {
  type: string;
  timestamp: number;
  fee: number;
  status: string;
  signature: string;
  tokenTransfers: TokenTransfer[];
  nativeTransfers: NativeTransfer[];
  accountData: AccountData[];
  source: string;
  description: string;
}

interface TokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard: string;
}

interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

interface AccountData {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: TokenBalanceChange[];
}

interface TokenBalanceChange {
  userAccount: string;
  tokenAccount: string;
  mint: string;
  rawTokenAmount: {
    tokenAmount: string;
    decimals: number;
  };
}

// Interface for storing trade data
interface TradeMapEntry {
  buys: Array<{ amount: number, solValue: number, timestamp: number }>;
  sells: Array<{ amount: number, solValue: number, timestamp: number }>;
  token: {
    address: string;
    symbol: string;
    name: string;
    logo: string;
  };
}

// Function to fetch wallet data for open trades
export const fetchWalletData = async (walletAddress: string): Promise<TokenData[]> => {
  try {
    console.log(`Fetching wallet data for address: ${walletAddress}`);
    
    // 1. Fetch tokens held in the wallet
    const balancesUrl = `https://api.helius.xyz/v0/addresses/${walletAddress}/balances?api-key=${HELIUS_API_KEY}`;
    console.log(`Fetching from: ${balancesUrl}`);
    const tokensResponse = await fetch(balancesUrl);
    const tokensData = await tokensResponse.json();
    
    // 2. Fetch transaction history to calculate bought/sold amounts
    const transactionsUrl = `https://api.helius.xyz/v1/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=100`;
    console.log(`Fetching from: ${transactionsUrl}`);
    const txResponse = await fetch(transactionsUrl);
    const txData = await txResponse.json();

    console.log(`Retrieved ${txData.length} transactions`);
    
    // Process the data to get bought/sold amounts
    const processedData: TokenData[] = await processTokenData(tokensData, txData, walletAddress);
    console.log(`Processed ${processedData.length} tokens for wallet`);
    
    return processedData;
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    throw error;
  }
};

// Function to fetch top trades
export const fetchTopTrades = async (walletAddress: string): Promise<TradeData[]> => {
  try {
    console.log(`Fetching top trades for address: ${walletAddress}`);
    
    // Use the correct enhanced transactions API with SWAP type filter
    const baseUrl = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP`;
    console.log(`Fetching swap transactions from: ${baseUrl}`);
    
    // Get first batch of transactions
    const response = await fetch(baseUrl);
    let transactions = await response.json();
    
    // Check if we received an error response
    if (!Array.isArray(transactions)) {
      if (transactions && transactions.error) {
        console.error('API Error:', transactions.error);
        return [];
      }
      console.error('Unexpected API response format:', transactions);
      return [];
    }
    
    console.log(`Retrieved initial batch of ${transactions.length} swap transactions`);
    
    // Try to get more data with pagination if available (up to 3 pages)
    let allTransactions = [...transactions];
    let pagesRetrieved = 1;
    const MAX_PAGES = 3;
    
    while (transactions.length > 0 && pagesRetrieved < MAX_PAGES) {
      // Get the oldest transaction signature for pagination
      const oldestTx = transactions[transactions.length - 1];
      if (!oldestTx || !oldestTx.signature) break;
      
      // Add delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const paginationUrl = `${baseUrl}&before=${oldestTx.signature}`;
        console.log(`Fetching additional transactions before: ${oldestTx.signature.slice(0, 8)}...`);
        
        const nextPageResponse = await fetch(paginationUrl);
        const nextPageData = await nextPageResponse.json();
        
        if (!Array.isArray(nextPageData)) {
          console.log('Pagination ended - received:', nextPageData);
          break;
        }
        
        console.log(`Retrieved additional ${nextPageData.length} transactions`);
        
        // Add new transactions to our collection
        if (nextPageData.length > 0) {
          allTransactions = [...allTransactions, ...nextPageData];
          transactions = nextPageData;
          pagesRetrieved++;
        } else {
          break; // No more transactions
        }
      } catch (error: any) {
        console.error('Error during pagination:', error.message);
        break;
      }
    }
    
    console.log(`Retrieved ${allTransactions.length} total swap transactions from ${pagesRetrieved} page(s)`);
    
    // Process all transactions
    const topTrades: TradeData[] = await processHeliusTransactions(allTransactions, walletAddress);
    console.log(`Processed ${topTrades.length} top trades`);
    
    return topTrades;
  } catch (error: any) {
    console.error('Error fetching top trades:', error);
    throw error;
  }
};

// Helper function to process Helius transactions
async function processHeliusTransactions(transactions: any[], walletAddress: string): Promise<TradeData[]> {
  // Track token trades
  const tradeMap = new Map<string, TradeMapEntry>();
  
  console.log('Processing Helius transactions...');
  
  // Process each transaction
  for (const tx of transactions) {
    const timestamp = tx.timestamp || Date.now();
    const signature = tx.signature?.slice(0, 8) || 'unknown';
    
    console.log(`Analyzing transaction ${signature}... (${new Date(timestamp).toISOString()})`);
    
    // Process token transfers
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      // Find tokens being bought (sent to wallet)
      const tokensReceived = tx.tokenTransfers.filter(
        (transfer: TokenTransfer) => transfer.toUserAccount === walletAddress && 
        transfer.mint !== SOL_MINT && 
        transfer.mint !== USDC_MINT
      );
      
      // Find tokens being sold (sent from wallet)
      const tokensSent = tx.tokenTransfers.filter(
        (transfer: TokenTransfer) => transfer.fromUserAccount === walletAddress && 
        transfer.mint !== SOL_MINT && 
        transfer.mint !== USDC_MINT
      );
      
      // Find SOL transfers (representing the SOL spent/received)
      const solTransfers = tx.tokenTransfers.filter(
        (transfer: TokenTransfer) => transfer.mint === SOL_MINT &&
        (transfer.fromUserAccount === walletAddress || transfer.toUserAccount === walletAddress)
      );
      
      // Also check native SOL transfers
      let solAmount = 0;
      if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
        for (const transfer of tx.nativeTransfers) {
          if (transfer.fromUserAccount === walletAddress) {
            // SOL going out (buying tokens)
            solAmount = transfer.amount / 1e9; // Convert lamports to SOL
            console.log(`  SOL sent: ${solAmount.toFixed(4)} SOL`);
          } else if (transfer.toUserAccount === walletAddress) {
            // SOL coming in (selling tokens)
            solAmount = transfer.amount / 1e9; // Convert lamports to SOL
            console.log(`  SOL received: ${solAmount.toFixed(4)} SOL`);
          }
        }
      }
      
      // Process received tokens (buys)
      for (const transfer of tokensReceived) {
        const mint = transfer.mint;
        const amount = transfer.tokenAmount;
        
        console.log(`  BOUGHT: ${amount.toFixed(4)} of token ${mint.slice(0, 8)}...`);
        
        // Add to trade map
        if (!tradeMap.has(mint)) {
          const tokenInfo = await getTokenInfo(mint);
          tradeMap.set(mint, {
            buys: [],
            sells: [],
            token: {
              address: mint,
              symbol: tokenInfo.symbol,
              name: tokenInfo.name,
              logo: tokenInfo.logo
            }
          });
        }
        
        const trade = tradeMap.get(mint);
        if (trade) {
          trade.buys.push({
            amount,
            solValue: solAmount, // Use the SOL amount from native transfers
            timestamp
          });
        }
      }
      
      // Process sent tokens (sells)
      for (const transfer of tokensSent) {
        const mint = transfer.mint;
        const amount = transfer.tokenAmount;
        
        console.log(`  SOLD: ${amount.toFixed(4)} of token ${mint.slice(0, 8)}...`);
        
        // Add to trade map
        if (!tradeMap.has(mint)) {
          const tokenInfo = await getTokenInfo(mint);
          tradeMap.set(mint, {
            buys: [],
            sells: [],
            token: {
              address: mint,
              symbol: tokenInfo.symbol,
              name: tokenInfo.name,
              logo: tokenInfo.logo
            }
          });
        }
        
        const trade = tradeMap.get(mint);
        if (trade) {
          trade.sells.push({
            amount, 
            solValue: solAmount, // Use the SOL amount from native transfers
            timestamp
          });
        }
      }
    }
  }
  
  // Process the trade map into our TradeData format
  const tradeData: TradeData[] = [];
  
  // Convert to array before iterating
  const tradeEntries = Array.from(tradeMap.entries());
  console.log(`Found ${tradeEntries.length} tokens with potential trades`);
  
  for (const [mint, data] of tradeEntries) {
    // Skip SOL and USDC
    if (mint === SOL_MINT || mint === USDC_MINT) continue;
    
    // Only include tokens that have both buys and sells
    if (data.buys.length === 0 || data.sells.length === 0) {
      console.log(`Skipping ${data.token.symbol}: missing buys (${data.buys.length}) or sells (${data.sells.length})`);
      continue;
    }
    
    // Calculate total bought/sold
    const totalBought = data.buys.reduce((sum, buy) => sum + buy.amount, 0);
    const totalSold = data.sells.reduce((sum, sell) => sum + sell.amount, 0);
    
    // Calculate profit/loss in SOL
    const totalBuyValue = data.buys.reduce((sum, buy) => sum + buy.solValue, 0);
    const totalSellValue = data.sells.reduce((sum, sell) => sum + sell.solValue, 0);
    const profitLoss = totalSellValue - totalBuyValue;
    
    // Calculate average prices
    const avgBuyPrice = totalBuyValue / totalBought;
    const avgSellPrice = totalSellValue / totalSold;
    
    // Find first buy and last sell
    const firstBuy = data.buys.reduce(
      (earliest, buy) => buy.timestamp < earliest.timestamp ? buy : earliest, 
      data.buys[0]
    );
    const lastSell = data.sells.reduce(
      (latest, sell) => sell.timestamp > latest.timestamp ? sell : latest, 
      data.sells[0]
    );
    
    // Calculate duration
    const duration = calculateDuration(firstBuy.timestamp, lastSell.timestamp);
    
    console.log(`Found trade for ${data.token.symbol}: ${profitLoss > 0 ? '+' : ''}${profitLoss.toFixed(4)} SOL P/L`);
    
    tradeData.push({
      tokenAddress: mint,
      tokenSymbol: data.token.symbol,
      tokenName: data.token.name,
      tokenLogoURI: data.token.logo,
      totalBought,
      totalSold,
      profitLoss,
      profitLossInSol: profitLoss,
      duration,
      firstBuyTimestamp: firstBuy.timestamp,
      lastSellTimestamp: lastSell.timestamp,
      avgBuyPrice,
      avgSellPrice
    });
  }
  
  // Sort by profit (highest first)
  return tradeData.sort((a, b) => b.profitLoss - a.profitLoss);
}

// Helper function to get token info
const getTokenInfo = async (mint: string) => {
  try {
    const tokenInfoUrl = `https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`;
    const response = await fetch(tokenInfoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mintAccounts: [mint] })
    });
    
    const data = await response.json();
    if (data && data[0]) {
      return {
        symbol: data[0].onChainMetadata?.metadata?.data?.symbol || 
               data[0].legacyMetadata?.symbol || 'Unknown',
        name: data[0].onChainMetadata?.metadata?.data?.name || 
              data[0].legacyMetadata?.name || 'Unknown Token',
        logo: data[0].legacyMetadata?.logoURI || ''
      };
    }
    return { symbol: 'Unknown', name: 'Unknown Token', logo: '' };
  } catch (error) {
    console.error(`Error fetching token info for ${mint}:`, error);
    return { symbol: 'Unknown', name: 'Unknown Token', logo: '' };
  }
};

// Helper function to process token data from actual Helius data
async function processTokenData(tokensData: any, txData: any, walletAddress: string): Promise<TokenData[]> {
  // Create a map of tokens with data from the balances endpoint
  const tokenMap = new Map<string, TokenData>();
  
  // Add tokens from the balances endpoint
  if (tokensData.tokens && Array.isArray(tokensData.tokens)) {
    for (const token of tokensData.tokens) {
      const remaining = token.amount || 0;
      
      // Get token info for symbol and name
      let tokenInfo = { symbol: token.symbol || 'Unknown', name: token.name || 'Unknown Token', logo: token.logo || '' };
      if (!token.symbol || token.symbol === 'Unknown') {
        tokenInfo = await getTokenInfo(token.mint);
      }
      
      tokenMap.set(token.mint || '', {
        tokenAddress: token.mint || '',
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        tokenLogoURI: tokenInfo.logo,
        totalBought: 0, // Will calculate from tx history
        totalSold: 0,   // Will calculate from tx history
        remaining,
        currentPrice: token.price || 0,
        totalValue: (token.price || 0) * remaining
      });
    }
  }
  
  // Process transaction history to calculate bought/sold amounts
  const txs = Array.isArray(txData) ? txData : txData?.data || [];
  
  if (txs.length > 0) {
    // Filter transactions to only include swaps and token transfers
    const relevantTxs = txs.filter((tx: HeliusTransaction) => 
      tx.type === 'SWAP' || 
      tx.type === 'TOKEN_TRANSFER' ||
      tx.type === 'DEX'
    );
    
    for (const tx of relevantTxs) {
      // Process token transfers
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        for (const transfer of tx.tokenTransfers) {
          const mint = transfer.mint;
          const amount = transfer.tokenAmount;
          
          // If this token isn't in our map yet, add it
          if (!tokenMap.has(mint)) {
            const tokenInfo = await getTokenInfo(mint);
            tokenMap.set(mint, {
              tokenAddress: mint,
              tokenSymbol: tokenInfo.symbol,
              tokenName: tokenInfo.name,
              tokenLogoURI: tokenInfo.logo,
              totalBought: 0,
              totalSold: 0,
              remaining: 0,
              currentPrice: 0,
              totalValue: 0
            });
          }
          
          // Update bought/sold amounts based on transfer direction
          const token = tokenMap.get(mint);
          if (token) {
            if (transfer.toUserAccount === walletAddress) {
              token.totalBought += amount;
            } else if (transfer.fromUserAccount === walletAddress) {
              token.totalSold += amount;
            }
          }
        }
      }
      
      // Process account data for additional token changes
      if (tx.accountData && tx.accountData.length > 0) {
        for (const account of tx.accountData) {
          if (account.tokenBalanceChanges && account.tokenBalanceChanges.length > 0) {
            for (const change of account.tokenBalanceChanges) {
              const mint = change.mint;
              const amount = parseFloat(change.rawTokenAmount.tokenAmount) / (10 ** change.rawTokenAmount.decimals);
              
              // If this token isn't in our map yet, add it
              if (!tokenMap.has(mint)) {
                const tokenInfo = await getTokenInfo(mint);
                tokenMap.set(mint, {
                  tokenAddress: mint,
                  tokenSymbol: tokenInfo.symbol,
                  tokenName: tokenInfo.name,
                  tokenLogoURI: tokenInfo.logo,
                  totalBought: 0,
                  totalSold: 0,
                  remaining: 0,
                  currentPrice: 0,
                  totalValue: 0
                });
              }
              
              // Update bought/sold amounts based on balance change
              const token = tokenMap.get(mint);
              if (token && change.userAccount === walletAddress) {
                if (amount > 0) {
                  token.totalBought += amount;
                } else if (amount < 0) {
                  token.totalSold += Math.abs(amount);
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Convert map to array and return
  return Array.from(tokenMap.values());
}

// Helper function to calculate duration between timestamps
function calculateDuration(firstTimestamp: number, lastTimestamp: number): string {
  const millisecondsDiff = lastTimestamp - firstTimestamp;
  const secondsDiff = millisecondsDiff / 1000;
  const minutesDiff = secondsDiff / 60;
  const hoursDiff = minutesDiff / 60;
  const daysDiff = hoursDiff / 24;
  
  if (daysDiff >= 30) {
    const months = Math.floor(daysDiff / 30);
    return months === 1 ? '1 month' : `${months} months`;
  } else if (daysDiff >= 7) {
    const weeks = Math.floor(daysDiff / 7);
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  } else if (daysDiff >= 1) {
    return Math.floor(daysDiff) === 1 ? '1 day' : `${Math.floor(daysDiff)} days`;
  } else if (hoursDiff >= 1) {
    return Math.floor(hoursDiff) === 1 ? '1 hour' : `${Math.floor(hoursDiff)} hours`;
  } else if (minutesDiff >= 1) {
    return Math.floor(minutesDiff) === 1 ? '1 minute' : `${Math.floor(minutesDiff)} minutes`;
  } else {
    return Math.floor(secondsDiff) === 1 ? '1 second' : `${Math.floor(secondsDiff)} seconds`;
  }
}

// Identify the SOL mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Function to get trading history - recent transactions
export const fetchTradingHistory = async (walletAddress: string): Promise<any[]> => {
  try {
    const response = await fetch(`https://api.helius.xyz/v1/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=20`);
    const rawData = await response.json();
    const data = rawData.data || [];
    
    // Filter to only include trades (not transfers)
    const trades = data.filter((tx: any) => 
      tx.type === 'SWAP' || tx.type === 'DEX'
    );
    
    return trades;
  } catch (error) {
    console.error('Error fetching trading history:', error);
    throw error;
  }
};
