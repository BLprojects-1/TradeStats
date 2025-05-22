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
  marketCap?: number;
}

export interface TokenPriceResponse {
  priceUsd: number;
  priceSol: number;
  timestamp: number;
}

// Mock data for development when APIs are unavailable
const mockTokenInfo: Record<string, TokenInfoResponse> = {
  // Some common tokens for development
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    marketCap: 25000000000
  },
  'So11111111111111111111111111111111111111112': {
    address: 'So11111111111111111111111111111111111111112',
    name: 'Wrapped SOL',
    symbol: 'SOL',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    marketCap: 50000000000
  },
  // Default for unknown tokens
  'default': {
    address: 'unknown',
    name: 'Unknown Token',
    symbol: 'UNKNOWN',
    decimals: 9,
    logoURI: '',
    marketCap: 0
  }
};

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const USE_MOCK_DATA = isDevelopment;

// Updated Jupiter API response interfaces
interface JupiterPriceData {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

interface JupiterPriceResponse {
  data: {
    [key: string]: JupiterPriceData;
  };
}

export interface JupiterTokensResponse {
  tokens: {
    [key: string]: TokenInfoResponse;
  };
}

class JupiterApiService {
  // Updated API endpoints as per Jupiter docs
  private readonly priceApiUrl = 'https://price.jup.ag/v4';
  private readonly tokenApiUrl = 'https://token.jup.ag/all';

  /**
   * Get mock token info during development
   */
  private getMockTokenInfo(mintAddress: string): TokenInfoResponse {
    console.log(`Using mock data for token: ${mintAddress}`);
    return mockTokenInfo[mintAddress] || {
      ...mockTokenInfo.default,
      address: mintAddress,
      symbol: `TOKEN-${mintAddress.slice(0, 4)}`
    };
  }

  /**
   * Get mock price data during development
   */
  private getMockPriceData(tokenAddress: string, blockTime: number): TokenPriceResponse {
    // Generate pseudo-random but consistent price for each token
    const hash = tokenAddress.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Random price between $0.01 and $100
    const randomPrice = Math.abs(hash % 10000) / 100;
    
    console.log(`Using mock price for token: ${tokenAddress} - $${randomPrice}`);
    
    return {
      priceUsd: randomPrice,
      priceSol: randomPrice / 50, // Assume SOL is around $50
      timestamp: blockTime
    };
  }

  /**
   * Fetches price data for a token from Jupiter's API
   */
  async fetchTokenPrice(tokenAddress: string, blockTime: number): Promise<TokenPriceResponse> {
    try {
      if (USE_MOCK_DATA) {
        return this.getMockPriceData(tokenAddress, blockTime);
      }

      // Get token price in USD
      const response = await axios.get<JupiterPriceResponse>(`${this.priceApiUrl}/price`, {
        params: {
          ids: tokenAddress
        }
      });

      // Check if we got a valid response with token price data
      if (!response.data || !response.data.data || !response.data.data[tokenAddress]) {
        console.warn(`No price data found for token: ${tokenAddress}`);
        return {
          priceUsd: 0,
          priceSol: 0,
          timestamp: blockTime
        };
      }

      const tokenPriceInUsd = response.data.data[tokenAddress].price || 0;

      // Get SOL price to calculate priceSol
      let priceSol = 0;
      if (tokenPriceInUsd > 0) {
        const solResponse = await axios.get<JupiterPriceResponse>(`${this.priceApiUrl}/price`, {
          params: {
            ids: 'So11111111111111111111111111111111111111112'
          }
        });
        
        const solData = solResponse.data.data;
        const solPriceUsd = solData?.So11111111111111111111111111111111111111112?.price || 0;
        
        // Calculate price in SOL
        priceSol = solPriceUsd > 0 ? tokenPriceInUsd / solPriceUsd : 0;
      }

      return {
        priceUsd: tokenPriceInUsd,
        priceSol,
        timestamp: blockTime
      };
    } catch (error) {
      console.error('Error fetching token price:', error);
      // Return zero values instead of throwing error to allow the app to continue
      return {
        priceUsd: 0,
        priceSol: 0,
        timestamp: blockTime
      };
    }
  }

  // Cache for token info to avoid repeated API calls
  private tokenInfoCache: Map<string, TokenInfoResponse> = new Map();
  private allTokensPromise: Promise<JupiterTokensResponse> | null = null;

  /**
   * Fetches all token information from Jupiter's API
   */
  private async fetchAllTokens(): Promise<JupiterTokensResponse> {
    if (!this.allTokensPromise) {
      // Use type assertion to work around TypeScript's complaint about Promise compatibility
      this.allTokensPromise = (axios.get<JupiterTokensResponse>(this.tokenApiUrl)
        .then(response => response.data)
        .catch(error => {
          console.error('Error fetching token list:', error);
          this.allTokensPromise = null; // Reset so we can try again
          return { tokens: {} } as JupiterTokensResponse;
        })) as Promise<JupiterTokensResponse>;
    }
    
    try {
      // Type assertion to satisfy TypeScript
      const response = await this.allTokensPromise as JupiterTokensResponse;
      return response;
    } catch (error) {
      // This shouldn't happen since we're already catching in the promise above,
      // but just in case
      console.error('Error resolving token list promise:', error);
      this.allTokensPromise = null;
      return { tokens: {} } as JupiterTokensResponse;
    }
  }

  /**
   * Fetches token information from Jupiter's API
   */
  async fetchTokenInfo(mintAddress: string): Promise<TokenInfoResponse | null> {
    try {
      if (USE_MOCK_DATA) {
        return this.getMockTokenInfo(mintAddress);
      }

      // Check cache first
      if (this.tokenInfoCache.has(mintAddress)) {
        return this.tokenInfoCache.get(mintAddress) || null;
      }
      
      // Fetch all tokens if needed
      const allTokens = await this.fetchAllTokens();
      
      // Find the token in the list
      const tokenInfo = allTokens.tokens[mintAddress];
      
      if (tokenInfo) {
        // Cache the result
        this.tokenInfoCache.set(mintAddress, tokenInfo);
        return tokenInfo;
      }
      
      console.warn(`Token info not found for ${mintAddress}`);
      return null;
    } catch (error) {
      console.error(`Error fetching token info for ${mintAddress}:`, error);
      return null; // Return null instead of throwing to allow the app to continue
    }
  }
}

// Export a singleton instance
export const jupiterApiService = new JupiterApiService();