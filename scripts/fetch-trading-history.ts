import * as dotenv from 'dotenv';
dotenv.config({ path: '.local.env' });

import { supabase } from '../src/utils/supabaseClient';
import { drpcClient, Transaction as DrpcTransaction, TokenBalanceChange as DrpcTokenBalanceChange } from '../src/services/drpcClient';
import { jupiterApiService } from '../src/services/jupiterApiService';
import { v4 as uuidv4 } from 'uuid';

interface WalletData {
  id: string;
  user_id: string;
  wallet_address: string;
  initial_scan_complete: boolean;
  updated_at: string;
}

interface TokenBalanceChange {
  tokenAddress: string;
  tokenTicker: string | undefined;
  logo: string | undefined;
  decimals: number;
  accountIndex: number | undefined;
  uiAmount: number;
}

interface Transaction {
  signature: string;
  blockTime: number;
  timestamp: number;
  status: string;
  tokenBalanceChanges?: TokenBalanceChange[];
  preBalances: number[];
  postBalances: number[];
  type?: string;
  meta?: {
    preTokenBalances?: any[];
    postTokenBalances?: any[];
  };
}

interface ProcessedTrade {
  signature: string;
  timestamp: number;
  block_time: number;
  type: string;
  token_symbol: string;
  token_address: string;
  token_logo_url: string;
  amount: number;
  price_sol: number;
  price_usd: number;
  value_sol: number;
  value_usd: number;
  profit_loss: number;
  wallet_id: string;
}

// Helper function to convert DrpcTransaction to our Transaction interface
const convertDrpcTransaction = (tx: DrpcTransaction): Transaction => {
  return {
    ...tx,
    timestamp: tx.timestamp || tx.blockTime * 1000,
    tokenBalanceChanges: tx.tokenBalanceChanges ? tx.tokenBalanceChanges.map(tbc => ({
      tokenAddress: tbc.tokenAddress,
      tokenTicker: tbc.tokenTicker,
      logo: tbc.logo,
      decimals: tbc.decimals,
      accountIndex: tbc.accountIndex,
      uiAmount: tbc.uiAmount
    })) : undefined
  };
};

// Helper function to determine trade type based on SOL balance change
const determineTradeType = (transaction: Transaction): 'BUY' | 'SELL' => {
  const preBalance = transaction.preBalances[0] || 0;
  const postBalance = transaction.postBalances[0] || 0;
  const balanceChange = postBalance - preBalance;

  // If SOL balance decreased, it's a BUY
  // If SOL balance increased, it's a SELL
  return balanceChange < 0 ? 'BUY' : 'SELL';
};

// Helper function to calculate SOL change
const calculateSolChange = (preBalances: number[], postBalances: number[]): number => {
  // Convert from lamports to SOL
  return (postBalances[0] - preBalances[0]) / 1e9;
};

// Process a transaction into a trade
const processTransaction = async (transaction: Transaction, walletId: string): Promise<ProcessedTrade | null> => {
  try {
    // Skip failed transactions
    if (transaction.status === 'failed') {
      console.log('Skipping failed transaction:', transaction.signature);
      return null;
    }

    // If there are no token balance changes, skip this transaction
    if (!transaction.tokenBalanceChanges || !transaction.tokenBalanceChanges.length) {
      console.log('No token balance changes found for transaction:', transaction.signature);
      return null;
    }

    // Calculate SOL change
    const solChange = calculateSolChange(transaction.preBalances, transaction.postBalances);
    
    // Find the primary token being traded
    const tokenChange = transaction.tokenBalanceChanges.find(change => Math.abs(change.uiAmount) > 0);
    
    if (!tokenChange) {
      console.log('No significant token changes found in transaction:', transaction.signature);
      return null;
    }

    // Determine trade type (BUY/SELL)
    const tradeType = determineTradeType(transaction);
    
    // Calculate the amount (absolute value of change)
    const amount = Math.abs(tokenChange.uiAmount);
    
    // Calculate total SOL value
    const totalSolValue = Math.abs(solChange);
    
    // Get token information and price from Jupiter API
    const tokenInfo = await jupiterApiService.fetchTokenInfo(tokenChange.tokenAddress);
    const priceData = await jupiterApiService.fetchTokenPrice(
      tokenChange.tokenAddress,
      transaction.blockTime
    );

    // Calculate price and value in USD
    const priceUSD = priceData.priceUsd || 0;
    const valueUSD = amount * priceUSD;

    // Price per token in SOL
    const priceSol = amount > 0 ? totalSolValue / amount : 0;

    // Calculate profit/loss
    // For now, a simple calculation: positive for sells, negative for buys
    const profitLoss = tradeType === 'BUY' ? -valueUSD : valueUSD;

    return {
      signature: transaction.signature,
      timestamp: transaction.timestamp,
      block_time: transaction.blockTime,
      type: tradeType,
      token_symbol: tokenInfo?.symbol || tokenChange.tokenTicker || 'Unknown',
      token_address: tokenChange.tokenAddress,
      token_logo_url: tokenInfo?.logoURI || tokenChange.logo || '',
      amount,
      price_sol: priceSol,
      price_usd: priceUSD,
      value_sol: totalSolValue,
      value_usd: valueUSD,
      profit_loss: profitLoss,
      wallet_id: walletId
    };
  } catch (error) {
    console.error('Error processing transaction:', error);
    return null;
  }
};

