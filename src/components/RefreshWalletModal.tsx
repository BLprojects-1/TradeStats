import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { refreshWalletService } from '../services/refreshWallet';

interface RefreshWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: { newTradesCount: number, message: string }) => void;
  walletAddress: string;
  userId: string;
}

const RefreshWalletModal: React.FC<RefreshWalletModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  walletAddress,
  userId
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      // Call the refreshWalletService to refresh the wallet data
      const result = await refreshWalletService.refreshWalletTrades(walletAddress, userId);

      // Calculate the number of new trades found
      const newTradesCount = result.recentTrades.length;

      // Call onSuccess with the result
      onSuccess({
        newTradesCount,
        message: newTradesCount > 0 
          ? `Found ${newTradesCount} new trades!` 
          : "Your trading data is up to date!"
      });

      // Close the modal
      onClose();
    } catch (err) {
      console.error('Error refreshing wallet:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsRefreshing(false);
    }
  }, [walletAddress, userId, onSuccess, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Full page overlay with blur */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal content */}
      <div className="relative bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 border border-emerald-400/40 rounded-3xl shadow-2xl shadow-emerald-900/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-emerald-400/20">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 via-teal-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-amber-400/20 animate-pulse"></div>
              <svg className="w-6 h-6 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                Refresh Trading Data
              </h2>
              <p className="text-emerald-400/80 text-sm mt-1">Scan for new trades and updates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-slate-800/50 border border-emerald-500/30 hover:bg-slate-700/50 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 transition-all duration-300 group"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Information Banner */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 to-amber-600/5 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
            <div className="relative bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-emerald-200 font-semibold mb-1">Refresh Trading Data</p>
                  <p className="text-emerald-300/90 text-sm leading-relaxed">
                    This will scan your wallet for any new trades and update your trading history, portfolio performance, and analytics data.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Address Display */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 to-amber-600/5 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
            <div className="relative bg-gradient-to-br from-slate-800/80 via-emerald-950/80 to-teal-950/80 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-5">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/30">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-emerald-200 font-semibold">Wallet Address</span>
              </div>
              <div className="font-mono text-sm text-emerald-300 bg-[#1a1a1a]/50 px-4 py-3 rounded-lg border border-emerald-700/50 break-all">
                {walletAddress}
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 to-amber-600/5 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
            <div className="relative bg-gradient-to-br from-slate-800/80 via-emerald-950/80 to-teal-950/80 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/30">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-emerald-200 font-semibold">This refresh will:</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"></div>
                  <span className="text-emerald-300/90">Find all new trades since your last scan</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-teal-500 to-amber-500 rounded-full"></div>
                  <span className="text-emerald-300/90">Update your portfolio performance and analytics</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"></div>
                  <span className="text-emerald-300/90">Refresh P&L calculations and trade summaries</span>
                </div>
              </div>
            </div>
          </div>

          {/* Processing Time Warning */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-orange-600/10 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
            <div className="relative bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-amber-500/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-amber-200 font-semibold mb-1">Processing Time</p>
                  <p className="text-amber-300/90 text-sm leading-relaxed">
                    The refresh may take up to 2 minutes depending on your recent trading activity. This ensures we capture all your latest transactions accurately.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-red-500/20 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
              <div className="relative bg-gradient-to-r from-red-500/20 to-red-400/20 border border-red-500/30 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-red-200 font-semibold mb-1">Refresh Error</p>
                    <p className="text-red-300/90 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-emerald-400/20">
            <button
              onClick={onClose}
              className="px-6 py-3 text-sm font-medium text-emerald-400/80 hover:text-emerald-300 transition-colors rounded-xl hover:bg-emerald-800/20 order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={handleStartRefresh}
              disabled={isRefreshing}
              className="group/btn relative overflow-hidden px-8 py-3 text-sm font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 order-1 sm:order-2 flex items-center justify-center space-x-2"
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-amber-400/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
              
              <span className="relative flex items-center space-x-2">
                {isRefreshing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Refreshing Data...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Start Refresh</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RefreshWalletModal; 