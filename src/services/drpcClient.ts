import axios from 'axios';

export interface TokenBalanceChange {
  tokenAddress: string;
  accountIndex?: number;
  uiAmount: number;
  decimals: number;
  tokenTicker?: string;
  logo?: string | null;
  owner?: string;
}

export interface Transaction {
  signature: string;
  timestamp: number;
  blockTime: number;
  slot: number;
  status: 'success' | 'failed';
  tokenBalanceChanges: TokenBalanceChange[];
  preBalances: number[];
  postBalances: number[];
  meta: any;
  type: string;
  fee?: number;
  logMessages?: string[];
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  lastSignature: string | null;
}

interface TokenBalance {
  mint: string;
  owner: string;
  accountIndex: number;
  uiTokenAmount: {
    amount: string;
    decimals: number;
    uiAmount: number | null;
    uiAmountString: string;
  };
  programId?: string;
  symbol?: string;
  logo?: string;
}

interface RpcSignaturesResponse {
  jsonrpc: string;
  id: number;
  result: Array<{
    signature: string;
    slot: number;
    err: any;
    memo: string | null;
    blockTime: number;
    confirmationStatus: string;
  }>;
  error?: {
    code: number;
    message: string;
  };
}

interface RpcTransactionResponse {
  jsonrpc: string;
  id: number;
  result: {
    blockTime: number;
    meta: {
      err: any;
      fee: number;
      innerInstructions: any[];
      logMessages: string[];
      postBalances: number[];
      postTokenBalances: TokenBalance[];
      preBalances: number[];
      preTokenBalances: TokenBalance[];
      status: { Ok: null } | { Err: any };
    };
    slot: number;
    transaction: {
      message: {
        accountKeys: Array<{
          pubkey: string;
          signer: boolean;
          writable: boolean;
        }>;
        instructions: any[];
        recentBlockhash: string;
      };
      signatures: string[];
    };
  } | null;
  error?: {
    code: number;
    message: string;
  };
}

interface HeliusTransactionResponse {
  signature: string;
  slot: number;
  err: any;
  blockTime: number;
  timestamp: number;
  fee: number;
  success: boolean;
  innerInstructions: any[];
  logMessages: string[];
  postBalances: number[];
  postTokenBalances: TokenBalance[];
  preBalances: number[];
  preTokenBalances: TokenBalance[];
  transaction: {
    message: {
      accountKeys: Array<{
        pubkey: string;
        signer: boolean;
        writable: boolean;
      }>;
      instructions: any[];
      recentBlockhash: string;
    };
    signatures: string[];
  };
}

interface HeliusSignatureResponse {
  signature: string;
  slot: number;
  err: any;
  blockTime: number;
}

interface ApiError {
  code: string;
  message: string;
  endpoint: string;
  params: Record<string, any>;
  timestamp: number;
  status?: number;
}

interface ApiMetadata {
  lastAttempt: number;
  consecutiveFailures: number;
  errors: ApiError[];
}

interface RateLimitConfig {
  maxRequestsPerSecond: number;
  maxConcurrentRequests: number;
}

interface RequestHeaders {
  'Content-Type': string;
  'Authorization'?: string;
  'Alchemy-Subscription'?: string;
  'ankr-chain-id'?: string;
}

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

// Add interface for transaction filter options
interface TransactionFilterOptions {
  from?: Date;
  to?: Date;
  limit?: number;
  before?: string;
}

class DrpcClient {
  // Primary and fallback endpoints with load balancing
  private readonly endpoints = {
    // Use DRPC with the API key in the URL as per documentation
    primary: 'https://lb.drpc.org/ogrpc?network=solana&dkey=AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF',
    fallbacks: []  // Empty as we don't want fallbacks
  };
  
  // API keys stored separately - keeping this for potential future use
  private readonly API_KEYS = {
    DRPC: process.env.NEXT_PUBLIC_DRPC_API_KEY || 'AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF',
  };
  
  // Metadata tracking per endpoint
  private apiMetadata: Map<string, ApiMetadata> = new Map();
  
