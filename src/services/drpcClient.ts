import axios from 'axios';

export interface TokenBalanceChange {
  accountIndex: number;
  mint: string;
  rawTokenAmount: {
    decimals: number;
    uiAmount: number;
    uiAmountString: string;
  };
  tokenAmount: number;
  uiAmount: number;
  decimals: number;
  tokenAddress: string;
  tokenTicker: string;
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

interface APIResponse {
  transactions: Array<{
    blockTime: number;
    slot: number;
    transaction?: {
      signatures: string[];
      message: {
        accountKeys: Array<{
          pubkey: string;
          signer: boolean;
          writable: boolean;
        }>;
      };
    };
    signature?: string;
    meta?: {
      err: any;
      fee: number;
      preBalances: number[];
      postBalances: number[];
      preTokenBalances: TokenBalance[];
      postTokenBalances: TokenBalance[];
      logMessages: string[];
    };
    tokenBalanceChanges?: TokenBalanceChange[];
  }>;
}

class DrpcClient {
  private readonly client;
  private readonly apiEndpoint = '/api/drpc/transactions';

  constructor() {
    this.client = axios.create({
      baseURL: '/api/drpc',
      headers: {
        'Content-Type': 'application/json'
      }
    });
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

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address,
          limit,
          beforeSignature,
          afterTimestamp: afterTimestamp?.getTime()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch transactions');
      }

      const data = await response.json();
      
      if (!data.transactions) {
        console.error('DrpcClient: Invalid response format:', data);
        throw new Error('Invalid response format from API');
      }

      console.log('DrpcClient: Received', data.transactions.length, 'transactions');
      
      return {
        transactions: data.transactions,
        lastSignature: data.lastSignature
      };
    } catch (error) {
      console.error('DrpcClient: Error fetching transactions:', error);
      throw error;
    }
  }

  private determineTransactionType(tx: APIResponse['transactions'][0]): string {
    if (!tx.meta?.logMessages?.length) {
      console.log('DrpcClient: No log messages found for transaction');
      return 'UNKNOWN';
    }
    
    const messages = tx.meta.logMessages;
    console.log('DrpcClient: Analyzing log messages:', messages);
    
    // Check for token balance changes
    const hasTokenChanges = tx.tokenBalanceChanges?.length > 0 || 
                           (tx.meta.preTokenBalances?.length > 0 && tx.meta.postTokenBalances?.length > 0);
    
    // If we have token changes, try to determine the type based on the token activity
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
    const isDexTrade = messages.some(msg => 
      SWAP_INDICATORS.some(indicator => msg.includes(indicator))
    );

    if (isDexTrade) {
      console.log('DrpcClient: Identified as SWAP transaction');
      return 'SWAP';
    }
    
    // Check for token transfers
    const isTransfer = messages.some(msg => 
      msg.toLowerCase().includes('transfer') || 
      msg.includes('Transfer') ||
      msg.includes('Instruction: TransferChecked')
    );

    if (isTransfer) {
      console.log('DrpcClient: Identified as TRANSFER transaction');
      return 'TRANSFER';
    }

    console.log('DrpcClient: Could not identify transaction type');
    return 'UNKNOWN';
  }

  private determineTokenTransactionType(tx: APIResponse['transactions'][0], messages: string[]): string {
    // Try to determine the type based on token changes
    if (!tx.tokenBalanceChanges || tx.tokenBalanceChanges.length === 0) {
      return 'TOKEN_TRANSFER';
    }
    
    // Check if there are both SOL and token changes, which often indicates a swap
    const hasSOLChange = tx.tokenBalanceChanges && tx.tokenBalanceChanges.some(
      change => change.tokenAddress === 'So11111111111111111111111111111111111111112'
    );
    
    const hasOtherTokenChange = tx.tokenBalanceChanges && tx.tokenBalanceChanges.some(
      change => change.tokenAddress !== 'So11111111111111111111111111111111111111112'
    );
    
    if (hasSOLChange && hasOtherTokenChange) {
      return 'SWAP';
    }
    
    // If only one token is involved, it's likely a transfer
    if (tx.tokenBalanceChanges && tx.tokenBalanceChanges.length === 1) {
      return 'TOKEN_TRANSFER';
    }
    
    // If multiple tokens are involved, it might be a swap
    if (tx.tokenBalanceChanges && tx.tokenBalanceChanges.length > 1) {
      // Check if it's a swap by looking for one positive and one negative change
      const hasPositiveChange = tx.tokenBalanceChanges.some(change => change.uiAmount > 0);
      const hasNegativeChange = tx.tokenBalanceChanges.some(change => change.uiAmount < 0);
      
      if (hasPositiveChange && hasNegativeChange) {
        return 'SWAP';
      }
    }
    
    return 'TOKEN_TRANSFER';
  }
}

export const drpcClient = new DrpcClient();
export default drpcClient; 