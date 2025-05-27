import { supabase } from './supabaseClient';
import { ProcessedTrade } from '../services/tradeProcessor';

interface BatchTradeData {
  signature: string;
  timestamp: number;
  block_time: number;
  type: 'BUY' | 'SELL';
  token_symbol: string;
  token_address: string;
  token_logo_url: string | null;
  amount: number;
  price_sol: number;
  price_usd: number;
  value_sol: number;
  value_usd: number;
  profit_loss: number;
  wallet_id: string;
}

/**
 * Save a single trade to the database
 */
export async function saveTrade(
  trade: ProcessedTrade,
  walletId: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('insert_trade_history', {
      p_signature: trade.signature,
      p_timestamp: trade.timestamp,
      p_block_time: trade.blockTime || Math.floor(trade.timestamp / 1000),
      p_type: trade.type,
      p_token_symbol: trade.tokenSymbol,
      p_token_address: trade.tokenAddress,
      p_token_logo_url: trade.tokenLogoURI,
      p_amount: trade.amount,
      p_price_sol: trade.priceSOL,
      p_price_usd: trade.priceUSD,
      p_value_sol: trade.valueSOL,
      p_value_usd: trade.valueUSD,
      p_profit_loss: trade.profitLoss,
      p_wallet_id: walletId
    });

    if (error) {
      console.error('Error saving trade:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveTrade:', error);
    throw error;
  }
}

/**
 * Save multiple trades in a batch
 */
export async function saveTrades(
  trades: ProcessedTrade[],
  walletId: string
): Promise<void> {
  try {
    if (!trades.length) {
      return;
    }

    // Convert trades to the format expected by our batch insert function
    const batchData: BatchTradeData[] = trades.map(trade => ({
      signature: trade.signature,
      timestamp: trade.timestamp,
      block_time: trade.blockTime || Math.floor(trade.timestamp / 1000),
      type: trade.type as 'BUY' | 'SELL',
      token_symbol: trade.tokenSymbol,
      token_address: trade.tokenAddress,
      token_logo_url: trade.tokenLogoURI,
      amount: trade.amount,
      price_sol: trade.priceSOL,
      price_usd: trade.priceUSD,
      value_sol: trade.valueSOL,
      value_usd: trade.valueUSD,
      profit_loss: trade.profitLoss,
      wallet_id: walletId
    }));

    // Use our batch insert function
    const { error } = await supabase.rpc('batch_insert_trade_history', {
      p_trades: batchData
    });

    if (error) {
      console.error('Error batch saving trades:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveTrades:', error);
    throw error;
  }
}

/**
 * Get the latest trade timestamp for a wallet
 */
export async function getLatestTradeTimestamp(
  walletId: string
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('trading_history')
      .select('timestamp')
      .eq('wallet_id', walletId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error getting latest trade timestamp:', error);
      throw error;
    }

    return data && data.length > 0 ? data[0].timestamp : null;
  } catch (error) {
    console.error('Error in getLatestTradeTimestamp:', error);
    throw error;
  }
}

/**
 * Mark a wallet as having completed its initial scan
 */
export async function markWalletScanned(
  walletId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('wallets')
      .update({ initial_scan_complete: true })
      .eq('id', walletId);

    if (error) {
      console.error('Error marking wallet as scanned:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in markWalletScanned:', error);
    throw error;
  }
} 