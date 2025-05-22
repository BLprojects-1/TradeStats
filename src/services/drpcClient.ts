import axios from 'axios';

export interface TokenBalanceChange {
  accountIndex: number;
  mint?: string;  // Made optional since tokenAddress is used instead
  rawTokenAmount?: {
    decimals: number;
    uiAmount: number;
    uiAmountString: string;
  };
  tokenAmount?: number;
  uiAmount: number;
  decimals: number;
  tokenAddress: string;
  tokenTicker?: string;
  logo?: string;
  priceUSD?: number;
  marketCap?: number;
  owner?: string;
  isUserAccount?: boolean;
}

export interface Transaction {
  blockTime: number;
  slot: number;
  signature: string;
  transaction?: {
    signatures: string[];
  };
  meta?: {
    err: any;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances: TokenBalance[];
    postTokenBalances: TokenBalance[];
    logMessages: string[];
  };
  preBalances: number[];
  postBalances: number[];
  tokenBalanceChanges: TokenBalanceChange[];
  status: string;
  fee: number;
  logMessages: string[];
  type?: string;
  timestamp?: number;
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

class DrpcClient {
  // Use public Solana endpoint from dRPC
  private readonly drpcEndpoint = 'https://solana.drpc.org';
  
  // Use fallback Helius endpoint as backup
  private readonly heliusApiKey = '5e3b23ae-8354-4476-ba0b-de37820a8d57';
  private readonly heliusEndpoint = `https://api.helius.xyz/v0/addresses`;

  // Maximum retries for failed requests
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // ms

  // Helper method to add retry logic to axios requests
  private async retryableRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Request failed (attempt ${attempt + 1}/${this.MAX_RETRIES}):`, error);
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, attempt)));
      }
    }
    
    throw lastError || new Error('Request failed after maximum retries');
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
      console.log('DrpcClient: Fetching transactions for', address, {
        limit,
        beforeSignature: beforeSignature || 'none',
        afterTimestamp: afterTimestamp?.toISOString() || 'none'
      });

      // First, get signatures for address
      let signaturesResponse: RpcSignaturesResponse;
      try {
        signaturesResponse = await this.retryableRequest(async () => {
          const response = await axios.post(this.drpcEndpoint, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [
              address,
              {
                limit: limit,
                before: beforeSignature
              }
            ]
          });
          return response.data as RpcSignaturesResponse;
        });
      } catch (error) {
        console.error("Failed to get signatures:", error);
        throw new Error(`Could not fetch transaction signatures: ${error}`);
      }

      if (signaturesResponse.error) {
        throw new Error(`dRPC API error: ${signaturesResponse.error.message}`);
      }

      const signatures = signaturesResponse.result || [];
      console.log('DrpcClient: Found', signatures.length, 'signatures');

      if (signatures.length === 0) {
        return {
          transactions: [],
          lastSignature: null
        };
      }

      // Process transactions based on signatures
      const processedTxs = await Promise.all(
        signatures
          .filter((sig) => {
            // Filter by timestamp if afterTimestamp is provided
            if (afterTimestamp && sig.blockTime * 1000 <= afterTimestamp.getTime()) {
              return false;
            }
            return true;
          })
          .map(async (sig) => {
            try {
              // Get full transaction for each signature
              let txResponse: RpcTransactionResponse;
              try {
                txResponse = await this.retryableRequest(async () => {
                  const response = await axios.post(this.drpcEndpoint, {
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
                  });
                  return response.data as RpcTransactionResponse;
                });
              } catch (error) {
                console.error(`Failed to get transaction ${sig.signature}:`, error);
                return null;
              }

              if (txResponse.error) {
                console.error('DrpcClient: Error fetching transaction:', sig.signature, txResponse.error);
                return null;
              }

              const txData = txResponse.result;
              if (!txData) {
                return null;
              }

              // Process token balance changes
              const tokenBalanceChanges = this.processTokenBalanceChanges(txData.meta);

              // Determine transaction status
              const status = txData.meta?.status ? 
                ('Ok' in txData.meta.status ? 'success' : 'failed') : 
                'unknown';

              // Create a processed transaction object
              const transaction: Transaction = {
                blockTime: txData.blockTime,
                slot: txData.slot,
                signature: sig.signature,
                preBalances: txData.meta?.preBalances || [],
                postBalances: txData.meta?.postBalances || [],
                meta: {
                  err: txData.meta?.err,
                  fee: txData.meta?.fee || 0,
                  preBalances: txData.meta?.preBalances || [],
                  postBalances: txData.meta?.postBalances || [],
                  preTokenBalances: txData.meta?.preTokenBalances || [],
                  postTokenBalances: txData.meta?.postTokenBalances || [],
                  logMessages: txData.meta?.logMessages || []
                },
                tokenBalanceChanges: tokenBalanceChanges,
                status: status,
                fee: txData.meta?.fee || 0,
                logMessages: txData.meta?.logMessages || [],
                type: this.determineTransactionType(txData),
                timestamp: txData.blockTime * 1000 // Convert to milliseconds
              };
              
              return transaction;
            } catch (error) {
              console.error('DrpcClient: Error processing transaction:', sig.signature, error);
              return null;
            }
          })
      );

      // Filter out null transactions (errors)
      const validTransactions = processedTxs.filter((tx): tx is Transaction => tx !== null);
      
      console.log('DrpcClient: Processed', validTransactions.length, 'valid transactions');
      
      return {
        transactions: validTransactions,
        lastSignature: signatures.length > 0 ? 
          signatures[signatures.length - 1].signature : null
      };
    } catch (error) {
      console.error('DrpcClient: Error fetching transactions:', error);
      throw new Error('Failed to fetch transactions');
    }
  }

  private processTokenBalanceChanges(meta: any): TokenBalanceChange[] {
    if (!meta || !meta.preTokenBalances || !meta.postTokenBalances) {
      return [];
    }

    const changes: TokenBalanceChange[] = [];
    
    // Create a map of pre-balances by mint and account
    const preBalMap = new Map<string, TokenBalance>();
    meta.preTokenBalances.forEach((bal: TokenBalance) => {
      preBalMap.set(`${bal.mint}-${bal.accountIndex}`, bal);
    });
    
    // Process post balances and compare with pre-balances
    meta.postTokenBalances.forEach((postBal: TokenBalance) => {
      const key = `${postBal.mint}-${postBal.accountIndex}`;
      const preBal = preBalMap.get(key);
      
      const preAmount = preBal?.uiTokenAmount?.uiAmount || 0;
      const postAmount = postBal.uiTokenAmount?.uiAmount || 0;
      
      // Skip if no change
      if (Math.abs(postAmount - preAmount) < 0.000001) {
        return;
      }
      
      changes.push({
        tokenAddress: postBal.mint,
        mint: postBal.mint,
        tokenTicker: postBal.symbol || 'Unknown',
        decimals: postBal.uiTokenAmount.decimals,
        uiAmount: postAmount - preAmount,
        logo: postBal.logo || '',
        accountIndex: postBal.accountIndex,
        owner: postBal.owner
      });
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
}

export const drpcClient = new DrpcClient();
export default drpcClient; 