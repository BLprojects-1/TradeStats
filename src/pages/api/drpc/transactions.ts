import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Use environment variable for DRPC API key with a fallback for development
const FALLBACK_DRPC_API_KEY = 'AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF';
const DRPC_API_KEY = process.env.DRPC_API_KEY || FALLBACK_DRPC_API_KEY;
const DRPC_ENDPOINT = `https://lb.drpc.org/ogrpc?network=solana&dkey=${DRPC_API_KEY}`;

// Check if we're using the fallback API key
if (DRPC_API_KEY === FALLBACK_DRPC_API_KEY) {
  console.warn('WARNING: Using fallback DRPC API key. Set DRPC_API_KEY in your .env file for production use.');
}

// This is a fallback Helius API key for development - ideally you should set your own in .env
const FALLBACK_HELIUS_API_KEY = '5e3b23ae-8354-4476-ba0b-de37820a8d57';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || FALLBACK_HELIUS_API_KEY;

// Check if we're using the fallback API key
if (HELIUS_API_KEY === FALLBACK_HELIUS_API_KEY) {
  console.warn('WARNING: Using fallback Helius API key. Set HELIUS_API_KEY in your .env file for production use.');
}

// Token cache to reduce API calls
const tokenInfoCache = new Map<string, {symbol: string, name: string, logo: string}>();

// Helper function to get token info
async function getTokenInfo(mint: string) {
  // Return from cache if available
  if (tokenInfoCache.has(mint)) {
    console.log(`API: Using cached token info for ${mint}: ${tokenInfoCache.get(mint)?.symbol}`);
    return tokenInfoCache.get(mint)!;
  }

  try {
    console.log(`API: Fetching token info for ${mint} from Helius API`);
    const tokenInfoUrl = `https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`;
    
    // Log Helius API key (masked for security)
    const maskedApiKey = HELIUS_API_KEY.slice(0, 4) + '...' + HELIUS_API_KEY.slice(-4);
    console.log(`API: Using Helius API key: ${maskedApiKey}`);
    
    const response = await axios.post(tokenInfoUrl, { 
      mintAccounts: [mint] 
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`API: Received token info response for ${mint}:`, JSON.stringify(response.data));
    
    const data = response.data as Array<{
      onChainMetadata?: {
        metadata?: {
          data?: {
            symbol?: string;
            name?: string;
          }
        }
      };
      legacyMetadata?: {
        symbol?: string;
        name?: string;
        logoURI?: string;
      }
    }>;
    
    if (data && data.length > 0 && data[0]) {
      const tokenInfo = {
        symbol: data[0].onChainMetadata?.metadata?.data?.symbol || 
               data[0].legacyMetadata?.symbol || 'Unknown',
        name: data[0].onChainMetadata?.metadata?.data?.name || 
              data[0].legacyMetadata?.name || 'Unknown Token',
        logo: data[0].legacyMetadata?.logoURI || ''
      };
      
      console.log(`API: Successfully parsed token info for ${mint}: ${tokenInfo.symbol}`);
      
      // Save to cache
      tokenInfoCache.set(mint, tokenInfo);
      return tokenInfo;
    }
    
    console.log(`API: No valid token info found for ${mint}, using default`);
    const defaultInfo = { symbol: 'Unknown', name: 'Unknown Token', logo: '' };
    tokenInfoCache.set(mint, defaultInfo);
    return defaultInfo;
  } catch (error) {
    console.error(`API: Error fetching token info for ${mint}:`, error);
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: any } };
      console.error('API: Token info request error details:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data
      });
    }
    const defaultInfo = { symbol: 'Unknown', name: 'Unknown Token', logo: '' };
    tokenInfoCache.set(mint, defaultInfo);
    return defaultInfo;
  }
}

interface TokenBalance {
  mint: string;
  owner?: string;
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

interface TokenBalanceChange {
  tokenAddress: string;
  tokenTicker: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  logo?: string;
  accountIndex?: number;
  owner?: string;
  isUserAccount?: boolean;
}

interface DRPCResponse {
  jsonrpc: string;
  id: number;
  result: any;
  error?: {
    code: number;
    message: string;
  };
}

interface TransactionMeta {
  err: any;
  fee: number;
  preBalances: number[];
  postBalances: number[];
  preTokenBalances: TokenBalance[];
  postTokenBalances: TokenBalance[];
  logMessages: string[];
}

interface Transaction {
  blockTime: number;
  slot: number;
  meta: TransactionMeta;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, limit = 10, beforeSignature, afterTimestamp } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    console.log('API: Fetching signatures for address:', address, 'limit:', limit, 'beforeSignature:', beforeSignature, 'afterTimestamp:', afterTimestamp);
    
