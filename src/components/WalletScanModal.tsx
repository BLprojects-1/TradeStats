import React, { useState, useCallback } from 'react';
import { refreshWalletService } from '../services/refreshWallet';

interface WalletScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: { newTradesCount: number, message: string }) => void;
  walletAddress: string;
  userId: string;
}

const WalletScanModal: React.FC<WalletScanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  walletAddress,
  userId
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartScan = useCallback(async () => {
    try {
      setIsScanning(true);
      setError(null);

      // Call the refreshWalletService to scan the wallet
      const result = await refreshWalletService.refreshWalletTrades(walletAddress, userId);

      // Calculate the number of new trades found
      const newTradesCount = result.recentTrades.length;

      // Call onSuccess with the result
      onSuccess({
        newTradesCount,
        message: newTradesCount > 0 
          ? `Found ${newTradesCount} new trades!` 
          : "You're up to date!"
      });

      // Close the modal
      onClose();
    } catch (err) {
      console.error('Error scanning wallet:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsScanning(false);
    }
  }, [walletAddress, userId, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl shadow-2xl shadow-indigo-900/20 max-w-md w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Wallet Scan Required</h2>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-gray-300 flex items-start">
              <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              To provide you with accurate trading history and portfolio performance, we need to scan your wallet address:
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm border border-indigo-500/20 p-4 rounded-xl">
            <div className="font-mono text-sm text-indigo-300 break-all flex items-center">
              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {walletAddress}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-gray-300 font-medium flex items-center">
              <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              This scan will:
            </p>

            <ul className="space-y-2 text-gray-300 pl-7">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mr-3"></div>
                Find all trades for tokens you've interacted with since your last scan
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mr-3"></div>
                Calculate your portfolio performance
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mr-3"></div>
                Enable automatic trade tracking
              </li>
            </ul>
          </div>

          <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-gray-300 text-sm flex items-start">
              <svg className="w-4 h-4 text-amber-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              The scan may take up to 2 minutes. Without this scan, we won't be able to automatically track your trading history.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-red-200 text-sm rounded-xl flex items-center shadow-lg shadow-red-500/10">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-3 text-sm font-medium text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-gray-800/30"
            >
              Cancel
            </button>
            <button
              onClick={handleStartScan}
              disabled={isScanning}
              className="px-6 py-3 text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-900/30 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
            >
              {isScanning ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </span>
              ) : 'Start Scan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletScanModal;
