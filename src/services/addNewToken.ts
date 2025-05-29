import { drpcClient } from './drpcClient';
import { tradingHistoryService } from './tradingHistoryService';
import { ProcessedTrade } from './tradeProcessor';
import { TokenInfoService } from './tokenInfoService';
import { jupiterApiService } from './jupiterApiService';
import { supabase } from '../utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { historicalPriceService } from './historicalPriceService';

export interface AddTokenResult {
  success: boolean;
  message: string;
  tradesFound: number;
  error?: string;
}

export class AddNewTokenService {
  /**
   * Process a single transaction into a trade for a specific token
   * This is similar to the private method in tradingHistoryService but public and token-specific
   */
  private async processTransactionForToken(
    tx: any,
    walletAddress: string,
    targetTokenAddress: string
  ): Promise<ProcessedTrade | null> {
    try {
      // Skip failed transactions
      if (tx.status === 'failed') {
        console.log(`⏭️ Skipping failed transaction: ${tx.signature}`);
        return null;
      }

      // Get token balances that changed
      const tokenChanges = tx.tokenBalanceChanges || [];

      // Filter for changes related to our target token
      const targetTokenChange = tokenChanges.find(
        (change: any) => change.tokenAddress === targetTokenAddress
      );

      if (!targetTokenChange) {
        // This transaction doesn't involve our target token
        return null;
      }

      console.log(`🎯 Processing transaction ${tx.signature} for token ${targetTokenAddress}`);

      // Set default values
      let tokenInfo = null;
      let priceUSD = 0;
      let priceSOL = 0;

      try {
        // Get token info using TokenInfoService (which includes Jupiter data)
        console.log(`🔍 Fetching token info for ${targetTokenAddress}...`);
        tokenInfo = await TokenInfoService.getTokenInfo(targetTokenAddress);
        console.log(`✅ Token info retrieved:`, {
          symbol: tokenInfo?.symbol,
          logoURI: tokenInfo?.logoURI
        });
      } catch (error) {
        console.error(`❌ Failed to fetch token info for ${targetTokenAddress}:`, error);

        // Fallback: Try to get basic info from Jupiter directly
        try {
          console.log(`🔄 Trying Jupiter API fallback for token info...`);
          const jupiterTokenInfo = await jupiterApiService.getTokenInfo(targetTokenAddress);
          if (jupiterTokenInfo) {
            tokenInfo = jupiterTokenInfo;
            console.log(`✅ Jupiter fallback successful:`, {
              symbol: tokenInfo?.symbol,
              logoURI: tokenInfo?.logoURI
            });
          }
        } catch (fallbackError) {
          console.error(`❌ Jupiter fallback also failed:`, fallbackError);
        }
      }

      try {
        // Get price data using Jupiter API with historical timestamp
        const tradeTimestamp = tx.blockTime * 1000; // Convert to milliseconds
        console.log(`💰 Fetching historical prices for ${targetTokenAddress} at ${new Date(tradeTimestamp).toISOString()}...`);

        // Get historical price data
        [priceUSD, priceSOL] = await Promise.all([
          jupiterApiService.getTokenPriceInUSD(targetTokenAddress, tradeTimestamp),
          jupiterApiService.getTokenPriceInSOL(targetTokenAddress, tradeTimestamp)
        ]);

        console.log(`✅ Price data retrieved: $${priceUSD} USD, ${priceSOL} SOL`);
      } catch (error) {
        console.error(`❌ Failed to fetch price data for ${targetTokenAddress}:`, error);
        // Continue with 0 prices - we still want to record the trade
      }

      // Calculate trade values
      const amount = Math.abs(targetTokenChange.uiAmount);
      const valueUSD = amount * priceUSD;
      const valueSOL = amount * priceSOL;

      // Determine trade type based on SOL balance change
      const preBalance = tx.preBalances[0] || 0;
      const postBalance = tx.postBalances[0] || 0;
      const balanceChange = postBalance - preBalance;
      const type = balanceChange < 0 ? 'BUY' : 'SELL';

      // Ensure we have valid token symbol and logo URI
      const tokenSymbol = tokenInfo?.symbol || 
                         targetTokenChange.tokenTicker || 
                         `Token-${targetTokenAddress.slice(0, 4)}...${targetTokenAddress.slice(-4)}`;

      const tokenLogoURI = tokenInfo?.logoURI || 
                          targetTokenChange.logo || 
                          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/unknown-token.png';

      console.log(`🏷️ Final token info: Symbol=${tokenSymbol}, Logo=${tokenLogoURI ? 'Found' : 'Default'}`);

      const processedTrade: ProcessedTrade = {
        signature: tx.signature,
        timestamp: tx.blockTime * 1000,
        type,
        tokenSymbol,
        tokenAddress: targetTokenAddress,
        tokenLogoURI,
        decimals: targetTokenChange.decimals,
        amount,
        priceUSD,
        priceSOL,
        valueUSD,
        valueSOL,
        profitLoss: 0, // Set to 0 to match ProcessedTrade type
        blockTime: tx.blockTime
      };

      console.log(`✅ Successfully processed trade:`, {
        signature: processedTrade.signature,
        type: processedTrade.type,
        amount: processedTrade.amount,
        symbol: processedTrade.tokenSymbol,
        valueUSD: processedTrade.valueUSD
      });

      return processedTrade;
    } catch (error) {
      console.error(`💥 Error processing transaction ${tx.signature} for token ${targetTokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Add a new token by scanning for all its trades and starring them
   */
  async addNewToken(
    userId: string,
    walletAddress: string,
    tokenAddress: string
  ): Promise<AddTokenResult> {
    try {
      console.log(`🚀 Starting token addition process for ${tokenAddress}`);

      // Step 1: Ensure wallet exists and get wallet info
      const { walletId } = await tradingHistoryService.ensureWalletExists(userId, walletAddress);
      console.log(`✅ Wallet ensured: ${walletId}`);

      // Step 2: Always scan for this specific token's trades
      console.log(`🔍 Scanning for all trades with token ${tokenAddress}...`);

      // Get all token accounts for this specific token (current and historical)
      console.log(`🔍 Finding token accounts for ${tokenAddress}...`);
      let tokenAccounts: any[] = [];

      try {
        tokenAccounts = await drpcClient.getTokenAccountsByOwner(walletAddress, tokenAddress);
        console.log(`📦 Found ${tokenAccounts.length} token accounts for this token`);
      } catch (error) {
        console.error('Error fetching token accounts:', error);
        // Continue with empty array - we might still find historical data through wallet scan
      }

      // Step 3: Get all historical transactions for this specific token
      console.log(`🔄 Scanning for all historical transactions involving ${tokenAddress}...`);
      const allSignatures: string[] = [];

      // Method 1: Get signatures from token accounts (most comprehensive for this token)
      if (tokenAccounts.length > 0) {
        for (const account of tokenAccounts) {
          let beforeSignature: string | undefined;
          let totalFetched = 0;

          console.log(`📄 Scanning token account: ${account.pubkey}`);

          // Fetch ALL signatures for each token account (no time limit)
          while (true) {
            try {
              const response = await drpcClient.getSignaturesForAddress(
                account.pubkey,
                {
                  limit: 1000, // Max signatures per request
                  before: beforeSignature
                }
              );

              if (!response || response.length === 0) {
                break;
              }

              const newSignatures = response.map((sig: any) => sig.signature);
              allSignatures.push(...newSignatures);
              totalFetched += newSignatures.length;

              console.log(`📊 Fetched ${newSignatures.length} signatures (total: ${totalFetched})`);

              beforeSignature = response[response.length - 1].signature;

              // Add a delay between fetches to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 300));

              // If we got less than the limit, we've reached the end
              if (response.length < 1000) {
                break;
              }
            } catch (error) {
              console.error(`Error fetching signatures for account ${account.pubkey}:`, error);
              // Don't throw - continue with other accounts
              break;
            }
          }

          console.log(`✅ Completed scanning account ${account.pubkey}: ${totalFetched} signatures`);
        }
      }

      // Method 2: Scan wallet transactions and filter for this specific token
      try {
        console.log(`🔍 Scanning wallet transactions for ${tokenAddress}...`);

        // Get more wallet transactions but in batches to avoid timeout
        let beforeSignature: string | undefined;
        let walletTransactionCount = 0;
        const maxWalletTransactions = 1000; // Limit total wallet transactions to scan

        while (walletTransactionCount < maxWalletTransactions) {
          const batchSize = Math.min(200, maxWalletTransactions - walletTransactionCount);

          const recentTransactions = await drpcClient.getTransactionsByWallet(
            walletAddress,
            { 
              limit: batchSize,
              before: beforeSignature
            }
          );

          if (!recentTransactions.transactions || recentTransactions.transactions.length === 0) {
            break;
          }

          // Filter for transactions that involve our target token
          const relevantTransactions = recentTransactions.transactions.filter((tx: any) => {
            if (!tx.tokenBalanceChanges) return false;
            return tx.tokenBalanceChanges.some((change: any) => change.tokenAddress === tokenAddress);
          });

          const additionalSignatures = relevantTransactions.map((tx: any) => tx.signature);
          allSignatures.push(...additionalSignatures);

          walletTransactionCount += recentTransactions.transactions.length;
          beforeSignature = recentTransactions.transactions[recentTransactions.transactions.length - 1]?.signature;

          console.log(`📊 Scanned ${recentTransactions.transactions.length} wallet transactions, found ${relevantTransactions.length} relevant`);

          // Add delay between batches
          await new Promise(resolve => setTimeout(resolve, 300));

          // If we got less than requested, we've reached the end
          if (recentTransactions.transactions.length < batchSize) {
            break;
          }
        }
      } catch (error) {
        console.error('Error fetching wallet transactions:', error);
        // Don't throw - continue with what we have from token accounts
      }

      // Remove duplicates
      const uniqueSignatures = [...new Set(allSignatures)];
      console.log(`📊 Found ${uniqueSignatures.length} unique transactions to process for ${tokenAddress}`);

      let processedTrades: ProcessedTrade[] = [];

      if (uniqueSignatures.length > 0) {
        // Step 4: Process transactions in batches
        const BATCH_SIZE = 15; // Smaller batches to avoid rate limiting

        for (let i = 0; i < uniqueSignatures.length; i += BATCH_SIZE) {
          const batch = uniqueSignatures.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueSignatures.length / BATCH_SIZE)} (${batch.length} transactions)`);

          const batchPromises = batch.map(async (signature) => {
            try {
              const transaction = await drpcClient.getTransaction(signature);
              if (transaction) {
                return this.processTransactionForToken(transaction, walletAddress, tokenAddress);
              }
              return null;
            } catch (error) {
              console.error(`Error fetching transaction ${signature}:`, error);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          const validTrades = batchResults.filter((trade): trade is ProcessedTrade => trade !== null);
          processedTrades.push(...validTrades);

          // Add delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < uniqueSignatures.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      console.log(`✅ Processed ${processedTrades.length} valid trades for ${tokenAddress}`);

      // Step 5: Cache the trades (this will automatically avoid duplicates)
      if (processedTrades.length > 0) {
        console.log(`💾 Caching ${processedTrades.length} trades to Supabase...`);
        console.log(`📋 Trade summary:`, processedTrades.map(trade => ({
          signature: trade.signature.substring(0, 8) + '...',
          type: trade.type,
          amount: trade.amount,
          symbol: trade.tokenSymbol,
          valueUSD: trade.valueUSD,
          timestamp: new Date(trade.timestamp).toISOString()
        })));

        // Validate trade data before caching
        console.log(`🔍 Validating trade data before caching...`);
        const invalidTrades = processedTrades.filter(trade => 
          !trade.signature || 
          !trade.tokenAddress || 
          !trade.tokenSymbol || 
          isNaN(trade.timestamp) ||
          isNaN(trade.amount)
        );

        if (invalidTrades.length > 0) {
          console.error(`❌ Found ${invalidTrades.length} invalid trades:`, invalidTrades);
          throw new Error(`Invalid trade data found. Cannot cache trades with missing required fields.`);
        }

        console.log(`✅ All ${processedTrades.length} trades passed validation`);

        try {
          // Convert ProcessedTrade to TradeData format for historicalPriceService
          // Filter out trades with type "UNKNOWN" or convert them to "BUY"
          const tradeDataArray = processedTrades
            .filter(trade => trade.type !== "UNKNOWN")
            .map(trade => ({
              signature: trade.signature,
              timestamp: trade.timestamp,
              type: trade.type === "UNKNOWN" ? "BUY" : trade.type, // Convert UNKNOWN to BUY (this is redundant due to filter but adds safety)
              tokenMint: trade.tokenAddress,
              tokenSymbol: trade.tokenSymbol,
              tokenName: trade.tokenSymbol, // Use symbol as name if not available
              tokenLogoURI: trade.tokenLogoURI,
              tokenChange: trade.amount,
              solAmount: trade.valueSOL / trade.priceSOL || 0,
              usdValue: trade.valueUSD,
              fee: 0 // Default fee
            }));

          // Use historicalPriceService to store trades in the same way as historicalPriceService.ts
          console.log(`📤 Calling historicalPriceService.storeAllTrades...`);

          // Set the wallet address in historicalPriceService
          historicalPriceService['walletAddress'] = walletAddress;

          // Store all trades using historicalPriceService
          const storeResult = await historicalPriceService.storeAllTrades(userId, tradeDataArray);

          if (!storeResult) {
            throw new Error('Failed to store trades using historicalPriceService');
          }

          console.log(`✅ historicalPriceService.storeAllTrades completed successfully`);

          // Verify trades were actually saved to database
          console.log(`🔍 Verifying trades were saved to database...`);
          const { walletId } = await tradingHistoryService.ensureWalletExists(userId, walletAddress);

          const { data: savedTrades, error: verifyError } = await supabase
            .from('trading_history')
            .select('signature, token_address, type, amount')
            .eq('wallet_id', walletId)
            .eq('token_address', tokenAddress)
            .in('signature', processedTrades.map(t => t.signature));

          if (verifyError) {
            console.error(`❌ Error verifying saved trades:`, verifyError);
            throw new Error(`Failed to verify trades were saved: ${verifyError.message}`);
          }

          console.log(`✅ Verification successful: ${savedTrades?.length || 0} trades confirmed in database`);

          if (!savedTrades || savedTrades.length === 0) {
            console.error(`❌ No trades found in database after caching!`);
            throw new Error('Trades were not saved to database - verification failed');
          }

          console.log(`📊 Database verification:`, savedTrades.map(trade => ({
            signature: trade.signature.substring(0, 8) + '...',
            type: trade.type,
            amount: trade.amount,
            token: trade.token_address.substring(0, 8) + '...'
          })));

        } catch (storeError) {
          console.error(`❌ Error in historicalPriceService.storeAllTrades process:`, storeError);

          // If historicalPriceService.storeAllTrades failed, fall back to tradingHistoryService.cacheTrades
          console.log(`🔄 Falling back to tradingHistoryService.cacheTrades...`);

          try {
            await tradingHistoryService.cacheTrades(userId, walletAddress, processedTrades);
            console.log(`✅ tradingHistoryService.cacheTrades completed successfully`);
          } catch (cacheError) {
            console.error(`❌ Error in cacheTrades process:`, cacheError);

            // If cacheTrades failed, try direct insertion as backup
            console.log(`🔄 Attempting direct Supabase insertion as backup...`);

            try {
              const { walletId } = await tradingHistoryService.ensureWalletExists(userId, walletAddress);

              // Convert ProcessedTrade to database format
              const tradeRecords = processedTrades.map(trade => ({
                id: uuidv4(),
                wallet_id: walletId,
                wallet_address: walletAddress,
                signature: trade.signature,
                timestamp: new Date(trade.timestamp).toISOString(),
                block_time: trade.blockTime || 0,
                type: trade.type,
                token_symbol: trade.tokenSymbol,
                token_address: trade.tokenAddress,
                token_logo_uri: trade.tokenLogoURI || null,
                decimals: trade.decimals || 9,
                amount: Math.abs(trade.amount),
                price_sol: trade.priceSOL || 0,
                price_usd: trade.priceUSD || 0,
                value_sol: trade.valueSOL || 0,
                value_usd: trade.valueUSD || 0,
                profit_loss: 0,
                market_cap: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                starred: false, // Will be set to true in next step
                notes: null,
                tags: null
              }));

              console.log(`📤 Direct inserting ${tradeRecords.length} trade records...`);

              const { error: insertError } = await supabase
                .from('trading_history')
                .insert(tradeRecords);

              if (insertError) {
                console.error(`❌ Direct insertion also failed:`, insertError);
                throw new Error(`All storage methods failed: ${insertError.message}`);
              }

              console.log(`✅ Direct insertion successful for ${tradeRecords.length} trades`);

            } catch (backupError) {
              console.error(`💥 Backup insertion also failed:`, backupError);
              throw new Error(`All storage methods failed: ${storeError instanceof Error ? storeError.message : 'Unknown error'}`);
            }
          }
        }
      } else {
        console.log(`ℹ️ No trades found to cache for ${tokenAddress}`);
      }

      // Step 6: Automatically star all trades for this token (both existing and new)
      console.log(`⭐ Starring all trades for token ${tokenAddress}...`);
      try {
        await tradingHistoryService.toggleStarredTrade(walletId, null, true, tokenAddress);
        console.log(`✅ All trades for ${tokenAddress} have been starred and will appear in Trade Log`);
      } catch (error) {
        console.error('❌ Error starring trades:', error);
        // Don't fail the entire operation if starring fails
      }

      const message = processedTrades.length > 0 
        ? `Successfully found and added ${processedTrades.length} trades for this token! All trades have been starred for your Trade Log.`
        : `Token added and starred for future monitoring! No trades found yet, but future trades will be automatically tracked and starred.`;

      console.log(`🎉 Token addition completed successfully: ${message}`);

      return {
        success: true,
        message,
        tradesFound: processedTrades.length
      };

    } catch (error) {
      console.error('💥 Error in addNewToken:', error);
      return {
        success: false,
        message: 'Failed to add token',
        tradesFound: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export a singleton instance
export const addNewTokenService = new AddNewTokenService(); 
