import React from 'react';
import { AddTokenResult } from '../services/addNewToken';

interface TokenAddResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AddTokenResult | null;
  tokenAddress: string;
  tokenSymbol?: string;
}

const TokenAddResultModal: React.FC<TokenAddResultModalProps> = ({
  isOpen,
  onClose,
  result,
  tokenAddress,
  tokenSymbol
}) => {
  if (!isOpen || !result) {
    console.log('TokenAddResultModal not rendering because:', { isOpen, result });
    return null;
  }

  console.log('TokenAddResultModal rendering with:', { isOpen, result });

  const handleClose = () => {
    onClose();
  };

  const handleViewTrades = () => {
    // Navigate to trade log or trading history
    onClose();
    // You can add navigation logic here if needed
    window.location.href = '/dashboard/trade-log';
  };

  const getStatusIcon = () => {
    if (result.success) {
      if (result.tradesFound > 0) {
        return (
          <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      } else {
        return (
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        );
      }
    } else {
      return (
        <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto">
          <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    }
  };

  const getStatusTitle = () => {
    if (result.success) {
      if (result.tradesFound > 0) {
        return "Token Added Successfully!";
      } else {
        return "Token Added to Watchlist";
      }
    } else {
      return "Failed to Add Token";
    }
  };

  const getStatusDescription = () => {
    if (result.success) {
      if (result.tradesFound > 0) {
        return `Found ${result.tradesFound} historical trade${result.tradesFound === 1 ? '' : 's'} for ${getTokenSymbol()}`;
      } else {
        return `${getTokenSymbol()} is now being monitored for future trades`;
      }
    } else {
      return "There was an issue adding this token to your portfolio";
    }
  };

  const getTokenSymbol = () => {
    if (tokenSymbol) return tokenSymbol;

    // Try to extract token symbol from the result message
    const match = result?.message?.match(/(\w+)!/);
    if (match && match[1]) {
      return match[1];
    }

    // Fallback to truncated address
    return `${tokenAddress.slice(0, 4)}...${tokenAddress.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative max-w-lg w-full mx-4 transform transition-all duration-200 ease-out">
        <div 
          className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl shadow-2xl shadow-indigo-900/20"
          style={{
            animation: 'slideDownFadeIn 0.2s ease-out forwards'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-indigo-500/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6 text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Token Results
              </h2>
            </div>

            <button
              onClick={handleClose}
              className="p-3 rounded-xl bg-slate-800/50 border border-indigo-500/30 hover:bg-slate-700/50 hover:border-indigo-500/50 text-gray-400 hover:text-gray-200 transition-all duration-300 group"
              aria-label="Close modal"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Status Icon and Title */}
            <div className="text-center space-y-4">
              {getStatusIcon()}
              <div className="space-y-2">
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  {getStatusTitle()}
                </h3>
                <p className="text-gray-300 text-sm">
                  {getStatusDescription()}
                </p>
              </div>
            </div>

            {/* Token Information */}
            <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm border border-indigo-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-indigo-300">Token:</span>
                <span className="text-sm text-white font-medium">{getTokenSymbol()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-indigo-300">Address:</span>
                <span className="text-xs text-gray-400 font-mono bg-slate-800/50 px-2 py-1 rounded">
                  {tokenAddress.slice(0, 8)}...{tokenAddress.slice(-8)}
                </span>
              </div>
              {result.tradesFound > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-300">Trades Found:</span>
                  <span className="text-sm text-green-400 font-bold">{result.tradesFound}</span>
                </div>
              )}
              <div className="pt-2 border-t border-indigo-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-indigo-300">Find in Dashboard:</span>
                  <span className="text-xs text-gray-400">
                    {result.success && result.tradesFound > 0 
                      ? "Trade Log (starred)" 
                      : "Trading History (monitored)"
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            <div className="space-y-3">
              {result.success && result.tradesFound > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-300">Trades Starred</p>
                    <p className="text-xs text-green-400/80">
                      All trades for this token have been starred and added to your Trade Log. You can also view them in Trading History.
                    </p>
                  </div>
                </div>
              )}

              {result.success && result.tradesFound === 0 && (
                <div className="flex items-start space-x-3 p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-300">Now Monitoring</p>
                    <p className="text-xs text-blue-400/80">
                      Future trades with this token will be automatically detected and appear in your Trading History dashboard.
                    </p>
                  </div>
                </div>
              )}

              {!result.success && (
                <div className="flex items-start space-x-3 p-4 bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl">
                  <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-300">Error Details</p>
                    <p className="text-xs text-red-400/80">
                      {result.error === 'DRPC_TIMEOUT' 
                        ? 'DRPC API timeout - try again or upgrade your plan'
                        : result.message
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3 pt-4">
              {result.success && result.tradesFound > 0 && (
                <button 
                  onClick={handleViewTrades}
                  className="w-full px-6 py-3 text-sm font-medium bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl shadow-lg shadow-green-900/30 hover:from-green-500 hover:to-emerald-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  View Trades in Trade Log
                </button>
              )}

              <button 
                onClick={handleClose}
                className={`w-full px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 transform hover:scale-105 ${
                  result.success 
                    ? "bg-slate-800/50 border border-indigo-500/30 hover:bg-slate-700/50 hover:border-indigo-500/50 text-gray-300 hover:text-white" 
                    : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/30 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                }`}
              >
                {result.success ? "Continue" : "Try Again"}
              </button>
            </div>

            {/* Additional Information */}
            {result.success && (
              <div className="text-xs text-gray-500 text-center pt-4 border-t border-indigo-500/20">
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>💡 Future trades with this token will be automatically tracked</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenAddResultModal; 
