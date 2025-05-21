import axios from 'axios';

interface MarketChartResponse {
  market_caps: [number, number][];
  prices: [number, number][];
  total_volumes: [number, number][];
}

interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
}

// CoinGecko API client for fetching historical market cap data
class CoinGeckoService {
  private readonly client;
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private readonly cache = new Map<string, string>(); // Cache for mint address to coin ID mapping

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Fetches historical market cap for a token at the time of a transaction
   * @param mintAddress The SPL token mint address
   * @param txTimestamp Transaction timestamp in seconds
   * @returns Market cap in USD or null if not found
   */
  async fetchHistoricalMarketCap(
    mintAddress: string,
    txTimestamp: number
  ): Promise<number | null> {
    try {
      console.log(`CoinGecko: Fetching market cap for ${mintAddress} at timestamp ${txTimestamp}`);
      
      // 1. Get CoinGecko coin ID for the token
      const coinId = await this.getCoinId(mintAddress);
      if (!coinId) {
        console.log(`CoinGecko: No coin ID found for mint ${mintAddress}`);
        return null;
      }
      
      // 2. Query around transaction time (±1h window)
      const oneHour = 3600;
      const from = txTimestamp - oneHour;
      const to = txTimestamp + oneHour;
      
      const response = await this.client.get<MarketChartResponse>(
        `/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
      );
      
      const marketCaps = response.data.market_caps;
      if (!marketCaps || marketCaps.length === 0) {
        console.log(`CoinGecko: No market cap data found for ${coinId}`);
        return null;
      }
      
      // Find the closest timestamp to the transaction time
      let closest = marketCaps.reduce(
        (best: [number, number], cur: [number, number]) => 
          Math.abs(cur[0]/1000 - txTimestamp) < Math.abs(best[0]/1000 - txTimestamp)
            ? cur
            : best
      );
      
      const marketCap = closest[1];
      console.log(`CoinGecko: Found market cap ${marketCap} for ${coinId} at timestamp ${closest[0]/1000}`);
      
      return marketCap;
    } catch (error) {
      console.error('CoinGecko: Error fetching market cap:', error);
      return null;
    }
  }

  /**
   * Maps a SPL token mint address to a CoinGecko coin ID
   * @param mintAddress The SPL token mint address
   * @returns The CoinGecko coin ID or null if not found
   */
  private async getCoinId(mintAddress: string): Promise<string | null> {
    try {
      // Check cache first
      if (this.cache.has(mintAddress)) {
        return this.cache.get(mintAddress) || null;
      }
      
      const response = await this.client.get<CoinInfo>(
        `/coins/solana/contract/${mintAddress}`
      );
      
      if (response.data && response.data.id) {
        const coinId = response.data.id;
        // Cache the result
        this.cache.set(mintAddress, coinId);
        return coinId;
      }
      
      return null;
    } catch (error) {
      // If token is not found in CoinGecko, log it but don't throw
      console.log(`CoinGecko: Token ${mintAddress} not found in CoinGecko`);
      return null;
    }
  }
}

export const coingeckoService = new CoinGeckoService();
export default coingeckoService; 