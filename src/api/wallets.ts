import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../db/supabaseClient';
import { drpcClient } from '../services/drpcClient';
import { TradeProcessor } from '../services/tradeProcessor';
import { Cache } from '../utils/cache';

interface TradeQueryParams {
  limit?: string;
  sinceSlot?: string;
}

interface WalletNote {
  signature: string;
  note: string;
}

const tradeCache = new Cache();
const tradeProcessor = new TradeProcessor();

export async function walletRoutes(fastify: FastifyInstance) {
  // Get trades for a wallet
  fastify.get<{ Params: { address: string }, Querystring: TradeQueryParams }>(
    '/api/wallets/:address/trades',
    async (request, reply) => {
      try {
        const { address } = request.params;
        const limit = Number(request.query.limit) || 50;
        const sinceSlot = Number(request.query.sinceSlot) || 0;

        // Check cache first
        const cachedData = tradeCache.get(address);
        if (cachedData) {
          const ttl = tradeCache.getTTL(address);
          reply.header('X-Cache-TTL', ttl.toString());
          return cachedData;
        }

        // Get last fetched slot
        const { data: slotData } = await supabase
          .from('slots')
          .select('last_slot')
          .eq('wallet_id', address)
          .single();

        const startSlot = slotData?.last_slot || sinceSlot;
        
        // Fetch trades from dRPC - Use the address and limit parameters
        // The updated API doesn't support filtering by slot directly, so we'll fetch all and filter
        const result = await drpcClient.getTransactions(address, limit);
        
        // Filter by slot if needed
        const trades = result.transactions.filter(tx => tx.slot > startSlot);
        
        // Process trades
        const processedTrades = await tradeProcessor.processTrades(trades);
        
        // Cache results
        tradeCache.set(address, processedTrades);
        
        // Update last slot
        if (trades.length > 0) {
          const maxSlot = Math.max(...trades.map(t => t.slot));
          await supabase
            .from('slots')
            .upsert({ wallet_id: address, last_slot: maxSlot });
        }

        return processedTrades;
      } catch (error) {
        console.error('Error fetching trades:', error);
        reply.status(500).send({ error: 'Failed to fetch trades' });
      }
    }
  );

  // Get top trades for a wallet
  fastify.get<{ Params: { address: string }, Querystring: { limit: string } }>(
    '/api/wallets/:address/top',
    async (request, reply) => {
      try {
        const { address } = request.params;
        const limit = Number(request.query.limit) || 5;

        const trades = await tradeProcessor.getTopTrades(address, limit);
        return trades;
      } catch (error) {
        console.error('Error fetching top trades:', error);
        reply.status(500).send({ error: 'Failed to fetch top trades' });
      }
    }
  );

  // Add note to a trade
  fastify.post<{ Params: { address: string }, Body: WalletNote }>(
    '/api/wallets/:address/notes',
    async (request, reply) => {
      try {
        const { address } = request.params;
        const { signature, note } = request.body;

        const { data, error } = await supabase
          .from('notes')
          .insert({
            wallet_id: address,
            signature,
            note,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        return { success: true, data };
      } catch (error) {
        console.error('Error adding note:', error);
        reply.status(500).send({ error: 'Failed to add note' });
      }
    }
  );
} 