    // First request to get signatures
    let signaturesResponse: { data: DRPCResponse };
    try {
      signaturesResponse = await axios.post<DRPCResponse>(DRPC_ENDPOINT, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [
          address,
          {
            limit: parseInt(String(limit), 10),
            before: beforeSignature || undefined
          }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error: any) {
      console.error('API: DRPC request failed:', error.message);
      if (error.response?.data?.error) {
        console.error('API: DRPC error details:', error.response.data.error);
      }
      throw new Error(`DRPC API error: ${error.message}`);
    }

    if (signaturesResponse.data.error) {
      const errorMessage = signaturesResponse.data.error.message;
      console.error('API: DRPC API error for signatures:', errorMessage);
      if (errorMessage.includes('Invalid API key') || errorMessage.includes('unauthorized')) {
        return res.status(401).json({ 
          error: 'DRPC API key is invalid or expired',
          details: 'Please check your DRPC API key configuration'
        });
      }
      return res.status(400).json({ error: errorMessage });
    }

    const signatures = signaturesResponse.data.result;
    if (!Array.isArray(signatures)) {
      console.error('API: Invalid signatures response:', signatures);
      return res.status(500).json({ 
        error: 'Invalid response format from DRPC API',
        details: 'Expected an array of signatures but received something else'
      });
    }

    console.log('API: Found', signatures.length, 'signatures');

    // Get transaction details for each signature
    const transactions = await Promise.all(
      signatures.map(async (sig: { signature: string; blockTime: number }) => {
        try {
          // If we have an afterTimestamp and this transaction is older, skip it
          if (afterTimestamp && sig.blockTime * 1000 <= afterTimestamp) {
            console.log('API: Skipping older transaction:', sig.signature);
            return null;
          }

          console.log('API: Fetching transaction details for signature:', sig.signature);
          const txResponse = await axios.post<DRPCResponse>(DRPC_ENDPOINT, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [
              sig.signature,
              {
                encoding: 'jsonParsed',
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed',
                rewards: false,
                accounts: {
                  encoding: 'jsonParsed',
                  addresses: [address]
                }
              }
            ]
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (txResponse.data.error) {
            console.error('API: dRPC API error for transaction:', sig.signature, txResponse.data.error);
            return null;
          }

          const tx = txResponse.data.result as Transaction;
          if (!tx || !tx.meta) {
            console.log('API: No transaction data for signature:', sig.signature);
            return null;
          }

          // Log the raw transaction data for debugging
          console.log('API: Raw transaction data:', JSON.stringify(tx, null, 2));

          const transaction = {
            blockTime: tx.blockTime,
            slot: tx.slot,
            signature: sig.signature,
            preBalances: tx.meta.preBalances || [],
            postBalances: tx.meta.postBalances || [],
            meta: {
              err: tx.meta.err,
              fee: tx.meta.fee,
              preBalances: tx.meta.preBalances,
              postBalances: tx.meta.postBalances,
              preTokenBalances: tx.meta.preTokenBalances,
              postTokenBalances: tx.meta.postTokenBalances,
              logMessages: tx.meta.logMessages
            },
            tokenBalanceChanges: await parseTokenBalanceChanges(tx),
            solBalanceChange: tx.meta.preBalances && tx.meta.postBalances ? 
              (tx.meta.postBalances[0] - tx.meta.preBalances[0]) / 1e9 : 0, // Convert lamports to SOL
            status: tx.meta.err ? 'failed' : 'success',
            fee: tx.meta.fee || 0,
            logMessages: tx.meta.logMessages || [],
            type: determineTransactionType(tx),
            timestamp: tx.blockTime * 1000 // Convert to milliseconds
          };

          console.log('API: Processed transaction:', {
            signature: transaction.signature,
            type: transaction.type,
            status: transaction.status,
            tokenBalanceChanges: transaction.tokenBalanceChanges
          });

          return transaction;
        } catch (error) {
          console.error('API: Error fetching transaction:', sig.signature, error);
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status?: number; data?: any; message?: string } };
            console.error('API: Request error details:', {
              status: axiosError.response?.status,
              data: axiosError.response?.data,
              message: axiosError.response?.message
            });
          }
          return null;
        }
      })
    );

