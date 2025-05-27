import { useEffect, useState } from 'react';

interface ScanningNotificationProps {
  walletAddress?: string;
  onClose: () => void;
}

export default function ScanningNotification({ walletAddress, onClose }: ScanningNotificationProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let isMounted = true;
    
    // Simulate progress updates
    const interval = setInterval(() => {
      if (!isMounted) return;
      
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // Add a small delay before closing
          setTimeout(() => {
            if (isMounted) {
              setVisible(false);
              onClose();
            }
          }, 1000);
          return 100;
        }
        // Slow down the progress a bit
        return prev + 0.5;
      });
    }, 100);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [onClose]);

  // Force immediate render
  useEffect(() => {
    setVisible(true);
  }, [walletAddress]);

  if (!visible) return null;

  const formattedAddress = walletAddress 
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : 'wallet';

  return (
    <div className="fixed bottom-4 right-4 bg-[#1a1a1a] rounded-lg shadow-lg p-4 max-w-md w-full z-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-medium">Scanning Wallet</h3>
        <button
          onClick={() => {
            setVisible(false);
            onClose();
          }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <p className="text-gray-400 text-sm mb-3">
        Scanning transactions for {formattedAddress}
      </p>
      
      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="absolute left-0 top-0 h-full bg-indigo-600 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
} 