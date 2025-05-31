/**
 * Trade Log Service - Supabase Only
 * 
 * This service is specifically for trade-log.tsx operations.
 * It only uses Supabase and doesn't overlap with other services.
 */

import { supabase } from '../utils/supabaseClient';

export interface TradeLogEntry {
  signature: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI: string | null;
  type: 'BUY' | 'SELL';
  amount: number;
  totalVolume: number;
  profitLoss: number;
  timestamp: number;
  starred: boolean;
}

export interface UntrackedToken {
  id: string;
  contract_address: string;
  symbol: string;
  wallet_address: string;
  present_trades: boolean;
  current_price?: number;
  total_supply?: number;
  token_uri?: string | null;
  created_at: string;
  updated_at: string;
}

export class TradeLogService {
  /**
   * Get starred trades for trade log (Supabase only)
   */
  async getStarredTrades(
    walletId: string,
    limit?: number,
    offset?: number
  ): Promise<{ trades: TradeLogEntry[], totalCount: number }> {
    try {
      console.log('🔍 Getting starred trades for wallet:', walletId);

      // First, check authentication status
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 Auth session:', session ? 'authenticated' : 'not authenticated');
      if (sessionError) {
        console.error('❌ Session error:', sessionError);
      }

      // Check if there are ANY trades for this wallet first
      const { data: allTradesTest, error: allTradesError } = await supabase
        .from('trading_history')
        .select('id, token_symbol, starred')
        .eq('wallet_id', walletId)
        .limit(10);

      if (allTradesError) {
        console.error('❌ Error checking all trades:', allTradesError);
      } else {
        console.log(`📊 Total trades found for wallet: ${allTradesTest?.length || 0}`);
        console.log('🎯 Sample trades:', allTradesTest);
        const starredCount = allTradesTest?.filter(t => t.starred === true).length || 0;
        console.log(`⭐ Starred trades in sample: ${starredCount}`);

        // Debug specific starred values
        allTradesTest?.forEach((trade, index) => {
          console.log(`Trade ${index + 1}: starred = ${trade.starred} (type: ${typeof trade.starred})`);
        });
      }

      // Get total count first - handle both boolean true and string 'TRUE'
      const { count, error: countError } = await supabase
        .from('trading_history')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_id', walletId)
        .or('starred.eq.true,starred.eq.TRUE'); // Handle both boolean true and string 'TRUE'

      if (countError) {
        console.error('❌ Count error:', countError);
        console.error('❌ Error details:', {
          code: countError.code,
          message: countError.message,
          details: countError.details,
          hint: countError.hint
        });
        throw new Error(`Failed to count starred trades: ${countError.message}`);
      }

      console.log(`📈 Total starred trades count: ${count || 0}`);

      if (!count || count === 0) {
        console.log('⚠️ No starred trades found, returning empty result');
        return { trades: [], totalCount: 0 };
      }

      // Build query with optional pagination - handle both boolean true and string 'TRUE'
      let query = supabase
        .from('trading_history')
        .select(`
          signature,
          token_address,
          token_symbol,
          token_logo_uri,
          type,
          amount,
          value_usd,
          timestamp,
          starred
        `)
        .eq('wallet_id', walletId)
        .or('starred.eq.true,starred.eq.TRUE') // Handle both boolean true and string 'TRUE'
        .order('timestamp', { ascending: false });

      // Apply pagination if provided
      if (limit !== undefined && offset !== undefined) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Query error:', error);
        console.error('❌ Query error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`Failed to fetch starred trades: ${error.message}`);
      }

      console.log(`📊 Raw starred trades data (${data?.length || 0} records):`, data);

      // Verify that all returned records have starred = true
      data?.forEach((trade, index) => {
        if (trade.starred !== true) {
          console.warn(`⚠️ Trade ${index + 1} has starred=${trade.starred} but should be true!`);
        }
      });

      // Transform to TradeLogEntry format
      const trades: TradeLogEntry[] = (data || []).map(trade => ({
        signature: trade.signature || `temp-${Date.now()}-${Math.random()}`,
        tokenAddress: trade.token_address || '',
        tokenSymbol: trade.token_symbol || 'UNKNOWN',
        tokenName: trade.token_symbol || 'UNKNOWN',
        tokenLogoURI: trade.token_logo_uri,
        type: (trade.type as 'BUY' | 'SELL') || 'BUY',
        amount: Math.abs(Number(trade.amount) || 0),
        totalVolume: Math.abs(Number(trade.value_usd) || 0),
        profitLoss: trade.type === 'BUY' ? -(Number(trade.value_usd) || 0) : (Number(trade.value_usd) || 0),
        timestamp: new Date(trade.timestamp).getTime(),
        starred: Boolean(trade.starred)
      }));

      console.log(`✅ Successfully retrieved and transformed ${trades.length}/${count} starred trades`);
      return { trades, totalCount: count };

    } catch (error) {
      console.error('❌ Error getting starred trades:', error);
      throw error;
    }
  }

  /**
   * Get untracked tokens for a wallet (Supabase only)
   */
  async getUntrackedTokens(walletAddress: string): Promise<UntrackedToken[]> {
    try {
      console.log('🔍 Getting untracked tokens for wallet:', walletAddress);

      const { data, error } = await supabase
        .from('untracked_tokens')
        .select(`
          id,
          contract_address,
          symbol,
          wallet_address,
          present_trades,
          current_price,
          total_supply,
          token_uri,
          created_at,
          updated_at
        `)
        .eq('wallet_address', walletAddress)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const tokens: UntrackedToken[] = (data || []).map(token => ({
        id: token.id,
        contract_address: token.contract_address,
        symbol: token.symbol,
        wallet_address: token.wallet_address,
        present_trades: token.present_trades || false,
        current_price: token.current_price ? parseFloat(token.current_price) : undefined,
        total_supply: token.total_supply ? parseFloat(token.total_supply) : undefined,
        token_uri: token.token_uri || null,
        created_at: token.created_at,
        updated_at: token.updated_at
      }));

      console.log(`✅ Retrieved ${tokens.length} untracked tokens`);
      return tokens;

    } catch (error) {
      console.error('❌ Error getting untracked tokens:', error);
      throw error;
    }
  }

  /**
   * Toggle starred status for trades by token address (Supabase only)
   */
  async toggleTokenStarred(
    walletId: string,
    tokenAddress: string,
    starred: boolean
  ): Promise<void> {
    try {
      console.log(`🌟 Toggling starred status for token ${tokenAddress} to ${starred}`);

      const { error } = await supabase
        .from('trading_history')
        .update({ starred })
        .eq('wallet_id', walletId)
        .eq('token_address', tokenAddress);

      if (error) throw error;

      console.log(`✅ Updated starred status for token ${tokenAddress}`);

    } catch (error) {
      console.error('❌ Error toggling starred status:', error);
      throw error;
    }
  }

  /**
   * Remove untracked token (Supabase only)
   */
  async removeUntrackedToken(
    walletAddress: string,
    tokenAddress: string
  ): Promise<void> {
    try {
      console.log(`🗑️ Removing untracked token ${tokenAddress}`);

      const { error } = await supabase
        .from('untracked_tokens')
        .delete()
        .eq('wallet_address', walletAddress)
        .eq('contract_address', tokenAddress);

      if (error) throw error;

      console.log(`✅ Removed untracked token ${tokenAddress}`);

    } catch (error) {
      console.error('❌ Error removing untracked token:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const tradeLogService = new TradeLogService(); 