  // Maximum consecutive failures before considering an endpoint degraded
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  
  // Cooldown period for degraded endpoints (2 minutes)
  private readonly ENDPOINT_COOLDOWN_MS = 2 * 60 * 1000;

  // Timeout for requests (15 seconds)
  private readonly REQUEST_TIMEOUT_MS = 15000;

  // Rate limiting parameters per endpoint
  private readonly RATE_LIMIT: { [key: string]: RateLimitConfig } = {
    'https://lb.drpc.org/ogrpc?network=solana&dkey=AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF': { 
      maxRequestsPerSecond: 10, 
      maxConcurrentRequests: 5 
    }
  };

  private activeRequests: { [key: string]: number } = {};
  private requestQueue: { [key: string]: Array<() => Promise<void>> } = {};
  private lastRequestTime: { [key: string]: number } = {};

  constructor() {
    // Initialize tracking objects for the primary endpoint
    const endpoint = this.endpoints.primary;
    this.activeRequests[endpoint] = 0;
    this.requestQueue[endpoint] = [];
    this.lastRequestTime[endpoint] = 0;
    
    // Initialize metadata for the endpoint
    this.apiMetadata.set(endpoint, {
      lastAttempt: 0,
      consecutiveFailures: 0,
      errors: []
    });

    // Log endpoint configuration
    console.log('DrpcClient initialized with endpoint:', {
      primary: this.endpoints.primary,
      // Add diagnostic info
      rateLimit: this.getEndpointLimits(this.endpoints.primary)
    });
    
    // Check the status of the endpoint at initialization
    this.checkEndpointStatus();
  }
  
  // Update the method to check the status of the endpoint
  private async checkEndpointStatus() {
    const checkEndpoint = async (endpoint: string) => {
      try {
        const payload = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getHealth',
          params: []
        };
        
        await this.makeRequest(endpoint, payload);
        console.log(`Endpoint ${endpoint} is healthy`);
        return true;
      } catch (error) {
        console.warn(`Endpoint ${endpoint} failed health check:`, error);
        return false;
      }
    };
    
    // Check primary endpoint
    const endpoint = this.endpoints.primary;
    const isHealthy = await checkEndpoint(endpoint);
    
