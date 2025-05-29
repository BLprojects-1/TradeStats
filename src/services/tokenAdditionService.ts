import { historicalPriceService } from './historicalPriceService';
import { tradingHistoryService } from './tradingHistoryService';
import { TokenInfoService } from './tokenInfoService';
import { supabase } from '../utils/supabaseClient';
import { isValidSolanaAddress } from '../utils/userProfile';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

interface TokenAdditionResult {
  success: boolean;
  message: string;
  tokenAddress: string;
  tradesFound: number;
  tokenInfo?: {
    symbol: string;
    name: string;
    logoURI: string | null;
    currentPrice?: number;
    priceChange24h?: number;
  };
}

interface JupiterPriceV2Response {
  data: {
    [key: string]: {
      id: string;
      type: string;
      price: string;
      extraInfo?: {
        lastSwappedPrice?: {
          lastJupiterSellAt: number;
          lastJupiterSellPrice: string;
          lastJupiterBuyAt: number;
          lastJupiterBuyPrice: string;
        };
        quotedPrice?: {
          buyPrice: string;
          buyAt: number;
          sellPrice: string;
          sellAt: number;
        };
        confidenceLevel: string;
      };
    } | null;
  };
  timeTaken: number;
}

interface JupiterPriceV4Response {
  data: {
    [key: string]: {
      id: string;
      mintSymbol: string;
      vsToken: string;
      vsTokenSymbol: string;
      price: number;
      priceChange24h?: number;
    };
  };
}

export class TokenAdditionService {
  private JUPITER_PRICE_API = 'https://lite-api.jup.ag/price/v2';
  // Fallback API endpoint in case the primary one fails
  private FALLBACK_JUPITER_PRICE_API = 'https://price.jup.ag/v4/price';

  /**
   * Get current price data from Jupiter with enhanced error handling
   */
  private async getJupiterPrice(tokenMint: string): Promise<{ price: number; change24h: number } | null> {
    // Retry configuration
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    const apis = [
      { url: this.JUPITER_PRICE_API, params: `?ids=${tokenMint}&showExtraInfo=true` },
      { url: this.FALLBACK_JUPITER_PRICE_API, params: `?ids=${tokenMint}&vsToken=USDC` }
    ];

    // Try each API endpoint
    for (const api of apis) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`API: ${api.url} - Attempt ${attempt + 1}/${maxRetries} to fetch price for ${tokenMint}`);

          // Configure axios with enhanced options
          const axiosConfig = {
            timeout: 15000, // Increased timeout to 15 seconds
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            validateStatus: (status: number) => status === 200 // Only accept 200 status
          };

          // For v2 API
          if (api.url === this.JUPITER_PRICE_API) {
            const response = await axios.get<JupiterPriceV2Response>(
              `${api.url}${api.params}`,
              axiosConfig
            );

            const priceData = response.data?.data?.[tokenMint];
            if (priceData && priceData.price) {
              console.log(`✅ Successfully fetched price data from ${api.url}`);
              // Calculate 24h change from extraInfo if available
              let change24h = 0;
              if (priceData.extraInfo?.quotedPrice) {
                const currentPrice = parseFloat(priceData.price);
                const lastPrice = parseFloat(priceData.extraInfo.quotedPrice.buyPrice);
                change24h = ((currentPrice - lastPrice) / lastPrice) * 100;
              }
              return {
                price: parseFloat(priceData.price),
                change24h
              };
            }
          } 
          // For v4 fallback API
          else {
            const response = await axios.get<JupiterPriceV4Response>(
              `${api.url}${api.params}`,
              axiosConfig
            );

            const priceData = response.data?.data?.[tokenMint];
            if (priceData) {
              console.log(`✅ Successfully fetched price data from fallback API`);
              return {
                price: priceData.price || 0,
                change24h: priceData.priceChange24h || 0
              };
            }
          }

