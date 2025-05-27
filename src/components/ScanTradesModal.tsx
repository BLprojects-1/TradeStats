import { useState } from 'react';
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
      onScanComplete();
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

    onClose();
    router.push('/dashboard');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#23232b] rounded-lg shadow-lg p-6 max-w-md w-full border border-indigo-500">
        {!scanComplete ? (
          <>
            <h3 className="text-xl font-bold text-indigo-200 mb-4">Wallet Scan Required</h3>

            <div className="space-y-4 mb-6">
              <p className="text-gray-300">
                To provide you with accurate trading history and portfolio performance, we need to scan your wallet address:
              </p>
              <div className="bg-[#1a1a1a] p-3 rounded border border-gray-700">
                <code className="text-indigo-300 break-all">{wallet.wallet_address}</code>
              </div>
              <p className="text-gray-300">
                This scan will:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Find all trades for tokens you've interacted with in the past 24 hours</li>
                <li>Calculate your portfolio performance</li>
                <li>Enable automatic trade tracking</li>
              </ul>
              <p className="text-gray-300">
                The scan may take up to 2 minutes. Without this scan, we won't be able to automatically track your trading history.
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-4 justify-end">
              {!scanning && (
                <button
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                  onClick={onClose}
                >
                  Skip for Now
                </button>
              )}
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition font-semibold flex items-center space-x-2"
                onClick={handleScanTrades}
                disabled={scanning}
              >
                {scanning ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Scanning Wallet...</span>
                  </>
                ) : (
                  <span>Start Scan</span>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold text-indigo-200 mb-4">Scan Complete!</h3>

            <div className="space-y-4 mb-6">
              <p className="text-gray-300">
                Your wallet has been successfully scanned. We've found and analyzed your recent trades.
              </p>
              <p className="text-gray-300">
                You can now view your trading history, portfolio performance, and track your positions in real-time.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition font-semibold"
                onClick={handleContinue}
              >
                Continue to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 