    // Log the result
    console.log('Endpoint health check result:', {
      endpoint,
      isHealthy
    });
  }

  private getEndpointLimits(endpoint: string) {
    return this.RATE_LIMIT[endpoint] || { maxRequestsPerSecond: 2, maxConcurrentRequests: 1 };
  }

  private async executeRequest<T>(
    endpoint: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const limits = this.getEndpointLimits(endpoint);
    
    // Check rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - (this.lastRequestTime[endpoint] || 0);
    const minRequestInterval = 1000 / limits.maxRequestsPerSecond;

    if (timeSinceLastRequest < minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, minRequestInterval - timeSinceLastRequest));
    }

    // Check concurrent requests limit
    if ((this.activeRequests[endpoint] || 0) >= limits.maxConcurrentRequests) {
      return new Promise((resolve, reject) => {
        if (!this.requestQueue[endpoint]) {
          this.requestQueue[endpoint] = [];
        }
        this.requestQueue[endpoint].push(async () => {
          try {
            const result = await this.executeRequest(endpoint, requestFn);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    this.activeRequests[endpoint] = (this.activeRequests[endpoint] || 0) + 1;
    this.lastRequestTime[endpoint] = Date.now();

    try {
      const result = await Promise.race([
        requestFn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), this.REQUEST_TIMEOUT_MS)
        )
      ]);
      return result;
    } finally {
      this.activeRequests[endpoint]--;
      if (this.requestQueue[endpoint]?.length > 0) {
        const nextRequest = this.requestQueue[endpoint].shift();
        if (nextRequest) nextRequest();
      }
    }
  }

  private getCurrentEndpoint(): string {
    // We're only using the primary endpoint now
    return this.endpoints.primary;
  }

  private isEndpointDegraded(metadata: ApiMetadata): boolean {
    if (metadata.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES) {
      return false;
    }
    
    // Check if cooldown period has passed
    const cooldownExpired = Date.now() - metadata.lastAttempt > this.ENDPOINT_COOLDOWN_MS;
    return !cooldownExpired;
  }

  private recordApiError(endpoint: string, error: any, params: Record<string, any>) {
    const metadata = this.apiMetadata.get(endpoint) || {
      lastAttempt: 0,
      consecutiveFailures: 0,
      errors: []
    };

    const apiError: ApiError = {
      code: error.response?.status ? `HTTP_${error.response.status}` : 'UNKNOWN',
      message: error.message || 'Unknown error',
      endpoint,
      params,
      timestamp: Date.now(),
      status: error.response?.status
    };

    metadata.lastAttempt = Date.now();
    metadata.consecutiveFailures++;
    metadata.errors.push(apiError);

    // Keep only last 10 errors
    if (metadata.errors.length > 10) {
      metadata.errors = metadata.errors.slice(-10);
    }

    this.apiMetadata.set(endpoint, metadata);

    // Log the error with full context
    console.error('API Error:', {
      error: apiError,
      consecutiveFailures: metadata.consecutiveFailures,
      isEndpointDegraded: this.isEndpointDegraded(metadata)
    });

    return apiError;
  }

  private clearErrorState(endpoint: string) {
    const metadata = this.apiMetadata.get(endpoint);
    if (metadata) {
      metadata.consecutiveFailures = 0;
      this.apiMetadata.set(endpoint, metadata);
    }
  }

  private async makeRequest(endpoint: string, payload: any): Promise<any> {
    const url = endpoint;
    
    // Ensure payload follows the JSON-RPC 2.0 standard
    if (!payload.jsonrpc) {
      payload.jsonrpc = '2.0';
    }
    
    if (!payload.id) {
      payload.id = Date.now();
    }
    
    const config = {
      timeout: this.REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json'
      } as RequestHeaders
    };

    return this.executeRequest(url, async () => {
      try {
        const response = await axios.post<RpcResponse>(url, payload, config);
        
        // Check for RPC-specific error responses
        if (response.data?.error) {
          throw new Error(`RPC Error: ${response.data.error.message || 'Unknown RPC error'}`);
        }
        
        return response.data;
      } catch (error: any) {
        // Enhanced error handling with specific error types
        if (error.code === 'ECONNABORTED') {
          throw new Error(`Request timeout for endpoint ${endpoint}`);
        }
        if (error.response?.status === 429) {
          throw new Error(`Rate limit exceeded for endpoint ${endpoint}`);
        }
        if (error.response?.status === 403) {
          throw new Error(`Access forbidden for endpoint ${endpoint}. Try another RPC provider.`);
        }
        if (error.response?.status === 401) {
          throw new Error(`API key missing or invalid for endpoint ${endpoint}`);
        }
        if (error.response?.status === 400) {
          const message = error.response?.data?.error?.message || error.response?.data?.message || 'Malformed request';
          throw new Error(`Bad request for endpoint ${endpoint} - ${message}`);
        }
        if (error.response?.status === 503) {
          throw new Error(`Service unavailable for endpoint ${endpoint} - The service may be experiencing issues`);
        }
        if (error.response?.status === 502) {
          throw new Error(`Bad gateway for endpoint ${endpoint} - The service may be down`);
        }
        if (error.response?.status >= 500) {
          throw new Error(`Server error (${error.response.status}) for endpoint ${endpoint}`);
        }
        if (error.response?.status >= 400) {
          const errorMessage = error.response.data?.error?.message || error.message;
          throw new Error(`Client error (${error.response.status}) for endpoint ${endpoint}: ${errorMessage}`);
        }
        
        // For network or unknown errors
        throw new Error(`Request failed for endpoint ${endpoint}: ${error.message}`);
      }
    });
  }

  // Helper method to add retry logic to requests
  private async retryableRequest<T>(
    requestFn: (endpoint: string) => Promise<T>,
    context: string,
    params: Record<string, any>
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = 1000; // Start with 1 second delay
    let attemptedEndpoints = new Set<string>();
    
    // Try the endpoint up to 10 times with exponential backoff
    for (let attempt = 0; attempt < 10; attempt++) {
      let currentEndpoint = this.endpoints.primary;
      attemptedEndpoints.add(currentEndpoint);
      
      try {
        const result = await requestFn(currentEndpoint);
        this.clearErrorState(currentEndpoint);
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Record the error for this endpoint
        const apiError = this.recordApiError(currentEndpoint, error, params);
        
        // Handle specific error cases
        if (error.response?.status === 404 || error.response?.status === 204) {
          throw new Error(`NOT_FOUND: Resource not available at ${context}`);
        }

        // For authentication errors (401/403), try with exponential backoff
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.log(`Authentication error with ${currentEndpoint}, retrying after delay`);
        }

        // For rate limit errors, add longer delay
        if (error.response?.status === 429) {
          delay = Math.min(delay * 2, 10000); // Max 10 second delay
        } else {
          // For other errors, use exponential backoff with jitter
          delay = Math.min(delay * (1.5 + Math.random() * 0.5), 5000); // Max 5 second delay
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // If we've tried multiple times and all failed, that's likely a critical issue
    console.error('DRPC endpoint failed after multiple attempts:', {
      attemptedEndpoints: Array.from(attemptedEndpoints),
      lastError
    });
    
    // Return a more user-friendly error message
    throw new Error(`TRANSACTION_FETCH_ERROR: Unable to connect to Solana network after multiple attempts. Please try again later.`);
  }

  async getTransactions(
    address: string,
    limit: number = 10,
    beforeSignature?: string,
    afterTimestamp?: Date
  ): Promise<{
    transactions: Transaction[];
    lastSignature: string | null;
  }> {
    try {
      // First, get signatures for address
      const signaturesResponse = await this.retryableRequest(
        async (endpoint) => {
          const payload = {
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [
              address,
              {
                limit,
                before: beforeSignature
              }
            ]
          };
          return this.makeRequest(endpoint, payload);
        },
        'getSignaturesForAddress',
        { address, limit, beforeSignature }
      );

      if (signaturesResponse.error) {
        throw new Error(`API_ERROR: ${signaturesResponse.error.message}`);
      }

      const signatures = signaturesResponse.result || [];
      if (signatures.length === 0) {
        return { transactions: [], lastSignature: null };
      }

      // With public RPCs, we need to process transactions one at a time to avoid rate limits
      const processedTxs: (Transaction | null)[] = [];
      let lastSignature = null;
      
      // Process up to 5 transactions at a time (batch size)
      const batchSize = 5;
      
      for (let i = 0; i < signatures.length; i += batchSize) {
        const batch = signatures.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchResults = await Promise.all(
          batch.map(async (sig: { signature: string; blockTime: number }) => {
            try {
              // Filter by timestamp if specified
            if (afterTimestamp && sig.blockTime * 1000 <= afterTimestamp.getTime()) {
                return null;
              }
              
              lastSignature = sig.signature;
              
              const txResponse = await this.retryableRequest(
                async (endpoint) => {
                  const payload = {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTransaction',
                    params: [
                      sig.signature,
                      {
                        encoding: 'jsonParsed',
                        maxSupportedTransactionVersion: 0
                      }
                    ]
                  };
                  return this.makeRequest(endpoint, payload);
                },
                'getTransaction',
                { signature: sig.signature }
              );

              if (txResponse.error) {
                console.error('Transaction fetch error:', {
                  signature: sig.signature,
                  error: txResponse.error
                });
                return null;
              }

              const txData = txResponse.result;
              if (!txData) {
                return null;
              }

              // Create transaction object
              return {
                blockTime: txData.blockTime,
                slot: txData.slot,
                signature: sig.signature,
                meta: txData.meta,
                preBalances: txData.meta?.preBalances || [],
                postBalances: txData.meta?.postBalances || [],
                tokenBalanceChanges: this.getTokenBalanceChanges(txData),
                status: txData.meta?.status ? 
                  ('Ok' in txData.meta.status ? 'success' : 'failed') : 
                  'unknown',
                fee: txData.meta?.fee || 0,
                logMessages: txData.meta?.logMessages || [],
                type: this.determineTransactionType(txData),
                timestamp: txData.blockTime * 1000
              } as Transaction;
            } catch (error) {
              console.error('Error processing transaction:', {
                signature: sig.signature,
                error
              });
              return null;
            }
          })
      );

        // Add valid transactions to the result
        processedTxs.push(...batchResults);
        
        // Add a small delay between batches to avoid rate limiting
        if (i + batchSize < signatures.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Filter out null values and limit to requested count
      const validTransactions = processedTxs
        .filter((tx): tx is Transaction => tx !== null)
        .slice(0, limit);
      
      return {
        transactions: validTransactions,
        lastSignature
      };
    } catch (error) {
      // Ensure errors are properly propagated with context
      if (error instanceof Error) {
        throw new Error(`TRANSACTION_FETCH_ERROR: ${error.message}`);
      }
      throw error;
    }
  }

  private getTokenBalanceChanges(txData: any): TokenBalanceChange[] {
    const changes: TokenBalanceChange[] = [];
    
    if (!txData.meta || !txData.meta.preTokenBalances || !txData.meta.postTokenBalances) {
      return changes;
    }
    
    const preBalances = new Map();
    txData.meta.preTokenBalances.forEach((bal: any) => {
      const key = `${bal.mint}:${bal.accountIndex}`;
      preBalances.set(key, {
        amount: bal.uiTokenAmount.uiAmount || 0,
        decimals: bal.uiTokenAmount.decimals
      });
    });
    
    txData.meta.postTokenBalances.forEach((bal: any) => {
      const key = `${bal.mint}:${bal.accountIndex}`;
      const preBal = preBalances.get(key);
      const postBal = bal.uiTokenAmount.uiAmount || 0;
      
      if (preBal) {
        const change = postBal - preBal.amount;
        
        // Only record significant changes
        if (Math.abs(change) > 0.000001) {
          changes.push({
            tokenAddress: bal.mint,
            accountIndex: bal.accountIndex,
            uiAmount: change,
            decimals: bal.uiTokenAmount.decimals
          });
        }
      } else {
        // New token (no pre-balance)
        if (postBal > 0.000001) {
          changes.push({
            tokenAddress: bal.mint,
            accountIndex: bal.accountIndex,
            uiAmount: postBal,
            decimals: bal.uiTokenAmount.decimals
          });
        }
      }
    });
    
    return changes;
  }

  private determineTransactionType(tx: any): string {
    if (!tx.meta?.logMessages?.length) {
      return 'UNKNOWN';
    }
    
    const messages = tx.meta.logMessages;
    
    // Check for token balance changes
    const hasTokenChanges = (tx.meta.preTokenBalances?.length > 0 && tx.meta.postTokenBalances?.length > 0);
    
    if (hasTokenChanges) {
      return this.determineTokenTransactionType(tx, messages);
    }
    
    // Common DEX program IDs and instructions
    const SWAP_INDICATORS = [
      'JUP', // Jupiter
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Whirlpool
      'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr', // Raydium
      'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', // Serum
      'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', // Orca
      'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', // pAMM
      'Instruction: Swap',
      'Instruction: Sell',
      'Instruction: Buy',
      'Program log: Swap',
      'Program log: Trade',
      'Program log: Exchange',
      'Program log: Instruction: Sell'
    ];
    
    // Check for swap indicators
    const isDexTrade = messages.some((msg: string) => 
      SWAP_INDICATORS.some(indicator => msg.includes(indicator))
    );

    if (isDexTrade) {
      return 'SWAP';
    }
    
    // Check for token transfers
    const isTransfer = messages.some((msg: string) => 
      msg.toLowerCase().includes('transfer') || 
      msg.includes('Transfer') ||
      msg.includes('Instruction: TransferChecked')
    );

    if (isTransfer) {
      return 'TRANSFER';
    }

    return 'UNKNOWN';
  }

  private determineTokenTransactionType(tx: any, messages: string[]): string {
    // Check if there are both SOL and token changes, which often indicates a swap
    const hasSOLChange = tx.meta.preBalances[0] !== tx.meta.postBalances[0];
    
    // If only one token is involved, it's likely a transfer
    if (tx.meta.preTokenBalances.length === 1 && tx.meta.postTokenBalances.length === 1) {
      return 'TOKEN_TRANSFER';
    }
    
    // If multiple tokens are involved, it might be a swap
    if (tx.meta.preTokenBalances.length > 0 && tx.meta.postTokenBalances.length > 0) {
      // Check if SOL balance changed significantly along with token changes
      if (hasSOLChange && Math.abs(tx.meta.postBalances[0] - tx.meta.preBalances[0]) > 5000) {
        return 'SWAP';
      }
      
      // Create a map to track token balance changes by mint
      const tokenChanges = new Map<string, number>();
      
      // Process pre-balances
      tx.meta.preTokenBalances.forEach((bal: TokenBalance) => {
        const key = `${bal.mint}-${bal.accountIndex}`;
        tokenChanges.set(key, -(bal.uiTokenAmount.uiAmount || 0));
      });
      
      // Process post-balances
      tx.meta.postTokenBalances.forEach((bal: TokenBalance) => {
        const key = `${bal.mint}-${bal.accountIndex}`;
        const current = tokenChanges.get(key) || 0;
        tokenChanges.set(key, current + (bal.uiTokenAmount.uiAmount || 0));
      });
      
      // Check if we have both positive and negative token changes
      let hasPositive = false;
      let hasNegative = false;
      
      tokenChanges.forEach((change) => {
        if (change > 0) hasPositive = true;
        if (change < 0) hasNegative = true;
      });
      
      if (hasPositive && hasNegative) {
        return 'SWAP';
      }
    }
    
    return 'TOKEN_TRANSFER';
  }

  /**
   * Get transaction details for a specific signature
   * @param signature The transaction signature
   * @returns The transaction details or null if not found
   */
  async getTransaction(signature: string): Promise<Transaction | null> {
    try {
      const endpoint = this.getCurrentEndpoint();
      
      const payload = {
        method: 'getTransaction',
        params: [
          signature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0
          }
        ]
      };
      
      const response = await this.makeRequest(endpoint, payload);
      
      if (!response?.result) {
        console.warn(`No transaction data found for signature: ${signature}`);
        return null;
      }
      
      // Process the transaction data into our Transaction format
      return this.processTransactionData(response.result, signature);
    } catch (error) {
      console.error(`Error fetching transaction ${signature}:`, error);
      throw error;
    }
  }
  
  /**
   * Process raw transaction data into our Transaction format
   * @param data The raw transaction data from RPC
   * @param signature The transaction signature
   * @returns Processed Transaction object
   */
  private processTransactionData(data: any, signature: string): Transaction {
    // Extract token balance changes
    const tokenBalanceChanges: TokenBalanceChange[] = [];
    
    try {
      if (data.meta?.preTokenBalances && data.meta?.postTokenBalances) {
        const preBalances = new Map();
        data.meta.preTokenBalances.forEach((balance: any) => {
          const key = `${balance.mint}:${balance.accountIndex}`;
          preBalances.set(key, balance.uiTokenAmount.uiAmount || 0);
        });
        
        data.meta.postTokenBalances.forEach((balance: any) => {
          const key = `${balance.mint}:${balance.accountIndex}`;
          const preBal = preBalances.get(key) || 0;
          const postBal = balance.uiTokenAmount.uiAmount || 0;
          const change = postBal - preBal;
          
          // Only record significant changes
          if (Math.abs(change) > 0.000001) {
            tokenBalanceChanges.push({
              tokenAddress: balance.mint,
              accountIndex: balance.accountIndex,
              uiAmount: change,
              decimals: balance.uiTokenAmount.decimals,
              tokenTicker: '',
              logo: null,
              owner: balance.owner
            });
          }
        });
      }
    } catch (err) {
      console.error('Error processing token balance changes:', err);
    }
    
    // Create the transaction object
    return {
      signature,
      timestamp: data.blockTime ? data.blockTime * 1000 : Date.now(),
      blockTime: data.blockTime || Math.floor(Date.now() / 1000),
      slot: data.slot || 0,
      status: data.meta?.err ? 'failed' : 'success',
      tokenBalanceChanges,
      preBalances: data.meta?.preBalances || [],
      postBalances: data.meta?.postBalances || [],
      meta: data.meta,
      type: this.determineTransactionType(data),
      fee: data.meta?.fee || 0,
      logMessages: data.meta?.logMessages || []
    };
  }

  /**
   * Get transactions for a specific wallet address with optional time filtering
   * @param walletAddress The wallet address to fetch transactions for
   * @param options Optional filter options (from date, to date, limit, before signature for pagination)
   * @returns Object containing array of processed transactions and lastSignature for pagination
   */
  async getTransactionsByWallet(
    walletAddress: string,
    options: TransactionFilterOptions = {}
  ): Promise<{ transactions: Transaction[], lastSignature: string | null }> {
    try {
      console.log(`Fetching transactions for wallet: ${walletAddress}`, options);
      
      // Calculate limit - we get extra transactions because we'll filter by date later
      const limit = options.limit || 100; // Default to 100 transactions
      // Get more transactions than requested to account for filtering
      const fetchLimit = Math.min(limit * 2, 200);
      
      // Construct the getSignaturesForAddress request with proper pagination support
      const signaturesPayload = {
        method: 'getSignaturesForAddress',
        params: [
          walletAddress,
          {
            limit: fetchLimit,
            ...(options.before && { before: options.before }) // Add before parameter for pagination
          }
        ]
      };
      
      // Get signatures for the wallet
      const endpoint = this.getCurrentEndpoint();
      const signaturesResponse = await this.makeRequest(endpoint, signaturesPayload);
      
      if (!signaturesResponse?.result || !Array.isArray(signaturesResponse.result)) {
        console.warn('No signatures returned for wallet:', walletAddress);
        return { transactions: [], lastSignature: null };
      }
      
      const signatures = signaturesResponse.result;
      console.log(`Retrieved ${signatures.length} signatures for wallet ${walletAddress}`);
      
      // Now fetch the transaction details for each signature
      const transactions: Transaction[] = [];
      let lastSignature: string | null = null;
      
      // Process in batches to avoid rate limits
      const BATCH_SIZE = 5;
      for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
        const batch = signatures.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchPromises = batch.map((sigData: any) => 
          this.getTransaction(sigData.signature)
            .catch((err: Error) => {
              console.error(`Failed to fetch transaction ${sigData.signature}:`, err);
              return null;
            })
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        // Add valid transactions to the result
        for (let j = 0; j < batchResults.length; j++) {
          const tx = batchResults[j];
          const sigData = batch[j];
          
          // Skip null transactions
          if (!tx) continue;
          
          // Apply date filtering
          const txTimestamp = tx.blockTime * 1000; // Convert to milliseconds
          const fromDate = options.from?.getTime();
          const toDate = options.to?.getTime();
          
          // Skip if transaction is before the from date
          if (fromDate && txTimestamp < fromDate) {
            continue;
          }
          
          // Skip if transaction is after the to date
          if (toDate && txTimestamp > toDate) {
            continue;
          }
          
          transactions.push(tx);
          
          // Update lastSignature for pagination (use the signature from the current batch)
          lastSignature = sigData.signature;
          
          // Stop if we have enough transactions after filtering
          if (transactions.length >= limit) {
            break;
          }
        }
        
        // Stop fetching more batches if we have enough transactions
        if (transactions.length >= limit) {
          break;
        }
        
        // Add a small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < signatures.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // If we processed all signatures but didn't reach the limit, 
      // set lastSignature to the last signature for potential next page
      if (transactions.length < limit && signatures.length > 0) {
        lastSignature = signatures[signatures.length - 1].signature;
      }
      
      console.log(`Successfully processed ${transactions.length} transactions for wallet ${walletAddress}`);
      return { transactions, lastSignature };
    } catch (error) {
      console.error('Error in getTransactionsByWallet:', error);
      throw error;
    }
  }
}

export const drpcClient = new DrpcClient();
export default drpcClient; 