          console.log(`⚠️ No price data found for ${tokenMint} in response from ${api.url}`);
          break; // Try next API if this one doesn't have data for this token

        } catch (error) {
          const isLastAttempt = attempt === maxRetries - 1;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error fetching price from ${api.url} (attempt ${attempt + 1}/${maxRetries}):`, errorMessage);

          if (!isLastAttempt) {
            // Exponential backoff with jitter
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
            console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.log(`All retry attempts failed for ${api.url}, trying next API if available`);
          }
        }
      }
    }

    console.log('❌ All API endpoints failed, returning null');
    return null; // Fallback if all APIs and retries fail
  }

  /**
   * Add a token by its contract address and scan for all historical trades
   * @param tokenAddress The token's contract address
   * @param walletAddress The user's wallet address
   * @param userId The user's ID
   */
  async addTokenByAddress(
    tokenAddress: string,
    walletAddress: string,
    userId: string
  ): Promise<TokenAdditionResult> {
    try {
      // 1. Validate inputs
      if (!isValidSolanaAddress(tokenAddress)) {
        throw new Error('Invalid token address format');
      }
      if (!isValidSolanaAddress(walletAddress)) {
        throw new Error('Invalid wallet address format');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }

      console.log(`🔍 Adding token ${tokenAddress} for wallet ${walletAddress}`);

      // 2. Get token info from Jupiter first
      console.log('📊 Fetching token information...');
      let tokenInfo;
      let priceInfo;

      try {
        tokenInfo = await TokenInfoService.getTokenInfo(tokenAddress);
      } catch (error) {
        console.error('Error fetching token info:', error);
        // Continue with null tokenInfo - we'll create a fallback below
      }

      try {
        console.log('Attempting to fetch price info with enhanced error handling...');
        priceInfo = await this.getJupiterPrice(tokenAddress);

        if (priceInfo) {
          console.log(`✅ Successfully retrieved price info: $${priceInfo.price} (24h change: ${priceInfo.change24h}%)`);
        } else {
          console.log('⚠️ No price info available from any API endpoint, continuing with default values');
        }
      } catch (error) {
        console.error('Error in price info fetching process:', error);
        console.log('⚠️ Continuing token addition process without price information');
        // Continue with null priceInfo
      }

      // Create a properly typed token info object with fallbacks
      const fullTokenInfo = {
        symbol: tokenInfo?.symbol || `Token-${tokenAddress.slice(0, 4)}...${tokenAddress.slice(-4)}`,
        name: tokenInfo?.symbol || `Token-${tokenAddress.slice(0, 4)}...${tokenAddress.slice(-4)}`,
        logoURI: tokenInfo?.logoURI || null,
        currentPrice: priceInfo?.price || 0,
        priceChange24h: priceInfo?.change24h || 0
      };

      if (!tokenInfo) {
        console.warn('⚠️ Could not fetch token information');
      }

      // 3. Check if wallet exists in tracked_wallets
      const { data: existingWallet, error: walletError } = await supabase
        .from('tracked_wallets')
        .select('id')
        .eq('wallet_address', walletAddress)
        .eq('user_id', userId)
        .single();

      if (walletError) {
        throw new Error(`Failed to verify wallet: ${walletError.message}`);
      }

      if (!existingWallet) {
        throw new Error('Wallet not found in tracked wallets');
      }

      // 4. Use historicalPriceService to scan for trades
      // This will automatically apply dust and micro transaction filters
      console.log('📊 Scanning for historical trades...');

      // Analyze wallet trades using the public method
      const analysisResult = await historicalPriceService.analyzeWalletTrades(walletAddress, userId);

      // Filter trades for our specific token
      const tokenTrades = analysisResult.recentTrades.filter(trade => trade.tokenMint === tokenAddress);
      const historicalTokenTrades = analysisResult.historicalTrades.get(tokenAddress) || [];
      const allTokenTrades = [...tokenTrades, ...historicalTokenTrades];

      if (allTokenTrades.length === 0) {
        return {
          success: false,
          message: 'No trades found for this token',
          tokenAddress,
          tradesFound: 0,
          tokenInfo: fullTokenInfo
        };
      }

      console.log(`✅ Found ${allTokenTrades.length} trades for token ${tokenAddress}`);

      // 5. Store trades in Supabase
      console.log('💾 Storing trades in Supabase...');

      // Prepare trades for storage
      const tradesToStore = allTokenTrades.map(trade => ({
        id: uuidv4(),
        user_id: userId,
        wallet_address: walletAddress,
        signature: trade.signature,
        timestamp: new Date(trade.timestamp).toISOString(),
        block_time: Math.floor(trade.timestamp / 1000),
        type: trade.type,
        token_symbol: trade.tokenSymbol,
        token_address: trade.tokenMint,
        token_logo_uri: trade.tokenLogoURI,
        decimals: 9, // Default to 9 decimals for Solana tokens
        amount: trade.tokenChange.toString(),
        price_usd: (trade.usdValue / Math.abs(trade.tokenChange)).toString(),
        price_sol: (trade.solAmount / Math.abs(trade.tokenChange)).toString(),
        value_usd: trade.usdValue.toString(),
        value_sol: trade.solAmount.toString(),
        profit_loss: null,
        market_cap: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        starred: true,
        notes: null,
        tags: null,
        total_supply: null // Adding total_supply field with null default value
      }));

      // Store trades in batches to avoid request size limits
      const BATCH_SIZE = 50;
      for (let i = 0; i < tradesToStore.length; i += BATCH_SIZE) {
        const batch = tradesToStore.slice(i, i + BATCH_SIZE);
        console.log(`Inserting batch ${i / BATCH_SIZE + 1} of ${Math.ceil(tradesToStore.length / BATCH_SIZE)}...`);

        const { error: insertError } = await supabase
          .from('trading_history')
          .insert(batch)
          .select();

        if (insertError) {
          console.error(`Error storing trades batch ${i / BATCH_SIZE + 1}:`, insertError);
          throw new Error(`Failed to store trades: ${insertError.message}`);
        } else {
          console.log(`✅ Stored batch ${i / BATCH_SIZE + 1} of ${Math.ceil(tradesToStore.length / BATCH_SIZE)}`);
        }
      }

      // No need for separate starring since we set starred: true during insertion

      // 7. Store current price in token_prices if we have it
      try {
        if (priceInfo) {
          const { error: priceError } = await supabase
            .from('token_prices')
            .upsert({
              token_address: tokenAddress,
              price_usd: priceInfo.price,
              price_change_24h: priceInfo.change24h,
              last_updated: new Date().toISOString()
            });

          if (priceError) {
            console.error('Error storing token price:', priceError);
          } else {
            console.log('✅ Successfully stored token price in database');
          }
        } else {
          console.log('ℹ️ No price information available to store');
        }
      } catch (error) {
        // Don't let price storage failure affect the overall token addition process
        console.error('Error in price storage step:', error);
      }

      return {
        success: true,
        message: `Successfully added token and found ${allTokenTrades.length} trades`,
        tokenAddress,
        tradesFound: allTokenTrades.length,
        tokenInfo: fullTokenInfo
      };

    } catch (error) {
      console.error('Error in addTokenByAddress:', error);

      // Instead of throwing the error, return a failure result
      // This prevents the application from crashing due to network issues
      return {
        success: false,
        message: `Failed to add token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tokenAddress,
        tradesFound: 0,
        tokenInfo: {
          symbol: tokenAddress.slice(0, 6) + '...',
          name: `Token ${tokenAddress.slice(0, 4)}...${tokenAddress.slice(-4)}`,
          logoURI: null,
          currentPrice: 0,
          priceChange24h: 0
        }
      };
    }
  }
}

// Export a singleton instance
export const tokenAdditionService = new TokenAdditionService(); 