    // Filter out any failed transaction fetches and transactions before afterTimestamp
    const validTransactions = transactions.filter(tx => tx !== null);
    console.log('API: Returning', validTransactions.length, 'valid transactions');

    // Use the last valid transaction's signature for lastSignature in response
    const lastSignature = validTransactions.length > 0 
      ? validTransactions[validTransactions.length - 1].signature 
      : null;

    return res.status(200).json({ 
      transactions: validTransactions,
      lastSignature
    });
  } catch (error) {
    console.error('API: Error in handler:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: any; message?: string } };
      console.error('API: Request error details:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.response?.message
      });
      return res.status(axiosError.response?.status || 500).json({ 
        error: 'Failed to fetch transactions',
        details: axiosError.response?.data || 'Unknown error'
      });
    }
    return res.status(500).json({ 
      error: 'Failed to fetch transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Helper function to parse token balance changes
async function parseTokenBalanceChanges(tx: Transaction): Promise<TokenBalanceChange[]> {
  try {
    const changes: TokenBalanceChange[] = [];
    
    if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
      console.log('API: No token balances found in transaction');
      return changes;
    }

    // Get the transaction signature from where it's available
    const txSignature = 'signature' in tx ? tx.signature : 'unknown';
    console.log('API: Parsing token balances for transaction:', txSignature);

    // Categorize pre-balances by mint and account index for precise matching
    const preBalances = new Map(
      tx.meta.preTokenBalances.map((b: TokenBalance) => [`${b.mint}:${b.accountIndex}`, b])
    );

    // Get all token mint addresses that have changed
    const tokenPromises: Promise<void>[] = [];
    const tokenChanges: TokenBalanceChange[] = [];

    // Identify user addresses - typically the first few accounts in the transaction
    // For swaps, the user's address is often among the first accounts
    const userAddresses = new Set<string>();
    const topOwners = tx.meta.preTokenBalances
      .slice(0, 3) // First 3 accounts are often user accounts
      .map(b => b.owner)
      .filter(Boolean);
    
    topOwners.forEach(owner => {
      if (owner) userAddresses.add(owner);
    });
    
    console.log('API: Potential user addresses:', Array.from(userAddresses));
    
    for (const postBalance of tx.meta.postTokenBalances) {
      // Get the matching pre-balance by mint AND account index
      const preBalance = preBalances.get(`${postBalance.mint}:${postBalance.accountIndex}`);
      const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postAmount = postBalance.uiTokenAmount?.uiAmount || 0;
      const uiAmount = postAmount - preAmount;
      
      // Skip unchanged balances or very small changes that are likely dust
      if (Math.abs(uiAmount) < 0.000001) {
        continue;
      }
      
      console.log(`API: Token balance change detected for ${postBalance.mint}:`, {
        accountIndex: postBalance.accountIndex,
        owner: postBalance.owner || 'unknown',
        isUserAccount: postBalance.owner ? userAddresses.has(postBalance.owner) : false,
        preAmount,
        postAmount,
        change: uiAmount
      });
      
      // Create a placeholder for this token change
      const tokenChange: TokenBalanceChange = {
        tokenAddress: postBalance.mint,
        tokenTicker: 'Unknown', // Will be updated with real info
        amount: Number(postBalance.uiTokenAmount.amount) - (Number(preBalance?.uiTokenAmount?.amount) || 0),
        decimals: postBalance.uiTokenAmount.decimals,
        uiAmount,
        logo: '',
        accountIndex: postBalance.accountIndex,
        owner: postBalance.owner,
        isUserAccount: postBalance.owner ? userAddresses.has(postBalance.owner) : false
      };
      
      // Add to our changes array
      tokenChanges.push(tokenChange);
      
      // Always fetch token info to make sure we have proper symbols
      const promise = (async () => {
        try {
          // Get token info from Helius API
          const tokenInfo = await getTokenInfo(postBalance.mint);
          
          // Update our token change with the fetched info
          tokenChange.tokenTicker = tokenInfo.symbol;
          tokenChange.logo = tokenInfo.logo;
          
          console.log(`API: Updated token info for ${postBalance.mint}: ${tokenInfo.symbol}`);
        } catch (err) {
          console.error(`API: Error updating token info for ${postBalance.mint}:`, err);
        }
      })();
      
      tokenPromises.push(promise);
    }
    
    // Wait for all token info fetches to complete
    if (tokenPromises.length > 0) {
      console.log(`API: Waiting for ${tokenPromises.length} token info requests to complete...`);
      await Promise.all(tokenPromises);
    }

    // Add all the enriched token changes to our final changes array
    changes.push(...tokenChanges);

    console.log('API: Parsed token balance changes with enriched info:', 
      changes.map(c => ({ 
        token: c.tokenAddress, 
        symbol: c.tokenTicker,
        accountIndex: c.accountIndex,
        owner: c.owner ? c.owner.substring(0, 6) + '...' : 'unknown',
        isUserAccount: c.isUserAccount,
        amount: c.uiAmount
      }))
    );
    
    return changes;
  } catch (error) {
    console.error('API: Error parsing token balances:', error);
    return [];
  }
}

// Helper function to determine transaction type
function determineTransactionType(tx: Transaction): string {
  try {
    // First check if we have the balance information we need
    if (!tx.meta?.preBalances || !tx.meta?.postBalances || 
        tx.meta.preBalances.length === 0 || tx.meta.postBalances.length === 0) {
      console.log('No balance information available:', {
        hasPreBalances: !!tx.meta?.preBalances,
        hasPostBalances: !!tx.meta?.postBalances,
        preBalancesLength: tx.meta?.preBalances?.length,
        postBalancesLength: tx.meta?.postBalances?.length
      });
      return 'UNKNOWN';
    }

    // Get the initial wallet's SOL balances (first account in the transaction)
    const initialSolBalance = tx.meta.preBalances[0] / 1e9;  // Convert lamports to SOL
    const finalSolBalance = tx.meta.postBalances[0] / 1e9;   // Convert lamports to SOL
    const solChange = finalSolBalance - initialSolBalance;

    // Log the balance changes
    console.log('SOL Balance Analysis:', {
      initialBalance: initialSolBalance,
      finalBalance: finalSolBalance,
      change: solChange,
      fee: tx.meta.fee / 1e9
    });

    // Use a threshold that's slightly larger than typical transaction fees
    // to avoid misclassifying fee-only transactions
    const THRESHOLD = 0.001; // 0.001 SOL threshold

    // Simple classification based on SOL balance change
    if (Math.abs(solChange) > THRESHOLD) {
      if (solChange < 0) {
        console.log('Classified as BUY - SOL balance decreased');
        return 'BUY';
      } else {
        console.log('Classified as SELL - SOL balance increased');
        return 'SELL';
      }
    }

    // If the change is below our threshold, mark as UNKNOWN
    console.log('Change below threshold, marking as UNKNOWN');
    return 'UNKNOWN';
  } catch (err) {
    console.error('Error determining transaction type:', err);
    return 'UNKNOWN';
  }
}

// Helper function to analyze token balance changes
function analyzeTokenChanges(preBalances: TokenBalance[], postBalances: TokenBalance[]) {
  const changes: Array<{
    mint: string,
    accountIndex: number,
    uiAmountChange: number
  }> = [];

  // Create a map of pre-balances for easy lookup
  const preBalanceMap = new Map(
    preBalances.map(balance => [
      `${balance.mint}:${balance.accountIndex}`,
      balance
    ])
  );

  // Calculate changes for each post-balance
  for (const post of postBalances) {
    const key = `${post.mint}:${post.accountIndex}`;
    const pre = preBalanceMap.get(key);
    
    if (pre) {
      const change = {
        mint: post.mint,
        accountIndex: post.accountIndex,
        uiAmountChange: (post.uiTokenAmount.uiAmount || 0) - (pre.uiTokenAmount.uiAmount || 0)
      };
      
      // Only include significant changes
      if (Math.abs(change.uiAmountChange) > 0.000001) {
        changes.push(change);
      }
    } else {
      // If no pre-balance exists, this is a new token position
      changes.push({
        mint: post.mint,
        accountIndex: post.accountIndex,
        uiAmountChange: post.uiTokenAmount.uiAmount || 0
      });
    }
  }

  return changes;
} 