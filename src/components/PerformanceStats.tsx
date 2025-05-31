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
  let textColor = 'text-slate-100';
  let borderColor = 'border-slate-600/25';
  let bgColor = 'bg-slate-900/40';
  
  if (isPositive !== undefined) {
    if (isPositive) {
      textColor = 'text-emerald-400';
      borderColor = 'border-emerald-500/25';
      bgColor = 'bg-emerald-950/30';
    } else {
      textColor = 'text-rose-400';
      borderColor = 'border-rose-500/25';
      bgColor = 'bg-rose-950/30';
    }
  }

  return (
    <div className={`${bgColor} backdrop-blur-sm rounded-xl p-5 border transition-all duration-300 hover:bg-slate-800/50 hover:border-slate-500/30 hover:shadow-lg hover:shadow-slate-900/20 group ${borderColor}`}>
      <div className="text-sm text-slate-400 mb-2 group-hover:text-slate-300 transition-colors font-medium">
        {title}
      </div>
      <div className={`text-xl font-bold transition-colors mb-1 ${textColor}`}>
        {prefix}{typeof value === 'number' ? value.toFixed(2) : value}{suffix}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
          {subtitle}
        </div>
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