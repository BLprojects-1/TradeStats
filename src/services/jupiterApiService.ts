import axios from 'axios';

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: any;
  priceImpactPct: number;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

export interface TokenInfoResponse {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string | null;
  tags: string[] | null;
  daily_volume: number | null;
  created_at: string;
  freeze_authority: string | null;
  mint_authority: string | null;
  permanent_delegate: string | null;
  minted_at: string | null;
  extensions?: {
    coingeckoId?: string;
  };
}

export interface PriceExtraInfo {
  lastSwappedPrice: {
    lastJupiterSellAt: number | null;
    lastJupiterSellPrice: string | null;
    lastJupiterBuyAt: number | null;
    lastJupiterBuyPrice: string | null;
  };
  quotedPrice: {
    buyPrice: string;
    buyAt: number;
    sellPrice: string;
    sellAt: number;
  };
  confidenceLevel: 'high' | 'medium' | 'low';
  depth: {
    buyPriceImpactRatio: {
      depth: {
        [key: string]: number;
      };
      timestamp: number;
    };
    sellPriceImpactRatio: {
      depth: {
        [key: string]: number;
      };
      timestamp: number;
    };
  };
}

export interface TokenPriceResponse {
  data: {
    [key: string]: {
      id: string;
      type: string;
      price: string;
      extraInfo: PriceExtraInfo;
    };
  };
  timeTaken: number;
}

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const USE_MOCK_DATA = isDevelopment;

// Updated Jupiter API response interfaces based on new documentation
interface JupiterPriceData {
  timeTaken: number;
  data: {
    [key: string]: {
      price: number;
      id: string;
      mintSymbol: string;
      vsToken: string;
      vsTokenSymbol: string;
    }
  }
}

export interface JupiterTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string | null;
  tags: string[] | null;
  daily_volume: number | null;
  created_at: string;
  freeze_authority: string | null;
  mint_authority: string | null;
  permanent_delegate: string | null;
  minted_at: string | null;
  extensions?: {
    coingeckoId?: string;
  }
}

export class JupiterApiService {
  private readonly priceApiBaseUrl = 'https://lite-api.jup.ag/price/v2';
  private readonly tokenApiBaseUrl = 'https://lite-api.jup.ag/tokens/v1';

  /**
   * Get real-time price data for a token
   * @param tokenAddress The token's mint address
   * @param blockTime Optional block time for historical prices
   */
  async getTokenPrice(tokenAddress: string, blockTime?: number): Promise<TokenPriceResponse> {
    try {
      const response = await axios.get<TokenPriceResponse>(`${this.priceApiBaseUrl}`, {
        params: {
          ids: tokenAddress,
          showExtraInfo: true
        },
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.data || !response.data.data || !response.data.data[tokenAddress]) {
        throw new Error('Invalid price response from Jupiter API');
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching token price:', error);
      throw error;
    }
  }

  /**
   * Get detailed token information
   * @param mintAddress The token's mint address
   */
  async getTokenInfo(mintAddress: string): Promise<TokenInfoResponse> {
    try {
      // First try to get specific token info
      const response = await axios.get<TokenInfoResponse>(`${this.tokenApiBaseUrl}/token/${mintAddress}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.data) {
        throw new Error('Invalid token info response from Jupiter API');
      }

      return response.data;
    } catch (error) {
      // If direct token lookup fails, try to find it in the tradable tokens list
      try {
        const allTokensResponse = await axios.get<TokenInfoResponse[]>(`${this.tokenApiBaseUrl}/mints/tradable`, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!allTokensResponse.data || !Array.isArray(allTokensResponse.data)) {
          throw new Error('Invalid token list response from Jupiter API');
        }

        const tokenInfo = allTokensResponse.data.find(token => token.address === mintAddress);
        
        if (!tokenInfo) {
          throw new Error(`Token with mint address ${mintAddress} not found`);
        }

        return tokenInfo;
      } catch (fallbackError) {
        console.error('Error fetching token info with fallback method:', fallbackError);
        throw error; // Still throw the original error
      }
    }
  }

  /**
   * Get the current price of a token in USD
   * @param tokenAddress The token's mint address
   * @returns The token price in USD as a number
   */
  async getTokenPriceInUSD(tokenAddress: string): Promise<number> {
    const response = await this.getTokenPrice(tokenAddress);
    const priceData = response.data[tokenAddress];
    return parseFloat(priceData.price);
  }

  /**
   * Get the current price of a token in SOL
   * @param tokenAddress The token's mint address
   * @returns The token price in SOL as a number
   */
  async getTokenPriceInSOL(tokenAddress: string): Promise<number> {
    const [tokenPrice, solPrice] = await Promise.all([
      this.getTokenPriceInUSD(tokenAddress),
      this.getTokenPriceInUSD('So11111111111111111111111111111111111111112')
    ]);
    
    return solPrice > 0 ? tokenPrice / solPrice : 0;
  }
}

// Export a singleton instance
export const jupiterApiService = new JupiterApiService();