// Main function to fetch and process trading history
const fetchTradingHistory = async (walletAddress: string, userId?: string) => {
  try {
    console.log(`Fetching trading history for wallet: ${walletAddress}`);
    
    // Generate a user ID if not provided
    const user_id = userId || uuidv4();
    
    // Check if wallet exists in database and get its initial scan status
    const { data: walletData, error: walletError } = await supabase
      .from('wallets')
      .select('id, initial_scan_complete, updated_at, user_id, wallet_address')
      .eq('wallet_address', walletAddress)
      .eq('user_id', user_id)
      .single();

    if (walletError && walletError.code !== 'PGRST116') {
      console.error('Error fetching wallet data:', walletError);
      throw walletError;
    }

    let wallet: WalletData;
    
    // If wallet doesn't exist, create it
    if (!walletData) {
      console.log('Wallet not found, creating new wallet entry');
      const walletId = uuidv4();
      
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .upsert({
          id: walletId,
          user_id,
          wallet_address: walletAddress,
          initial_scan_complete: false
        }, { 
          onConflict: 'user_id,wallet_address' 
        })
        .select('id, initial_scan_complete, updated_at, user_id, wallet_address')
        .single();
        
      if (createError) {
        console.error('Error creating wallet:', createError);
        throw createError;
      }
      
      wallet = newWallet;
    } else {
      wallet = walletData;
    }
    
    console.log('Wallet data:', wallet);
    
    let transactions: Transaction[] = [];
    const BATCH_SIZE = 50;
    let lastSignature: string | undefined;
    let hasMore = true;
    
    // If initial scan is not complete, fetch all historical transactions
    if (!wallet.initial_scan_complete) {
      console.log('Initial scan not complete. Fetching all historical transactions...');
      
      while (hasMore) {
        console.log('Fetching batch of transactions, lastSignature:', lastSignature);
        
        try {
          const response = await drpcClient.getTransactions(walletAddress, BATCH_SIZE, lastSignature);
          
          if (!response.transactions || response.transactions.length === 0) {
            hasMore = false;
            break;
          }
          
          // Convert DrpcTransaction to our Transaction interface
          const convertedTxs = response.transactions.map(convertDrpcTransaction);
          transactions = [...transactions, ...convertedTxs];
          
          // Update lastSignature for next batch
          lastSignature = response.lastSignature || undefined;
          
          // If we got fewer transactions than requested, we're done
          if (response.transactions.length < BATCH_SIZE) {
            hasMore = false;
          }
          
          console.log(`Fetched ${response.transactions.length} transactions. Total: ${transactions.length}`);
          
          // Add a small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('Error fetching transactions:', error);
          break;
        }
      }
      
      console.log(`Total transactions fetched: ${transactions.length}`);
    } 
    // If initial scan is complete, only fetch new transactions
    else {
      console.log('Initial scan complete. Fetching only new transactions since:', wallet.updated_at);
      
      const afterTimestamp = new Date(wallet.updated_at);
      
      while (hasMore) {
        try {
          const response = await drpcClient.getTransactions(
            walletAddress, 
            BATCH_SIZE, 
            lastSignature, 
            afterTimestamp
          );
          
          if (!response.transactions || response.transactions.length === 0) {
            hasMore = false;
            break;
          }
          
          // Convert DrpcTransaction to our Transaction interface
          const convertedTxs = response.transactions.map(convertDrpcTransaction);
          transactions = [...transactions, ...convertedTxs];
          
          // Update lastSignature for next batch
          lastSignature = response.lastSignature || undefined;
          
          // If we got fewer transactions than requested, we're done
          if (response.transactions.length < BATCH_SIZE) {
            hasMore = false;
          }
          
          console.log(`Fetched ${response.transactions.length} new transactions. Total: ${transactions.length}`);
          
          // Add a small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('Error fetching new transactions:', error);
          break;
        }
      }
      
      console.log(`Total new transactions fetched: ${transactions.length}`);
    }
    
    // Process transactions in batches to avoid rate limits
    const processedTrades: ProcessedTrade[] = [];
    const SUB_BATCH_SIZE = 5;
    
    for (let i = 0; i < transactions.length; i += SUB_BATCH_SIZE) {
      console.log(`Processing batch ${i / SUB_BATCH_SIZE + 1}/${Math.ceil(transactions.length / SUB_BATCH_SIZE)}`);
      
      const batch = transactions.slice(i, i + SUB_BATCH_SIZE);
      
      for (const tx of batch) {
        try {
          const trade = await processTransaction(tx, wallet.id);
          if (trade) {
            processedTrades.push(trade);
          }
        } catch (error) {
          console.error('Error processing transaction:', error);
        }
      }
      
      // Add delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Total trades processed: ${processedTrades.length}`);
    
    // Store trades in Supabase
    if (processedTrades.length > 0) {
      console.log('Storing trades in Supabase...');
      
      // Upsert trades in batches
      const UPSERT_BATCH_SIZE = 20;
      for (let i = 0; i < processedTrades.length; i += UPSERT_BATCH_SIZE) {
        const batch = processedTrades.slice(i, i + UPSERT_BATCH_SIZE);
        
        const { error } = await supabase
          .from('trading_history')
          .upsert(batch, {
            onConflict: 'wallet_id,signature',
            ignoreDuplicates: true
          });
          
        if (error) {
          console.error('Error upserting trades:', error);
        }
      }
      
      console.log('Trades stored successfully');
      
      // Mark initial scan as complete if it wasn't already
      if (!wallet.initial_scan_complete) {
        console.log('Marking initial scan as complete');
        
        const { error: updateError } = await supabase
          .from('wallets')
          .update({ initial_scan_complete: true })
          .eq('id', wallet.id);
          
        if (updateError) {
          console.error('Error updating wallet scan status:', updateError);
        }
      }
    }
    
    // Retrieve all trades from Supabase to return
    const { data: allTrades, error: fetchError } = await supabase
      .from('trading_history')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('timestamp', { ascending: false });
      
    if (fetchError) {
      console.error('Error fetching all trades:', fetchError);
      throw fetchError;
    }
    
    console.log(`Retrieved ${allTrades?.length || 0} trades from database`);
    
    return {
      wallet,
      trades: allTrades || []
    };
  } catch (error) {
    console.error('Error in fetchTradingHistory:', error);
    throw error;
  }
};

// Run script for the specified wallet
const testWalletAddress = 'LT42y5yGt13TJUR8iLBu3y37PPYAB32GzDhMCQvJvEX';
console.log(`Starting trading history fetch for wallet: ${testWalletAddress}`);

fetchTradingHistory(testWalletAddress)
  .then(result => {
    console.log(`Completed processing for wallet ${result.wallet.wallet_address}`);
    console.log(`Initial scan complete: ${result.wallet.initial_scan_complete}`);
    console.log(`Total trades in database: ${result.trades.length}`);
    
    // Log sample trades if available
    if (result.trades.length > 0) {
      console.log('Sample trade:', result.trades[0]);
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 