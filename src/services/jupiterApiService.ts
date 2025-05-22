import axios from 'axios';
import { jupiterRateLimitedService } from './jupiterRateLimitedService';

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
   * Get token price data
   * @param tokenAddress The token's mint address
   * @param timestamp Optional timestamp for historical price
   */
  async getTokenPrice(tokenAddress: string, timestamp?: string | Date | number): Promise<TokenPriceResponse> {
    try {
      return await jupiterRateLimitedService.getTokenPrice(tokenAddress, timestamp);
    } catch (error) {
      console.error('Error fetching token price:', error);
      throw error;
    }
  }

  /**
   * Get token info for a specific mint address at a specific timestamp
   * @param mintAddress The token's mint address
   * @param timestamp Optional timestamp for historical data
   */
  async getTokenInfo(mintAddress: string, timestamp?: string | Date | number): Promise<TokenInfoResponse> {
    try {
      return await jupiterRateLimitedService.getTokenInfo(mintAddress, timestamp);
    } catch (error) {
      console.error('Error fetching token info:', error);
      throw error;
    }
  }

  /**
   * Get the price of a token at a specific timestamp
   * @param tokenAddress The token's mint address
   * @param timestamp Optional timestamp for historical price
   */
  async getTokenPriceInUSD(tokenAddress: string, timestamp?: string | Date | number): Promise<number> {
    return await jupiterRateLimitedService.getTokenPriceInUSD(tokenAddress, timestamp);
  }

  /**
   * Get the price of a token in SOL at a specific timestamp
   * @param tokenAddress The token's mint address
   * @param timestamp Optional timestamp for historical price
   */
  async getTokenPriceInSOL(tokenAddress: string, timestamp?: string | Date | number): Promise<number> {
    return await jupiterRateLimitedService.getTokenPriceInSOL(tokenAddress, timestamp);
  }
}

// Export a singleton instance
export const jupiterApiService = new JupiterApiService();