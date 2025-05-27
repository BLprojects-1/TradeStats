//this script finds historical pricing using calculations from the transaction against the price of solana.
//this script will find all 24h transactions for a wallet given in placeholder
//this script will find all trades for the tokens discovered in the 24h transaction search

/**
 * Historical Price Analysis Script
 * ===============================
 * This script demonstrates how to:
 * 1. Fetch recent trades from DRPC
 * 2. Extract token and SOL amounts
 * 3. Get historical SOL prices from CoinGecko
 * 4. Calculate USD values for trades
 * 5. Fetch token names and logos from Jupiter API (once per token)
 */

const axios = require('axios');

// Configuration
const TEST_WALLET = 'LT42y5yGt13TJUR8iLBu3y37PPYAB32GzDhMCQvJvEX';
const TARGET_TOKEN = 'jQxGhh5r78RVp8Q5yAcjoy6ing5tFx5BSHV2nprP3cu';
const DRPC_API_URL = 'https://lb.drpc.org/ogrpc?network=solana&dkey=AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF';
const DRPC_API_KEY = process.env.DRPC_API_KEY || '';
const JUPITER_TOKEN_API_BASE = 'https://lite-api.jup.ag/tokens/v1';

class TokenInfoCache {
  constructor() {
    this.cache = new Map(); // mint -> { name, symbol, logoURI }
    this.fetchPromises = new Map(); // mint -> Promise (to avoid duplicate requests)
  }

  async getTokenInfo(mint) {
    // Return cached data if available
    if (this.cache.has(mint)) {
      console.log(`📋 Using cached token info for ${mint}`);
      return this.cache.get(mint);
    }

    // If already fetching, wait for the existing promise
    if (this.fetchPromises.has(mint)) {
      console.log(`⏳ Waiting for existing token info fetch for ${mint}`);
      return await this.fetchPromises.get(mint);
    }

    // Create new fetch promise
    const fetchPromise = this.fetchTokenInfoFromJupiter(mint);
    this.fetchPromises.set(mint, fetchPromise);

    try {
      const tokenInfo = await fetchPromise;
      this.cache.set(mint, tokenInfo);
      this.fetchPromises.delete(mint);
      return tokenInfo;
    } catch (error) {
      this.fetchPromises.delete(mint);
      throw error;
    }
  }

