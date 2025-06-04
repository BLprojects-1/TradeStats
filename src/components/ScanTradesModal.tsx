import { useState } from 'react';
import { createPortal } from 'react-dom';
import { historicalPriceService } from '../services/historicalPriceService';
import { TrackedWallet } from '../utils/userProfile';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

interface ScanTradesModalProps {
  wallet: TrackedWallet;
  onClose: () => void;
  onScanComplete: () => void;
}

export default function ScanTradesModal({ wallet, onClose, onScanComplete }: ScanTradesModalProps) {
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  const handleScanTrades = async () => {
    try {
      setScanning(true);
      setError(null);

      // Start the historical price analysis
      // Pass the user ID if available to store trades in Supabase
      await historicalPriceService.analyzeWalletTrades(
        wallet.wallet_address, 
        user?.id
      );

      setScanComplete(true);
      // Don't automatically call onScanComplete() here
      // Let the user trigger it by clicking the Continue button
    } catch (err) {
      console.error('Error scanning trades:', err);
      setError(err instanceof Error ? err.message : 'Failed to scan trades');
      setScanning(false);
    }
  };

  const handleContinue = async () => {
    // If user ID is available, ensure trades are stored in Supabase
    // This serves as a manual backup in case the automatic storing fails
    if (user?.id && scanComplete) {
      try {
        // Get the cached analysis result
        const analysisResult = historicalPriceService.getCachedAnalysisResult(wallet.wallet_address);
        if (analysisResult && analysisResult.recentTrades.length > 0) {
          // Store the trades in Supabase
          await historicalPriceService.storeAllTrades(user.id, analysisResult.recentTrades);
        }
      } catch (err) {
        console.error('Error storing trades on continue:', err);
        // Don't show error to user, just log it
      }
    }

    // Call onScanComplete before closing the modal
    onScanComplete();
    onClose();
    router.push('/dashboard');
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Full page overlay with blur */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-blue-500/40 rounded-3xl shadow-2xl shadow-blue-900/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {!scanComplete ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-8 pb-0">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    Wallet Scan Required
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Initialize trading history tracking</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-3 rounded-xl bg-slate-800/50 border border-blue-500/30 hover:bg-slate-700/50 hover:border-blue-500/50 text-gray-400 hover:text-gray-200 transition-all duration-300 group"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-8 pt-6 space-y-6">
              {/* Information Banner */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
                <div className="relative bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-5">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-200 font-medium mb-1">Initial Setup Required</p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        To provide you with accurate trading history and portfolio performance, we need to scan your wallet address for historical transactions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wallet Address Display */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
                <div className="relative bg-gradient-to-br from-[#252525]/90 to-[#1f1f1f]/90 backdrop-blur-xl border border-blue-500/30 rounded-xl p-5">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <span className="text-gray-300 font-medium">Wallet Address</span>
                  </div>
                  <div className="font-mono text-sm text-indigo-300 bg-[#1a1a1a]/50 px-4 py-3 rounded-lg border border-gray-700/50 break-all">
                    {wallet.wallet_address}
                  </div>
                </div>
              </div>

              {/* Features List */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 to-green-600/5 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
                <div className="relative bg-gradient-to-br from-[#252525]/90 to-[#1f1f1f]/90 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-gray-200 font-semibold">This scan will enable:</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                      <span className="text-gray-300">Find all trades for tokens you've interacted with in the past 24 hours</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                      <span className="text-gray-300">Calculate your portfolio performance and analytics</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
                      <span className="text-gray-300">Enable automatic trade tracking for future transactions</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Banner */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-orange-600/10 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
                <div className="relative bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-5">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-amber-200 font-medium mb-1">Processing Time</p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        The scan may take up to 2 minutes depending on your transaction history. Without this scan, we won't be able to automatically track your trading performance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-red-500/20 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
                  <div className="relative bg-gradient-to-r from-red-500/20 to-red-400/20 border border-red-500/30 rounded-xl p-5">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-red-200 font-medium mb-1">Scan Error</p>
                        <p className="text-red-300 text-sm">{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-blue-500/20">
                {!scanning && (
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-[#252525]/80 text-gray-200 rounded-xl hover:bg-[#303030] transition-all duration-300 font-medium order-2 sm:order-1"
                  >
                    Skip for Now
                  </button>
                )}
                <button
                  onClick={handleScanTrades}
                  disabled={scanning}
                  className="group/btn bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-blue-900/20 transition-all duration-300 transform hover:scale-105 disabled:scale-100 order-1 sm:order-2"
                >
                  {scanning ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Scanning Wallet...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Start Scan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Success Header */}
            <div className="flex items-center justify-between p-8 pb-0">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                    Scan Complete!
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Your wallet has been successfully analyzed</p>
                </div>
              </div>
            </div>

            {/* Success Content */}
            <div className="p-8 pt-6 space-y-6">
              {/* Success Banner */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-green-600/10 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-xl"></div>
                <div className="relative bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl p-6">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-emerald-200 font-medium mb-2">Setup Successful</p>
                      <p className="text-gray-300 text-sm leading-relaxed mb-3">
                        Your wallet has been successfully scanned. We've found and analyzed your recent trades.
                      </p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        You can now view your trading history, portfolio performance, and track your positions in real-time.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Continue Button */}
              <div className="flex justify-end pt-6 border-t border-emerald-500/20">
                <button
                  onClick={handleContinue}
                  className="group/btn bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-8 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg shadow-emerald-900/20 transition-all duration-300 transform hover:scale-105"
                >
                  <span>Continue to Dashboard</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
} 
