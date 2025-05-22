import { Transaction, TokenBalanceChange } from './drpcClient';
import { jupiterApiService } from './jupiterApiService';

export interface ProcessedTrade {
  signature: string;
  timestamp: number;
  type: 'BUY' | 'SELL' | 'UNKNOWN';
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoURI: string | null;
  amount: number;
  decimals: number;
  priceUSD: number;
  priceSOL: number;
  valueUSD: number;
  valueSOL: number;
  profitLoss: number;
  blockTime?: number;  // Optional for backward compatibility
}

// Approximate SOL to USD conversion - in a real app you'd use an API for this
const SOL_TO_USD_RATE = 70; // Assuming 1 SOL = $70 USD

// SOL mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112';

export class TradeProcessor {
  async processTrades(transactions: Transaction[]): Promise<ProcessedTrade[]> {
    console.log('TradeProcessor: Starting to process trades:', {
      totalTransactions: transactions.length,
      transactionTypes: transactions.map(tx => tx.type),
      transactionsWithTokenChanges: transactions.filter(tx => 
        (tx.meta?.preTokenBalances && tx.meta.preTokenBalances.length > 0) || 
        (tx.tokenBalanceChanges && tx.tokenBalanceChanges.length > 0)
      ).length
    });
    
    const trades: ProcessedTrade[] = [];
    
    for (const tx of transactions) {
      console.log('TradeProcessor: Processing transaction:', {
        signature: tx.signature,
        type: tx.type,
        hasPrePostTokenBalances: tx.meta?.preTokenBalances && tx.meta.preTokenBalances.length > 0 ? true : false,
        hasTokenBalanceChanges: tx.tokenBalanceChanges && tx.tokenBalanceChanges.length > 0 ? true : false,
        status: tx.status,
        logMessages: tx.logMessages?.length || 0
      });

      // Skip failed transactions
      if (tx.status === 'failed') {
        console.log('TradeProcessor: Skipping failed transaction:', tx.signature);
        continue;
      }

      // If there are no token balance changes in any format, skip this transaction
      if ((!tx.meta?.preTokenBalances || !tx.meta.preTokenBalances.length || 
           !tx.meta.postTokenBalances || !tx.meta.postTokenBalances.length) &&
          (!tx.tokenBalanceChanges || !tx.tokenBalanceChanges.length)) {
        console.log('TradeProcessor: Skipping transaction with no token changes:', tx.signature);
        continue;
      }
      
      // Calculate SOL change
      const solChange = this.calculateSolChange(tx.preBalances, tx.postBalances);
      console.log('TradeProcessor: SOL change:', {
        signature: tx.signature,
        solChange,
        preBalances: tx.preBalances,
        postBalances: tx.postBalances
      });

      // Define a structure to track token changes
      type TokenChangeInfo = {
        mint: string,
        tokenSymbol: string,
        logo?: string,
        decimals: number,
        change: number,
        // Flag to indicate if this is a user-owned token account
        isUserAccount: boolean,
        // Original account index for reference
        accountIndex?: number,
        // Owner address if available
        owner?: string
      };

      const tokenChanges = new Map<string, TokenChangeInfo>();

      // Process using pre/post token balances if available
      if (tx.meta?.preTokenBalances && tx.meta.preTokenBalances.length > 0 && 
          tx.meta.postTokenBalances && tx.meta.postTokenBalances.length > 0) {
        
        // Log out all pre token balances for debugging
        console.log('TradeProcessor: Pre token balances:', tx.meta.preTokenBalances.map(tb => ({
          accountIndex: tb.accountIndex,
          mint: tb.mint,
          owner: tb.owner,
          uiAmount: tb.uiTokenAmount.uiAmount
        })));
        
        // Log out all post token balances for debugging  
        console.log('TradeProcessor: Post token balances:', tx.meta.postTokenBalances.map(tb => ({
          accountIndex: tb.accountIndex,
          mint: tb.mint,
          owner: tb.owner,
          uiAmount: tb.uiTokenAmount.uiAmount
        })));

        // Find user's wallet addresses in the transaction
        // These are typically the transaction signers or addresses mentioned in the first few slots
        const userAddresses = new Set<string>();
        
        // Add the first few addresses in pre/post balances (usually includes users)
        if (tx.meta.preTokenBalances.length > 0) {
          for (let i = 0; i < Math.min(3, tx.meta.preTokenBalances.length); i++) {
            if (tx.meta.preTokenBalances[i].owner) {
              userAddresses.add(tx.meta.preTokenBalances[i].owner);
            }
          }
        }
        
        // Process each pre-token balance
        for (const preTB of tx.meta.preTokenBalances) {
          // Find the corresponding post-token balance by accountIndex
          const postTB = tx.meta.postTokenBalances.find(
            post => post.accountIndex === preTB.accountIndex
          );

          if (!postTB) continue;

          const preAmount = preTB.uiTokenAmount.uiAmount || 0;
          const postAmount = postTB.uiTokenAmount.uiAmount || 0;
          const change = postAmount - preAmount;

          // Skip unchanged balances - reduced threshold to catch more transactions
          if (Math.abs(change) < 0.0000001) continue;

          // Extract token symbol (we'll update this later with Jupiter API)
          let tokenSymbol = '';
          let logo = '';
          let decimals = preTB.uiTokenAmount.decimals || 9;

          // Use tokenBalanceChanges to get token symbol and logo if available
          const tokenInfo = tx.tokenBalanceChanges?.find(
            tbc => tbc.tokenAddress === preTB.mint
          );
          
          if (tokenInfo) {
            tokenSymbol = tokenInfo.tokenTicker || '';
            logo = tokenInfo.logo || '';
            decimals = tokenInfo.decimals || decimals;
          }

          // Create a unique key for each token account
          const key = `${preTB.mint}:${preTB.accountIndex}`;
          
          // Check if this is a user's account
          const isUserAccount = preTB.owner ? userAddresses.has(preTB.owner) : false;
          
          tokenChanges.set(key, {
            mint: preTB.mint,
            tokenSymbol,
            logo,
            decimals,
            change,
            isUserAccount,
            accountIndex: preTB.accountIndex,
            owner: preTB.owner
          });
        }
      } 
      // If we don't have pre/post balances but have tokenBalanceChanges, use those directly
      else if (tx.tokenBalanceChanges && tx.tokenBalanceChanges.length > 0) {
        console.log('TradeProcessor: Using tokenBalanceChanges directly:', tx.tokenBalanceChanges);
        
        for (const tbc of tx.tokenBalanceChanges) {
          // Skip very small changes (dust) - reduced threshold to catch more transactions
          if (Math.abs(tbc.uiAmount) < 0.0000001) continue;
          
          // Skip SOL tokens for direct processing (we handle these separately)
          if (this.isSOLToken(tbc.tokenAddress)) continue;
          
          const key = `${tbc.tokenAddress}:${tbc.accountIndex || 0}`;
          
          tokenChanges.set(key, {
            mint: tbc.tokenAddress,
            tokenSymbol: tbc.tokenTicker || '',
            logo: tbc.logo || '',
            decimals: tbc.decimals || 9,
            change: tbc.uiAmount, // This is already the net change
            isUserAccount: true,  // Assume it's a user account since we don't have ownership info
            accountIndex: tbc.accountIndex
          });
        }
      }

      console.log('TradeProcessor: Token changes:', 
        Array.from(tokenChanges.values()).map(tc => ({
          mint: tc.mint,
          symbol: tc.tokenSymbol,
          change: tc.change,
          isUserAccount: tc.isUserAccount,
          owner: tc.owner,
          accountIndex: tc.accountIndex
        }))
      );

      // Find the primary token being traded (this is the one being SENT/SOLD by the user)
      let mainTokenChange: TokenChangeInfo | null = null;
      let mainTokenAmount = 0;

      // Track all positive and negative token changes separately to better determine transaction type
      const tokenOutflows: TokenChangeInfo[] = [];
      const tokenInflows: TokenChangeInfo[] = [];
      
      // Sort token changes into inflows and outflows
      for (const tc of tokenChanges.values()) {
        if (tc.change < 0) {
          tokenOutflows.push(tc);
        } else if (tc.change > 0) {
          tokenInflows.push(tc);
        }
      }
      
      // Log summary of token flows for debugging
      console.log('TradeProcessor: Token flow summary:', {
        signature: tx.signature,
        outflowCount: tokenOutflows.length,
        outflowTokens: tokenOutflows.map(t => ({ mint: t.mint.substring(0, 6), amount: Math.abs(t.change) })),
        inflowCount: tokenInflows.length,
        inflowTokens: tokenInflows.map(t => ({ mint: t.mint.substring(0, 6), amount: t.change }))
      });

      // First, prioritize user's token accounts with negative changes (tokens SENT/SOLD)
      for (const tc of tokenOutflows) {
        if (tc.isUserAccount) {
          const absChange = Math.abs(tc.change);
          if (absChange > mainTokenAmount) {
            mainTokenAmount = absChange;
            mainTokenChange = tc;
          }
        }
      }

      // If no outflows from user accounts, look for inflows to user accounts (tokens RECEIVED/BOUGHT)
      if (!mainTokenChange) {
        for (const tc of tokenInflows) {
          if (tc.isUserAccount) {
            if (tc.change > mainTokenAmount) {
              mainTokenAmount = tc.change;
              mainTokenChange = tc;
            }
          }
        }
      }

      // If we still don't have a main token, look at any significant token movement
      if (!mainTokenChange) {
        // Check all token changes regardless of user account
        for (const tc of tokenChanges.values()) {
          const absChange = Math.abs(tc.change);
          if (absChange > mainTokenAmount) {
            mainTokenAmount = absChange;
            mainTokenChange = tc;
          }
        }
      }

      if (!mainTokenChange) {
        console.log('TradeProcessor: No significant token changes found in transaction:', tx.signature);
        continue;
      }

      // Determine trade type based on SOL balance change
      // If SOL balance decreased (negative change), it's a BUY
      // If SOL balance increased (positive change), it's a SELL
      const isBuy = solChange < 0;
      const tradeType = isBuy ? 'BUY' : 'SELL';

      // Log the determination factors for debugging
      console.log('TradeProcessor: Trade type determination:', {
        signature: tx.signature,
        tokenChange: mainTokenChange.change,
        finalIsBuy: isBuy,
        tradeType: tradeType,
        isUserToken: mainTokenChange.isUserAccount,
        solChange: solChange
      });
      
      // Calculate the amount (absolute value of change)
      const amount = Math.abs(mainTokenChange.change);
      
      console.log('TradeProcessor: Main token change:', {
        signature: tx.signature,
        mint: mainTokenChange.mint,
        symbol: mainTokenChange.tokenSymbol,
        change: mainTokenChange.change,
        amount: amount,
        type: tradeType,
        isUserAccount: mainTokenChange.isUserAccount
      });
      
      // Calculate total SOL value including wrapped SOL transfers
      const solTokenValue = 0; // We'll calculate this if needed
      const totalSolValue = Math.abs(solChange);
      
      // Calculate price and value in USD
      let priceUSD = 0;
      let valueUSD = 0;
      
      if (amount > 0 && totalSolValue > 0) {
        // Price per token in SOL
        const pricePerToken = totalSolValue / amount;
        // Convert to USD
        priceUSD = pricePerToken * SOL_TO_USD_RATE;
        valueUSD = totalSolValue * SOL_TO_USD_RATE;
      }
      
      // Fetch price data from Jupiter API
      // We won't be getting market cap data since Jupiter doesn't provide it directly
      let marketCap: number | undefined = undefined;

      try {
        // First, try to fetch token information from Jupiter API
        console.log(`TradeProcessor: Before Jupiter API call for token info - current symbol: "${mainTokenChange.tokenSymbol}", mint: ${mainTokenChange.mint}`);
        
        const jupTokenInfo = await jupiterApiService.fetchTokenInfo(
          mainTokenChange.mint
        );

        // Debug the response
        console.log(`TradeProcessor: Jupiter token info response:`, jupTokenInfo ? {
          symbol: jupTokenInfo.symbol,
          name: jupTokenInfo.name, 
          logoURI: jupTokenInfo.logoURI ? 'Exists' : 'Missing'
        } : 'No data returned');

        // If we got token info from Jupiter API, use it for the symbol and logo
        if (jupTokenInfo) {
          console.log(`TradeProcessor: Got Jupiter token info for ${mainTokenChange.mint}: ${jupTokenInfo.symbol}`);
          
          // ALWAYS prefer Jupiter's token symbol if available
          // This is important to ensure consistent token display
          const oldSymbol = mainTokenChange.tokenSymbol;
          mainTokenChange.tokenSymbol = jupTokenInfo.symbol;
          console.log(`TradeProcessor: Using Jupiter symbol: "${mainTokenChange.tokenSymbol}" (was: "${oldSymbol}")`);
          
          // Only use Jupiter logo if we don't have one
          if (!mainTokenChange.logo || mainTokenChange.logo === '') {
            mainTokenChange.logo = jupTokenInfo.logoURI;
            console.log(`TradeProcessor: Using Jupiter logo: ${mainTokenChange.logo ? 'Logo set' : 'No logo found'}`);
          }
          
          // Use Jupiter decimals if available
          if (jupTokenInfo.decimals) {
            mainTokenChange.decimals = jupTokenInfo.decimals;
            console.log(`TradeProcessor: Using Jupiter decimals: ${mainTokenChange.decimals}`);
          }
        }
        
        // Then, try to fetch price data from Jupiter API
        const jupiterData = await jupiterApiService.fetchTokenPrice(
          mainTokenChange.mint,
          tx.blockTime // Pass the transaction's blockTime for historical pricing
        );
        
        // Log whether we got price data from Jupiter
        if (jupiterData.priceUsd) {
          console.log(`TradeProcessor: Got Jupiter price for ${mainTokenChange.tokenSymbol} at time ${tx.blockTime}: $${jupiterData.priceUsd}`);
        } else {
          console.log(`TradeProcessor: No Jupiter price found for ${mainTokenChange.tokenSymbol || mainTokenChange.mint} at time ${tx.blockTime}`);
        }
        
        // If we still don't have a token symbol, use shortened mint address as fallback
        if (!mainTokenChange.tokenSymbol || mainTokenChange.tokenSymbol === '') {
          mainTokenChange.tokenSymbol = `${mainTokenChange.mint.substring(0, 4)}...${mainTokenChange.mint.substring(mainTokenChange.mint.length - 4)}`;
          console.log(`TradeProcessor: Using shortened mint as symbol: ${mainTokenChange.tokenSymbol}`);
        }
        
        // ALWAYS use Jupiter price data if available
        if (jupiterData.priceUsd) {
          priceUSD = jupiterData.priceUsd;
          valueUSD = amount * priceUSD;
          console.log(`TradeProcessor: Using Jupiter price: $${priceUSD} for ${mainTokenChange.tokenSymbol}`);
        }
      } catch (error) {
        console.error(`TradeProcessor: Error fetching data for ${mainTokenChange.mint}:`, error);
        
        // If there was an error and we still don't have a symbol, use shortened mint address
        if (!mainTokenChange.tokenSymbol || mainTokenChange.tokenSymbol === '') {
          mainTokenChange.tokenSymbol = `${mainTokenChange.mint.substring(0, 4)}...${mainTokenChange.mint.substring(mainTokenChange.mint.length - 4)}`;
          console.log(`TradeProcessor: Using shortened mint as symbol after error: ${mainTokenChange.tokenSymbol}`);
        }
      }
      
      // Don't use market cap since Jupiter doesn't provide it
      const finalMarketCap = undefined;

      console.log('TradeProcessor: Creating trade with the following token details:', {
        tokenSymbol: mainTokenChange.tokenSymbol,
        tokenAddress: mainTokenChange.mint,
        tokenLogoURI: mainTokenChange.logo,
        decimals: mainTokenChange.decimals
      });

      trades.push({
        signature: tx.signature,
        timestamp: tx.timestamp || tx.blockTime * 1000,
        type: tradeType,
        tokenAddress: mainTokenChange.mint,
        tokenSymbol: mainTokenChange.tokenSymbol,
        tokenLogoURI: mainTokenChange.logo,
        amount,
        decimals: mainTokenChange.decimals,
        priceUSD,
        priceSOL: totalSolValue / amount,
        valueUSD,
        valueSOL: totalSolValue,
        profitLoss: isBuy ? -valueUSD : valueUSD,
        blockTime: tx.blockTime
      });
      
      // Verify the trade object immediately after creation
      const createdTrade = trades[trades.length - 1];
      console.log('TradeProcessor: Verified created trade:', {
        signature: createdTrade.signature,
        tokenSymbol: `"${createdTrade.tokenSymbol}"`,
        hasTokenLogo: !!createdTrade.tokenLogoURI
      });
    }
    
    console.log('TradeProcessor: Final processed trades:', {
      totalTrades: trades.length,
      tradeTypes: trades.map(t => t.type),
      trades: trades.map(t => ({
        type: t.type,
        amount: t.amount,
        value: t.valueSOL,
        valueUSD: t.valueUSD,
        marketCap: t.marketCap
      }))
    });
    
    console.log('TradeProcessor: Final processed trades (with symbols):', 
      trades.map(t => ({
        tokenSymbol: t.tokenSymbol,
        tokenAddress: t.tokenAddress,
        hasLogo: t.tokenLogoURI ? true : false
      }))
    );
    
    return trades.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getTopTrades(address: string, limit: number): Promise<ProcessedTrade[]> {
    // This would typically fetch from a database or cache
    // For now, we'll return an empty array
    return [];
  }

  private calculateSolChange(preBalances: number[], postBalances: number[]): number {
    // Only look at the first account's balance change (user's wallet)
    // Convert from lamports to SOL
    return (postBalances[0] - preBalances[0]) / 1e9;
  }

  private isSOLToken(tokenAddress: string): boolean {
    // Native SOL token address or the wrapped SOL address
    return tokenAddress === SOL_MINT || 
           tokenAddress === 'So11111111111111111111111111111111111111112';
  }

  private determineTransactionType(transaction: any): 'BUY' | 'SELL' {
    // Get the first account's balance changes (user's wallet)
    const preBalance = transaction.preBalances?.[0] || 0;
    const postBalance = transaction.postBalances?.[0] || 0;
    const balanceChange = postBalance - preBalance;

    // If SOL balance decreased (negative change), it's a BUY
    // If SOL balance increased (positive change), it's a SELL
    return balanceChange < 0 ? 'BUY' : 'SELL';
  }
}