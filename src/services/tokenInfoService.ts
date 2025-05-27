import { jupiterApiService } from './jupiterApiService';
import { supabase } from '../utils/supabaseClient';

interface TokenInfo {
  symbol: string;
  logoURI: string | null;
  decimals: number;
}

interface TokenPriceInfo {
  priceUSD: number;
  priceSOL: number;
}

export class TokenInfoService {
  // Global token info cache to ensure we only call the Jupiter API once per token
  private static tokenInfoCache: Map<string, TokenInfo> = new Map();

  /**
   * Get token info from cache or fetch from Jupiter API
   * @param tokenAddress The token's mint address
   * @returns Promise resolving to the token info
   */
  public static async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    try {
      // Check cache first
      if (this.tokenInfoCache.has(tokenAddress)) {
        console.log(`🔍 Using cached token info for ${tokenAddress}`);
        return this.tokenInfoCache.get(tokenAddress)!;
      }

      console.log(`🔄 Fetching token info for ${tokenAddress} from Jupiter API`);
      const info = await jupiterApiService.getTokenInfo(tokenAddress);

      const tokenInfo = {
        symbol: info.symbol,
        logoURI: info.logoURI,
        decimals: info.decimals
      };

      // Store in cache
      this.tokenInfoCache.set(tokenAddress, tokenInfo);
      console.log(`✅ Cached token info for ${tokenAddress}: ${tokenInfo.symbol}`);

      return tokenInfo;
    } catch (error) {
      console.error(`❌ Error fetching token info for ${tokenAddress}:`, error);

      // Create a fallback token info
      const fallbackInfo = {
        symbol: 'Unknown',
        logoURI: null,
        decimals: 9 // Default to 9 decimals (SOL standard)
      };

      // Store fallback in cache to avoid repeated failed API calls
      this.tokenInfoCache.set(tokenAddress, fallbackInfo);
      console.log(`⚠️ Cached fallback token info for ${tokenAddress}`);

      return fallbackInfo;
    }
  }

  private static async getTokenPriceAtTime(tokenAddress: string, timestamp: number): Promise<TokenPriceInfo> {
    try {
      // Jupiter API doesn't support historical prices, so we get current prices
      // For recent trading history (last 24-48 hours), current prices provide reasonable approximation
      console.log(`Fetching current price for token ${tokenAddress} (transaction timestamp: ${new Date(timestamp).toISOString()})`);

      // Get current prices from Jupiter API
      const [solPrice, tokenPriceUSD] = await Promise.all([
        jupiterApiService.getTokenPriceInUSD('So11111111111111111111111111111111111111112'),
        jupiterApiService.getTokenPriceInUSD(tokenAddress)
      ]);

      const priceSOL = solPrice > 0 ? tokenPriceUSD / solPrice : 0;

      console.log(`Price fetched for ${tokenAddress}: $${tokenPriceUSD} USD, ${priceSOL} SOL`);

      return {
        priceUSD: tokenPriceUSD,
        priceSOL: priceSOL
      };
    } catch (error) {
      console.error(`Error fetching token price for ${tokenAddress} at timestamp ${timestamp}:`, error);
      return {
        priceUSD: 0,
        priceSOL: 0
      };
    }
  }

  public static async updateTransactionTokenInfo(
    userId: string,
    transactionSignature: string,
    tokenAddress: string,
    amount: number,
    timestamp: number,
    type: 'BUY' | 'SELL'
  ): Promise<void> {
    try {
      // Get token info and price
      const [tokenInfo, priceInfo] = await Promise.all([
        this.getTokenInfo(tokenAddress),
        this.getTokenPriceAtTime(tokenAddress, timestamp)
      ]);

      // Calculate values
      const valueUSD = amount * priceInfo.priceUSD;
      const valueSOL = amount * priceInfo.priceSOL;

      // For profit/loss calculation:
      // - For buys: negative value (spending)
      // - For sells: positive value (receiving)
      const profitLoss = type === 'BUY' ? -valueUSD : valueUSD;

      // Update transaction in database
      const { error } = await supabase
        .from('trading_history')
        .update({
          token_symbol: tokenInfo.symbol,
          token_logo_uri: tokenInfo.logoURI,
          price_sol: priceInfo.priceSOL,
          price_usd: priceInfo.priceUSD,
          value_sol: valueSOL,
          value_usd: valueUSD,
          profit_loss: profitLoss
        })
        .match({
          user_id: userId,
          signature: transactionSignature
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating transaction token info:', error);
      throw error;
    }
  }

  public static async updateBatchTransactionTokenInfo(transactions: any[]): Promise<void> {
    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      await Promise.all(
        batch.map(tx => 
          this.updateTransactionTokenInfo(
            tx.user_id,
            tx.signature,
            tx.token_address,
            tx.amount,
            new Date(tx.timestamp).getTime(),
            tx.type as 'BUY' | 'SELL'
          )
        )
      );

      // Add delay between batches to respect rate limits
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
} 
