import React from 'react';
import { PerformanceMetrics } from '../services/performanceService';

interface PerformanceStatsProps {
  metrics: PerformanceMetrics;
  className?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  isPositive?: boolean;
  prefix?: string;
  suffix?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  isPositive, 
  prefix = '', 
  suffix = '' 
}) => {
  let textColor = 'text-white';
  if (isPositive !== undefined) {
    textColor = isPositive ? 'text-green-400' : 'text-red-400';
  }

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
      <div className="text-sm text-gray-400 mb-1">{title}</div>
      <div className={`text-lg font-bold ${textColor}`}>
        {prefix}{typeof value === 'number' ? value.toFixed(2) : value}{suffix}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
};

export const PerformanceStats: React.FC<PerformanceStatsProps> = ({ 
  metrics, 
  className = '' 
}) => {
  const formatCurrency = (amount: number): string => {
    if (Math.abs(amount) >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const formatPercent = (percent: number): string => {
    return `${percent.toFixed(1)}%`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total P&L"
          value={formatCurrency(metrics.totalPnL)}
          isPositive={metrics.totalPnL >= 0}
        />
        
        <StatCard
          title="Tokens Traded"
          value={metrics.tokensTraded || metrics.totalTrades}
          
        />
        
        <StatCard
          title="Win Rate"
          value={formatPercent(metrics.winRate)}
          isPositive={metrics.winRate >= 50}
        />
        
        <StatCard
          title="Volume"
          value={formatCurrency(metrics.totalVolume)}
        />
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Best Trade"
          value={formatCurrency(metrics.bestTrade)}
          isPositive={metrics.bestTrade > 0}
        />
        
        <StatCard
          title="Worst Trade"
          value={formatCurrency(metrics.worstTrade)}
          isPositive={metrics.worstTrade >= 0}
        />
        
        <StatCard
          title="Avg Trade Size"
          value={formatCurrency(metrics.averageTradeSize)}
        />
      </div>
    </div>
  );
}; 