  async fetchTokenInfoFromJupiter(mint) {
    try {
      console.log(`🔍 Fetching token info from Jupiter API for ${mint}`);
      
      // Try direct token lookup first
      try {
        const response = await axios.get(`${JUPITER_TOKEN_API_BASE}/token/${mint}`, {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 10000
        });

        if (response.data) {
          const tokenInfo = {
            name: response.data.name || 'Unknown Token',
            symbol: response.data.symbol || 'UNKNOWN',
            logoURI: response.data.logoURI || null
          };
          console.log(`✅ Found token info: ${tokenInfo.symbol} (${tokenInfo.name})`);
          return tokenInfo;
        }
      } catch (directError) {
        console.log(`⚠️ Direct lookup failed for ${mint}, trying tradable tokens list...`);
        
        // Fallback to tradable tokens list
        try {
          const response = await axios.get(`${JUPITER_TOKEN_API_BASE}/mints/tradable`, {
            headers: {
              'Accept': 'application/json'
            },
            timeout: 15000
          });

          if (response.data && Array.isArray(response.data)) {
            const tokenInfo = response.data.find(token => token.address === mint);
            
            if (tokenInfo) {
              const result = {
                name: tokenInfo.name || 'Unknown Token',
                symbol: tokenInfo.symbol || 'UNKNOWN',
                logoURI: tokenInfo.logoURI || null
              };
              console.log(`✅ Found token in tradable list: ${result.symbol} (${result.name})`);
              return result;
            }
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback lookup also failed for ${mint}:`, fallbackError.message);
        }
      }

      // If all lookups fail, return default info
      console.log(`⚠️ Could not find token info for ${mint}, using defaults`);
      return {
        name: 'Unknown Token',
        symbol: mint.substring(0, 8) + '...',
        logoURI: null
      };

    } catch (error) {
      console.error(`❌ Error fetching token info for ${mint}:`, error.message);
      return {
        name: 'Unknown Token',
        symbol: mint.substring(0, 8) + '...',
        logoURI: null
      };
    }
  }

  // Get summary of cached tokens
  getSummary() {
    console.log(`\n📊 Token Info Cache Summary:`);
    console.log(`   Cached tokens: ${this.cache.size}`);
    for (const [mint, info] of this.cache.entries()) {
      console.log(`   ${info.symbol}: ${mint}`);
    }
  }
}

class TokenAccountTracker {
  constructor() {
    this.knownAccounts = new Map(); // mint -> Set of token account pubkeys
  }

  addAccount(mint, accountPubkey) {
    if (!this.knownAccounts.has(mint)) {
      this.knownAccounts.set(mint, new Set());
    }
    this.knownAccounts.get(mint).add(accountPubkey);
  }

  getAccounts(mint) {
    return Array.from(this.knownAccounts.get(mint) || []);
  }

  hasAccount(mint, accountPubkey) {
    return this.knownAccounts.has(mint) && this.knownAccounts.get(mint).has(accountPubkey);
  }
}

class HistoricalPriceAnalyzer {
  constructor() {
    this.DRPC_API_URL = DRPC_API_URL;
    this.solPriceCache = new Map();
    this.tokenAccountTracker = new TokenAccountTracker();
    this.tokenInfoCache = new TokenInfoCache();
    console.log('🔧 Initialized HistoricalPriceAnalyzer');
    console.log('📡 DRPC URL:', this.DRPC_API_URL);
    console.log('🪙 Jupiter Token API:', JUPITER_TOKEN_API_BASE);
  }

  /**
   * Get historical SOL price from CoinGecko
   * Uses the exact API endpoint format provided
   */
  async getHistoricalSOLPrice(timestamp) {
    try {
      const date = new Date(timestamp);
      const dateKey = date.toISOString().split('T')[0];
      
      // Check cache first
      if (this.solPriceCache.has(dateKey)) {
        console.log(`📋 Using cached SOL price for ${dateKey}`);
        return this.solPriceCache.get(dateKey);
      }

      // Calculate days ago for CoinGecko API
      const now = new Date();
      const daysAgo = Math.ceil((now.getTime() - timestamp) / (1000 * 60 * 60 * 24));
      
      console.log(`🔍 Fetching historical SOL price for ${date.toISOString()} (${daysAgo} days ago)`);

      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=${daysAgo}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Journi-Trading-App/1.0',
            'x-cg-pro-api-key': process.env.COINGECKO_API_KEY || ''
          }
        }
      );

      if (!response.data?.prices?.length) {
        throw new Error('No price data from CoinGecko');
      }

      // Find closest price to our timestamp
      let closestPrice = response.data.prices[0];
      let minTimeDiff = Math.abs(timestamp - closestPrice[0]);

      for (const pricePoint of response.data.prices) {
        const timeDiff = Math.abs(timestamp - pricePoint[0]);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestPrice = pricePoint;
        }
      }

      const price = closestPrice[1];
      console.log(`✅ Found SOL price: $${price} at ${new Date(closestPrice[0]).toISOString()}`);
      
      // Cache the result
      this.solPriceCache.set(dateKey, price);
      return price;
    } catch (error) {
      console.error('Error fetching historical SOL price:', error.message);
      return 100; // Fallback price
    }
  }

  /**
   * Fetch transactions from DRPC for the last 24 hours with full pagination
   * Similar to getTradingHistory in tradingHistoryService.ts
   */
  async getRecentTransactions(walletAddress, hours = 24) {
    try {
      console.log(`📡 Fetching transactions for wallet: ${walletAddress} (last ${hours} hours)`);
      
      const allSignatures = [];
      let beforeSignature = null;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore) {
        pageCount++;
        console.log(`\n📄 Fetching recent transactions page ${pageCount} (before: ${beforeSignature || 'start'})`);

        const params = [
          walletAddress,
          {
            limit: 1000,
            commitment: 'confirmed'
          }
        ];

        if (beforeSignature) {
          params[1].before = beforeSignature;
        }

        const response = await axios.post(this.DRPC_API_URL, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: params
        });

        if (response.data.error) {
          throw new Error(`DRPC Error: ${JSON.stringify(response.data.error)}`);
        }

        const signatures = response.data.result || [];
        console.log(`📊 Found ${signatures.length} signatures on this page`);

        // Add signatures to our collection
        allSignatures.push(...signatures);

        // Update pagination cursor and check if we should continue
        if (signatures.length === 1000) {
          beforeSignature = signatures[signatures.length - 1].signature;
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          hasMore = false;
        }
      }

      console.log(`📊 Found ${allSignatures.length} total signatures`);

      // Show the timestamps of the first few transactions for debugging
      if (allSignatures.length > 0) {
        console.log('\n🕐 Most recent transaction timestamps:');
        allSignatures.slice(0, 10).forEach((sig, index) => {
          const date = new Date(sig.blockTime * 1000);
          console.log(`  ${index + 1}. ${sig.signature.substring(0, 20)}... - ${date.toISOString()}`);
        });
      }

      // Filter by time (last 24 hours)
      const now = Date.now() / 1000;
      const cutoffTime = now - (hours * 60 * 60);
      console.log(`\n⏰ Current time: ${new Date(now * 1000).toISOString()}`);
      console.log(`⏰ Cutoff time (${hours}h ago): ${new Date(cutoffTime * 1000).toISOString()}`);
      
      const recentSignatures = allSignatures.filter(sig => sig.blockTime >= cutoffTime);
      console.log(`⏰ Found ${recentSignatures.length} signatures in last ${hours} hours`);

      return recentSignatures;
    } catch (error) {
      console.error('❌ Failed to fetch transactions:', error.message);
      throw error;
    }
  }

  /**
   * Process a single transaction into a trade
   * Using exact filtering criteria from tradingHistoryService.ts
   */
  async processTransaction(tx) {
    try {
      // Debug: Log transaction signature and basic info
      console.log(`\n🔍 Processing transaction: ${tx.signature}`);
      console.log(`📅 Block time: ${new Date(tx.blockTime * 1000).toISOString()}`);

      // 1. Must have token-balance changes
      if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
        console.log('❌ No token balance data found');
        console.log(`   preTokenBalances: ${tx.meta?.preTokenBalances ? 'exists' : 'missing'}`);
        console.log(`   postTokenBalances: ${tx.meta?.postTokenBalances ? 'exists' : 'missing'}`);
        return null;
      }

      // Compute token changes by comparing preTokenBalances and postTokenBalances
      const preTokenBalances = tx.meta.preTokenBalances;
      const postTokenBalances = tx.meta.postTokenBalances;
      const tokenChanges = [];
      const dustThreshold = 0.0000001;

      // Build a map of token balances by account index and mint
      const tokenMap = new Map();
      
      // Process pre-balances
      preTokenBalances.forEach((balance, index) => {
        const key = `${index}-${balance.mint}`;
        tokenMap.set(key, { pre: balance, post: null });
      });
      
      // Process post-balances
      postTokenBalances.forEach((balance, index) => {
        const key = `${index}-${balance.mint}`;
        if (tokenMap.has(key)) {
          tokenMap.get(key).post = balance;
        } else {
          tokenMap.set(key, { pre: null, post: balance });
        }
      });

      console.log(`🔄 Found ${tokenMap.size} token balance entries to analyze`);

      // Calculate changes
      for (const [key, { pre, post }] of tokenMap.entries()) {
        if (!pre && !post) continue;
        const mint = pre?.mint || post?.mint;
        const owner = pre?.owner || post?.owner;
        const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmountString || pre.uiTokenAmount.uiAmount || '0') : 0;
        const postAmount = post ? parseFloat(post.uiTokenAmount.uiAmountString || post.uiTokenAmount.uiAmount || '0') : 0;
        const change = postAmount - preAmount;
        
        console.log(`  Token ${mint}: ${preAmount} → ${postAmount} (change: ${change})`);
        
        if (Math.abs(change) < dustThreshold) {
          console.log(`    ⚠️ Below dust threshold (${dustThreshold})`);
          continue;
        }
        
        // Skip native SOL wrapping/unwrapping
        if (mint === 'So11111111111111111111111111111111111111112') {
          console.log(`    ⚠️ Skipping native SOL token`);
          continue;
        }
        
        // Skip system program ownership (wrapping)
        if (owner === '11111111111111111111111111111111') {
          console.log(`    ⚠️ Skipping system program ownership (wrapping)`);
          continue;
        }
        
        tokenChanges.push({
          mint,
          owner,
          change,
          preAmount,
          postAmount
        });
      }

      console.log(`📈 Found ${tokenChanges.length} significant token changes`);

      if (tokenChanges.length === 0) {
        console.log('❌ No significant token changes found');
        console.log('   This transaction will be skipped');
        return null;
      }

      // Find the most significant token change (by absolute value)
      const primaryTokenChange = tokenChanges.reduce((max, current) => 
        Math.abs(current.change) > Math.abs(max.change) ? current : max
      );

      console.log(`🎯 Primary token change: ${primaryTokenChange.mint} (${primaryTokenChange.change})`);

      // Calculate SOL balance change
      const preBalance = tx.meta.preBalances[0] || 0; // First account is usually the wallet
      const postBalance = tx.meta.postBalances[0] || 0;
      const fee = tx.meta.fee || 0;
      const solChange = (postBalance - preBalance + fee) / 1e9; // Convert lamports to SOL
      
      console.log(`💰 SOL change: ${solChange} SOL (fee: ${fee / 1e9} SOL)`);

      // Reduced SOL movement threshold
      if (Math.abs(solChange) < 0.0001) {
        console.log('❌ Insufficient SOL movement for trade');
        console.log(`   SOL change ${Math.abs(solChange)} < threshold 0.0001`);
        return null;
      }

      // Determine trade type
      const tradeType = solChange < 0 ? 'BUY' : 'SELL';
      console.log(`📊 Trade type: ${tradeType}`);

      // Get historical SOL price
      const blockTime = new Date(tx.blockTime * 1000);
      const solPrice = await this.getHistoricalSOLPrice(blockTime);
      const usdValue = Math.abs(solChange) * solPrice;

      console.log(`💵 Historical SOL price: $${solPrice}`);
      console.log(`💵 USD value: $${usdValue.toFixed(2)}`);

      // Fetch token info from Jupiter API (cached to avoid rate limiting)
      console.log(`🔍 Fetching token info for ${primaryTokenChange.mint}...`);
      const tokenInfo = await this.tokenInfoCache.getTokenInfo(primaryTokenChange.mint);

      const trade = {
        signature: tx.signature,
        blockTime: blockTime.toISOString(),
        type: tradeType,
        tokenMint: primaryTokenChange.mint,
        tokenName: tokenInfo.name,
        tokenSymbol: tokenInfo.symbol,
        tokenLogoURI: tokenInfo.logoURI,
        tokenChange: primaryTokenChange.change,
        solAmount: Math.abs(solChange),
        solPrice,
        usdValue,
        fee: fee / 1e9,
        allTokenChanges: tokenChanges
      };

      console.log('✅ Valid trade found!');

      // Track token accounts using actual pubkeys from accountKeys
      if (tx.meta?.preTokenBalances) {
        tx.meta.preTokenBalances.forEach(balance => {
          if (balance.owner === TEST_WALLET && tx.transaction.message.accountKeys[balance.accountIndex]) {
            const pubkey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey;
            this.tokenAccountTracker.addAccount(balance.mint, pubkey);
            console.log(`   📝 Tracked pre-balance ATA: ${pubkey} for mint ${balance.mint}`);
          }
        });
      }
      if (tx.meta?.postTokenBalances) {
        tx.meta.postTokenBalances.forEach(balance => {
          if (balance.owner === TEST_WALLET && tx.transaction.message.accountKeys[balance.accountIndex]) {
            const pubkey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey;
            this.tokenAccountTracker.addAccount(balance.mint, pubkey);
            console.log(`   📝 Tracked post-balance ATA: ${pubkey} for mint ${balance.mint}`);
          }
        });
      }

      return trade;

    } catch (error) {
      console.error(`❌ Error processing transaction ${tx.signature}:`, error.message);
      return null;
    }
  }

  /**
   * Analyze recent trades for a wallet
   * This is the main method that orchestrates the analysis
   */
  async analyzeRecentTrades(walletAddress) {
    try {
      console.log('\n🚀 Starting Historical Pricing Analysis');
      console.log('Wallet:', walletAddress);

      // Get transaction signatures from last 24 hours
      const signatures = await this.getRecentTransactions(walletAddress);
      
      if (signatures.length === 0) {
        console.log('❌ No recent transactions found');
        return;
      }

      console.log(`\n📊 Processing ${signatures.length} transactions...`);
      
      let tradeCount = 0;
      let totalValueUSD = 0;
      const uniqueTokens = new Set();

      // Process each transaction
      for (let i = 0; i < signatures.length; i++) {
        const sigInfo = signatures[i];
        console.log(`\n[${i + 1}/${signatures.length}] Fetching transaction: ${sigInfo.signature}`);
        
        try {
          const txResponse = await axios.post(this.DRPC_API_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [
              sigInfo.signature,
              {
                encoding: 'jsonParsed',
                maxSupportedTransactionVersion: 0
              }
            ]
          });

          if (!txResponse.data?.result) {
            console.log(`⚠️ No transaction data for ${sigInfo.signature}`);
            continue;
          }

          const transaction = txResponse.data.result;
          transaction.signature = sigInfo.signature;
          
          const trade = await this.processTransaction(transaction);
          
          if (trade) {
            tradeCount++;
            totalValueUSD += trade.usdValue;
            
            // Add the primary token to uniqueTokens
            uniqueTokens.add(trade.tokenMint);
            
            // Also add ALL significant token changes to uniqueTokens
            if (trade.allTokenChanges) {
              trade.allTokenChanges.forEach(tokenChange => {
                uniqueTokens.add(tokenChange.mint);
                console.log(`   🔍 Added token to tracking list: ${tokenChange.mint}`);
              });
            }

            console.log('\n-----------------------------------');
            console.log('✅ TRADE FOUND:');
            console.log('Transaction:', trade.signature);
            console.log('Time:', trade.blockTime);
            console.log('Type:', trade.type);
            console.log('Token:', trade.tokenMint);
            console.log('Token Name:', trade.tokenName);
            console.log('Token Symbol:', trade.tokenSymbol);
            console.log('Token Logo URI:', trade.tokenLogoURI);
            console.log('Token Change:', trade.tokenChange);
            console.log('SOL Amount:', trade.solAmount.toFixed(6));
            console.log('USD Value:', `$${trade.usdValue.toFixed(2)}`);
            console.log('Fee:', `${trade.fee.toFixed(6)} SOL`);
            
            // Log all token changes in this transaction
            if (trade.allTokenChanges && trade.allTokenChanges.length > 1) {
              console.log('📋 All token changes in this transaction:');
              trade.allTokenChanges.forEach((tokenChange, index) => {
                console.log(`   ${index + 1}. ${tokenChange.mint}: ${tokenChange.change}`);
              });
            }
            console.log('-----------------------------------');
          }
        } catch (error) {
          console.log(`⚠️ Error fetching transaction ${sigInfo.signature}: ${error.message}`);
          continue;
        }
      }

      // Prime the token account tracker with active accounts before historical sweep
      console.log(`\n🎯 UNIQUE TOKENS DISCOVERED IN LAST 24 HOURS: ${uniqueTokens.size}`);
      
      // Display tokens with their names and symbols
      let tokenIndex = 1;
      for (const tokenMint of uniqueTokens) {
        const tokenInfo = await this.tokenInfoCache.getTokenInfo(tokenMint);
        console.log(`   ${tokenIndex}. ${tokenInfo.symbol} (${tokenInfo.name}) - ${tokenMint}`);
        tokenIndex++;
      }
      
      for (const tokenMint of uniqueTokens) {
        console.log(`\n🔍 Priming token account tracker for mint: ${tokenMint}`);
        const activeAccounts = await this.getTokenAccountsForMint(walletAddress, tokenMint);
        activeAccounts.forEach(pubkey => {
          this.tokenAccountTracker.addAccount(tokenMint, pubkey);
        });
        console.log(`✅ Added ${activeAccounts.length} active accounts to tracker`);
      }

      // Fetch all historical transactions for each unique token
      for (const tokenMint of uniqueTokens) {
        await this.fetchAllTransactionsForToken(walletAddress, tokenMint);
      }

      // Summary
      console.log('\n📈 ANALYSIS SUMMARY:');
      console.log('Total Transactions:', signatures.length);
      console.log('Valid Trades Found:', tradeCount);
      console.log('Total Trading Volume:', `$${totalValueUSD.toFixed(2)}`);

      // Show token info cache summary
      this.tokenInfoCache.getSummary();

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  async getAllTransactionsForToken(walletAddress, tokenMint) {
    try {
      console.log(`\n🔍 Starting COMPLETE historical fetch for token: ${tokenMint}`);
      
      // 1. First, get all currently active token accounts
      const activeAccounts = await this.getTokenAccountsForMint(walletAddress, tokenMint);
      console.log(`📂 Found ${activeAccounts.length} active token accounts`);
      
      // Add active accounts to our tracker
      activeAccounts.forEach(account => {
        this.tokenAccountTracker.addAccount(tokenMint, account);
      });

      // 2. Get all known accounts (both active and historical)
      const allAccounts = this.tokenAccountTracker.getAccounts(tokenMint);
      console.log(`📚 Total known token accounts (active + historical): ${allAccounts.length}`);

      // 3. Fetch all SPL token transfers for this mint
      const splTransfers = await this.getSPLTokenTransfers(walletAddress, tokenMint);
      console.log(`📊 Found ${splTransfers.length} SPL token transfers`);

      // 4. For each account, fetch ALL historical signatures with pagination
      const allSignatures = new Set(); // Use Set to deduplicate signatures
      
      // Add signatures from SPL transfers
      splTransfers.forEach(tx => allSignatures.add(tx.signature));
      
      for (const tokenAccount of allAccounts) {
        console.log(`\n📑 Fetching ALL signatures for token account: ${tokenAccount}`);
        let beforeSignature = null;
        let hasMore = true;
        let pageCount = 0;

        while (hasMore) {
          pageCount++;
          console.log(`\n📄 Fetching page ${pageCount} (before: ${beforeSignature || 'start'})`);

          // Construct request parameters with pagination
          const params = [
            tokenAccount,
            {
              limit: 1000, // Maximum allowed by DRPC
              commitment: 'confirmed'
            }
          ];

          if (beforeSignature) {
            params[1].before = beforeSignature;
          }

          try {
            const response = await axios.post(this.DRPC_API_URL, {
              jsonrpc: '2.0',
              id: 1,
              method: 'getSignaturesForAddress',
              params: params
            });

            if (response.data.error) {
              throw new Error(`DRPC Error: ${JSON.stringify(response.data.error)}`);
            }

            const signatures = response.data.result || [];
            console.log(`📊 Found ${signatures.length} signatures on this page`);

            // Add new signatures to our Set
            signatures.forEach(sig => allSignatures.add(sig.signature));

            // Update pagination cursor and check if we should continue
            if (signatures.length === 1000) {
              beforeSignature = signatures[signatures.length - 1].signature;
              // Add a small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } else {
              hasMore = false;
            }

          } catch (error) {
            console.error(`❌ Error fetching signatures page ${pageCount}:`, error.message);
            hasMore = false; // Stop on error
          }
        }
      }

      console.log(`\n📈 Total unique historical signatures found: ${allSignatures.size}`);

      // 5. Now fetch and process each transaction
      const allTransactions = [];
      let processedCount = 0;

      for (const signature of allSignatures) {
        processedCount++;
        console.log(`\n[${processedCount}/${allSignatures.size}] Fetching transaction: ${signature}`);

        try {
          const txResponse = await axios.post(this.DRPC_API_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [
              signature,
              {
                encoding: 'jsonParsed',
                maxSupportedTransactionVersion: 0
              }
            ]
          });

          if (!txResponse.data?.result) {
            console.log(`⚠️ No transaction data for ${signature}`);
            continue;
          }

          const transaction = txResponse.data.result;
          transaction.signature = signature;
          allTransactions.push(transaction);

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          console.log(`⚠️ Error fetching transaction ${signature}: ${error.message}`);
          continue;
        }
      }

      return allTransactions;

    } catch (error) {
      console.error(`❌ Error in getAllTransactionsForToken:`, error.message);
      return [];
    }
  }

  /**
   * Get all token accounts owned by the wallet for a specific mint
   */
  async getTokenAccountsForMint(walletAddress, tokenMint) {
    try {
      console.log(`\n🔍 Finding token accounts for mint: ${tokenMint}`);
      
      const response = await axios.post(this.DRPC_API_URL, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          {
            mint: tokenMint
          },
          {
            encoding: 'jsonParsed'
          }
        ]
      });

      if (response.data.error) {
        throw new Error(`DRPC Error: ${JSON.stringify(response.data.error)}`);
      }

      const accounts = response.data.result?.value || [];
      const accountAddresses = accounts.map(acc => acc.pubkey);
      
      console.log(`✅ Found ${accountAddresses.length} token accounts`);
      accountAddresses.forEach(addr => console.log(`   ${addr}`));
      
      return accountAddresses;

    } catch (error) {
      console.error(`❌ Error getting token accounts:`, error.message);
      return [];
    }
  }

  async fetchAllTransactionsForToken(walletAddress, tokenMint) {
    console.log(`\n🔍 Fetching all historical transactions for token: ${tokenMint}`);
    const transactions = await this.getAllTransactionsForToken(walletAddress, tokenMint);
    
    // Get token info for better display
    const tokenInfo = await this.tokenInfoCache.getTokenInfo(tokenMint);
    
    console.log(`\n📊 Processing ${transactions.length} historical transactions for token: ${tokenInfo.symbol} (${tokenInfo.name})`);
    let tradeCount = 0;
    let totalValueUSD = 0;

    for (const tx of transactions) {
      const trade = await this.processTransaction(tx);
      if (trade) {
        tradeCount++;
        totalValueUSD += trade.usdValue;

        console.log('\n-----------------------------------');
        console.log('✅ HISTORICAL TRADE FOUND:');
        console.log('Transaction:', trade.signature);
        console.log('Time:', trade.blockTime);
        console.log('Type:', trade.type);
        console.log('Token:', trade.tokenMint);
        console.log('Token Name:', trade.tokenName);
        console.log('Token Symbol:', trade.tokenSymbol);
        console.log('Token Logo URI:', trade.tokenLogoURI);
        console.log('Token Change:', trade.tokenChange);
        console.log('SOL Amount:', trade.solAmount.toFixed(6));
        console.log('USD Value:', `$${trade.usdValue.toFixed(2)}`);
        console.log('Fee:', `${trade.fee.toFixed(6)} SOL`);
        console.log('-----------------------------------');
      }
    }

    console.log(`\n📈 HISTORICAL ANALYSIS SUMMARY FOR ${tokenInfo.symbol} (${tokenInfo.name}):`);
    console.log('Total Transactions Processed:', transactions.length);
    console.log('Valid Trades Found:', tradeCount);
    console.log('Total Trading Volume:', `$${totalValueUSD.toFixed(2)}`);
  }

  /**
   * Get all SPL token transfers for a mint using program logs
   */
  async getSPLTokenTransfers(walletAddress, tokenMint) {
    try {
      console.log(`\n🔍 Fetching SPL token transfers for mint: ${tokenMint}`);
      console.log(`   Note: Using SPL Token program filters for efficient querying`);
      
      const allSignatures = new Set();
      let beforeSignature = null;
      let hasMore = true;
      let pageCount = 0;

      // Note: For SPL Token transfers, we need to query the token accounts directly
      // The memcmp filters on the program itself won't work as expected
      // Instead, we'll use the token accounts we've discovered
      const tokenAccounts = this.tokenAccountTracker.getAccounts(tokenMint);
      
      if (tokenAccounts.length === 0) {
        console.log(`⚠️ No known token accounts for mint ${tokenMint}`);
        return [];
      }

      // Query each token account for its transfer history
      for (const tokenAccount of tokenAccounts) {
        console.log(`\n📑 Fetching SPL transfers for token account: ${tokenAccount}`);
        beforeSignature = null;
        hasMore = true;
        pageCount = 0;

        while (hasMore) {
          pageCount++;
          console.log(`📄 Page ${pageCount} (before: ${beforeSignature || 'start'})`);

          const params = [
            tokenAccount,
            {
              limit: 1000,
              commitment: 'confirmed'
            }
          ];

          if (beforeSignature) {
            params[1].before = beforeSignature;
          }

          const response = await axios.post(this.DRPC_API_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: params
          });

          if (response.data.error) {
            console.error(`⚠️ Error querying token account: ${response.data.error.message}`);
            break;
          }

          const signatures = response.data.result || [];
          console.log(`📊 Found ${signatures.length} signatures`);

          // Add new signatures to our Set
          signatures.forEach(sig => allSignatures.add(sig.signature));

          // Update pagination cursor and check if we should continue
          if (signatures.length === 1000) {
            beforeSignature = signatures[signatures.length - 1].signature;
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            hasMore = false;
          }
        }
      }

      console.log(`\n📈 Total unique SPL transfer signatures found: ${allSignatures.size}`);

      // Fetch and process each transaction
      const transfers = [];
      let processedCount = 0;

      for (const signature of allSignatures) {
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`\n[${processedCount}/${allSignatures.size}] Processing SPL transfers...`);
        }

        try {
          const txResponse = await axios.post(this.DRPC_API_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [
              signature,
              {
                encoding: 'jsonParsed',
                maxSupportedTransactionVersion: 0
              }
            ]
          });

          if (!txResponse.data?.result) continue;

          const tx = txResponse.data.result;
          tx.signature = signature;
          
          // Verify this transaction involves our wallet and mint
          const involvesWallet = tx.transaction.message.accountKeys.some(
            key => key.pubkey === walletAddress
          );
          
          const involvesMint = tx.meta?.preTokenBalances?.some(
            balance => balance.mint === tokenMint
          ) || tx.meta?.postTokenBalances?.some(
            balance => balance.mint === tokenMint
          );

          if (involvesWallet && involvesMint) {
            transfers.push(tx);
          }

          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          console.log(`⚠️ Error processing SPL transfer ${signature}: ${error.message}`);
          continue;
        }
      }

      console.log(`✅ Found ${transfers.length} relevant SPL transfers`);
      return transfers;

    } catch (error) {
      console.error(`❌ Error fetching SPL token transfers:`, error.message);
      return [];
    }
  }
}

// Run the analysis
const analyzer = new HistoricalPriceAnalyzer();
analyzer.analyzeRecentTrades(TEST_WALLET); 