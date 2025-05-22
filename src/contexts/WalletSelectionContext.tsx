import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getTrackedWallets, TrackedWallet } from '../utils/userProfile';
import { useAuth } from './AuthContext';

interface WalletSelectionContextType {
  selectedWalletId: string | null;
  wallets: TrackedWallet[];
  setSelectedWalletId: (id: string | null) => void;
  loading: boolean;
  error: string | null;
  scanningWallets: Set<string>; // Track which wallets are currently being scanned
  markWalletAsScanning: (walletId: string) => void;
  markWalletScanComplete: (walletId: string) => void;
  isWalletScanning: (walletId: string) => boolean;
  refreshWallets: () => Promise<void>; // Add a method to refresh wallet data
}

const WalletSelectionContext = createContext<WalletSelectionContextType | undefined>(undefined);

export const useWalletSelection = (): WalletSelectionContextType => {
  const context = useContext(WalletSelectionContext);
  if (!context) {
    throw new Error('useWalletSelection must be used within a WalletSelectionProvider');
  }
  return context;
};

export const WalletSelectionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanningWallets, setScanningWallets] = useState<Set<string>>(new Set());

  // Load the selected wallet ID from localStorage on initial mount
  useEffect(() => {
    const savedWalletId = localStorage.getItem('selectedWalletId');
    if (savedWalletId) {
      setSelectedWalletId(savedWalletId);
    }
  }, []);

  // Save the selected wallet ID to localStorage whenever it changes
  useEffect(() => {
    if (selectedWalletId) {
      localStorage.setItem('selectedWalletId', selectedWalletId);
    }
  }, [selectedWalletId]);

  // Function to fetch wallets - can be called to refresh data
  const fetchWallets = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const userWallets = await getTrackedWallets(user.id);
      setWallets(userWallets);
      
      // If there's no selected wallet but we have wallets, select the first one
      if (!selectedWalletId && userWallets.length > 0) {
        // Check if we have a saved wallet ID that matches one of the loaded wallets
        const savedWalletId = localStorage.getItem('selectedWalletId');
        const validSavedWallet = savedWalletId && userWallets.some(w => w.id === savedWalletId);
        
        if (validSavedWallet) {
          setSelectedWalletId(savedWalletId);
        } else if (userWallets.length === 1) {
          // If only one wallet, select it automatically
          setSelectedWalletId(userWallets[0].id);
          localStorage.setItem('selectedWalletId', userWallets[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading wallets:', err);
      setError('Failed to load wallets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load wallets when user changes
  useEffect(() => {
    fetchWallets();
  }, [user]);

  const handleSetSelectedWalletId = (id: string | null) => {
    setSelectedWalletId(id);
    if (id) {
      localStorage.setItem('selectedWalletId', id);
    } else {
      localStorage.removeItem('selectedWalletId');
    }
  };

  // Functions to track which wallets are being scanned
  const markWalletAsScanning = (walletId: string) => {
    setScanningWallets(prev => {
      const newSet = new Set(prev);
      newSet.add(walletId);
      return newSet;
    });
  };

  const markWalletScanComplete = (walletId: string) => {
    setScanningWallets(prev => {
      const newSet = new Set(prev);
      newSet.delete(walletId);
      return newSet;
    });
    
    // Refresh wallet data to get updated initial_scan_complete status
    fetchWallets();
  };

  const isWalletScanning = (walletId: string) => {
    return scanningWallets.has(walletId);
  };

  return (
    <WalletSelectionContext.Provider 
      value={{
        selectedWalletId,
        wallets,
        setSelectedWalletId: handleSetSelectedWalletId,
        loading,
        error,
        scanningWallets,
        markWalletAsScanning,
        markWalletScanComplete,
        isWalletScanning,
        refreshWallets: fetchWallets
      }}
    >
      {children}
    </WalletSelectionContext.Provider>
  );
}; 