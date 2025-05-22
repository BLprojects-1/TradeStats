import React, { useEffect, useState } from 'react';
import { tradingHistoryService } from '../services/tradingHistoryService';
import { ProcessedTrade } from '../services/tradeProcessor';

interface RecentActivityProps {
  userId: string;
  wallets: Array<{ id: string; wallet_address: string }>;
  className?: string;
}

interface RecentTradeProps {
  trade: ProcessedTrade;
}

const RecentTrade: React.FC<RecentTradeProps> = ({ trade }) => {
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(2);
  };

  const isBuy = trade.type === 'BUY';
  
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-b-0">
      <div className="flex items-center space-x-3">
        {trade.tokenLogoURI ? (
          <img 
            src={trade.tokenLogoURI} 
            alt={trade.tokenSymbol}
            className="w-8 h-8 rounded-full"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-medium text-white">
            {trade.tokenSymbol.substring(0, 2).toUpperCase()}
          </div>
        )}
        
        <div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              isBuy ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
            }`}>
              {trade.type}
            </span>
            <span className="text-white font-medium">{trade.tokenSymbol}</span>
          </div>
          <div className="text-sm text-gray-400">
            {formatAmount(trade.amount)} tokens • {formatTime(trade.timestamp)}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="text-white font-medium">
          ${trade.valueUSD.toFixed(2)}
        </div>
        {trade.profitLoss !== 0 && (
          <div className={`text-sm ${trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trade.profitLoss >= 0 ? '+' : ''}${trade.profitLoss.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
};

export const RecentActivity: React.FC<RecentActivityProps> = ({ 
  userId, 
  wallets, 
  className = '' 
}) => {
  const [recentTrades, setRecentTrades] = useState<ProcessedTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecentActivity = async () => {
      if (!userId || wallets.length === 0) {
        setRecentTrades([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get recent trades from the first wallet (or we could aggregate from all wallets)
        const firstWallet = wallets[0];
        const result = await tradingHistoryService.getTradingHistory(
          userId,
          firstWallet.wallet_address,
          5, // Limit to 5 recent trades
          1
        );

        setRecentTrades(result.trades);
      } catch (err) {
        console.error('Error loading recent activity:', err);
        setError('Failed to load recent activity');
      } finally {
        setLoading(false);
      }
    };

    loadRecentActivity();
  }, [userId, wallets]);

  if (loading) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-indigo-400">Loading recent activity...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  if (recentTrades.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-gray-400">No recent trading activity found.</div>
        <div className="text-sm text-gray-500 mt-2">
          Trades will appear here once you start trading.
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-1">
        {recentTrades.map((trade, index) => (
          <RecentTrade key={`${trade.signature}-${index}`} trade={trade} />
        ))}
      </div>
      
      {recentTrades.length >= 5 && (
        <div className="text-center mt-4">
          <button className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
            View all trades →
          </button>
        </div>
      )}
    </div>
  );
}; 