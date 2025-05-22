import { jupiterApiService } from './jupiterApiService';
import { supabase } from '../lib/supabaseClient';

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
  private static async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    try {
      const info = await jupiterApiService.getTokenInfo(tokenAddress);
      return {
        symbol: info.symbol,
        logoURI: info.logoURI,
        decimals: info.decimals
      };
    } catch (error) {
      console.error(`Error fetching token info for ${tokenAddress}:`, error);
      return {
        symbol: 'Unknown',
        logoURI: null,
        decimals: 9 // Default to 9 decimals (SOL standard)
      };
    }
  }

  private static async getTokenPriceAtTime(tokenAddress: string, timestamp: number): Promise<TokenPriceInfo> {
    try {
      // Get current SOL price as reference (historical prices not available in free API)
      const solPrice = await jupiterApiService.getTokenPriceInUSD('So11111111111111111111111111111111111111112');
      const tokenPriceUSD = await jupiterApiService.getTokenPriceInUSD(tokenAddress);
      
      return {
        priceUSD: tokenPriceUSD,
        priceSOL: tokenPriceUSD / solPrice
      };
    } catch (error) {
      console.error(`Error fetching token price for ${tokenAddress}:`, error);
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