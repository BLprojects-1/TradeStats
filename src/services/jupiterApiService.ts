import axios from 'axios';

interface QuoteResponse {
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

interface TokenInfoResponse {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags?: string[];
  daily_volume?: number;
  created_at?: string;
  freeze_authority?: string | null;
  mint_authority?: string | null;
  permanent_delegate?: string | null;
  minted_at?: string | null;
  extensions?: {
    coingeckoId?: string;
  };
}

// In-memory cache to reduce API calls
interface CacheEntry {
  timestamp: number;
  priceUsd: number;
}

// Add a new cache for token info
interface TokenInfoCacheEntry {
  timestamp: number;
  tokenInfo: TokenInfoResponse;
}

interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  blockTime?: number;
}

interface JupiterQuoteResponse {
  outAmount: string;
  inAmount: string;
  // Add other fields as needed
}

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

class JupiterApiService {
  private readonly client;
  private readonly v6BaseUrl = 'https://quote-api.jup.ag/v6';
  private readonly v5BaseUrl = 'https://quote-api.jup.ag/v5';
  private readonly tokenApiBaseUrl = 'https://lite-api.jup.ag/tokens/v1';
  private readonly priceApiBaseUrl = 'https://price.jup.ag/v4';
  private readonly cache = new Map<string, CacheEntry>();
  private readonly tokenInfoCache = new Map<string, TokenInfoCacheEntry>();
  // Cache validity period - 5 minutes
  private readonly CACHE_TTL = 5 * 60 * 1000;
  // Token info cache validity period - 30 minutes (longer as token info changes less frequently)
  private readonly TOKEN_INFO_CACHE_TTL = 30 * 60 * 1000;

  constructor() {
    // Initialize with v6 client by default
    this.client = axios.create({
      baseURL: this.v6BaseUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Fetches price data for a token
   * @param tokenAddress The SPL token mint address
   * @param blockTime Optional Unix timestamp for historical pricing
   * @returns Price in USD or null if not found
   */
  async fetchTokenPrice(tokenAddress: string, blockTime: number): Promise<{ priceUsd: number; timestamp: number }> {
    try {
      const response = await axios.get<{ data: { [key: string]: { price: number } } }>(
        `${this.priceApiBaseUrl}/price`,
        {
          params: {
            ids: tokenAddress,
            vsToken: 'SOL'
          }
        }
      );

      const priceData = response.data.data[tokenAddress];
      return {
        priceUsd: priceData?.price || 0,
        timestamp: blockTime
      };
    } catch (error) {
      console.error('Jupiter API: Error fetching price for', tokenAddress, ':', error);
      return {
        priceUsd: 0,
        timestamp: blockTime
      };
    }
  }

  /**
   * Fetches token information from Jupiter API
   * @param mintAddress The SPL token mint address
   * @returns Object with token symbol, name, logo, etc. or null if not found
   */
  async fetchTokenInfo(mintAddress: string): Promise<TokenInfoResponse | null> {
    try {
      console.log(`Jupiter API: Fetching token info for ${mintAddress}`);
      
      // Check cache first
      const cacheKey = `info:${mintAddress}`;
      const cachedData = this.tokenInfoCache.get(cacheKey);
      const now = Date.now();
      
      if (cachedData && (now - cachedData.timestamp) < this.TOKEN_INFO_CACHE_TTL) {
        console.log(`Jupiter API: Using cached token info for ${mintAddress} - symbol: "${cachedData.tokenInfo.symbol}"`);
        return cachedData.tokenInfo;
      }
      
      // Fetch token info from Jupiter API
      console.log(`Jupiter API: Making request to ${this.tokenApiBaseUrl}/token/${mintAddress}`);
      
      const response = await axios.get<TokenInfoResponse>(
        `${this.tokenApiBaseUrl}/token/${mintAddress}`
      );
      
      if (response.data) {
        console.log(`Jupiter API: Found token info for ${mintAddress}:`, {
          symbol: `"${response.data.symbol}"`,
          name: `"${response.data.name}"`,
          logoExists: !!response.data.logoURI
        });
        
        // Cache the result
        this.tokenInfoCache.set(cacheKey, {
          timestamp: now,
          tokenInfo: response.data
        });
        
        return response.data;
      }
      
      console.log(`Jupiter API: No token info found for ${mintAddress}`);
      return null;
      
    } catch (error: any) {
      console.error(`Jupiter API: Error fetching token info for ${mintAddress}:`, error.message);
      
      // Log more details about the error for debugging
      if (error.response) {
        console.error('Jupiter API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('Jupiter API No Response:', error.request);
      }
      
      return null;
    }
  }
}

// Export a singleton instance
export const jupiterApiService = new JupiterApiService();