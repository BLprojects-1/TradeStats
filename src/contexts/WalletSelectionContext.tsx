import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getTrackedWallets, TrackedWallet } from '../utils/userProfile';
import { useAuth } from './AuthContext';
import { ProcessedTrade } from '../services/tradeProcessor';

interface WalletSelectionContextType {
  selectedWalletId: string | null;
  setSelectedWalletId: (walletId: string | null) => void;
  wallets: TrackedWallet[];
  setWallets: (wallets: TrackedWallet[]) => void;
  isWalletScanning: (walletId: string) => boolean;
  markWalletAsScanning: (walletId: string) => void;
  markWalletScanComplete: (walletId: string) => void;
  // Cache functionality
  getWalletCache: (walletId: string) => ProcessedTrade[] | null;
  setWalletCache: (walletId: string, trades: ProcessedTrade[]) => void;
  clearWalletCache: (walletId: string) => void;
  isCacheValid: (walletId: string, maxAgeMinutes?: number) => boolean;
}

const WalletSelectionContext = createContext<WalletSelectionContextType | undefined>(undefined);

interface WalletCache {
  trades: ProcessedTrade[];
  timestamp: number;
}

interface WalletSelectionProviderProps {
  children: ReactNode;
}

export function WalletSelectionProvider({ children }: WalletSelectionProviderProps) {
  const { user } = useAuth();
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [scanningWallets, setScanningWallets] = useState<Set<string>>(new Set());
  const [walletCaches, setWalletCaches] = useState<Map<string, WalletCache>>(new Map());

  // Load wallets when user changes
  useEffect(() => {
    const loadWallets = async () => {
      if (!user?.id) {
        setWallets([]);
        setSelectedWalletId(null);
        setWalletCaches(new Map()); // Clear caches when user changes
        return;
      }

      try {
        console.log('Loading wallets for user:', user.id);
        const userWallets = await getTrackedWallets(user.id);
        console.log('Loaded wallets:', userWallets);
        setWallets(userWallets);
        
        // Only maintain current selection if the wallet still exists
        if (selectedWalletId && !userWallets.find(w => w.id === selectedWalletId)) {
          setSelectedWalletId(null);
        }
      } catch (error) {
        console.error('Error loading wallets:', error);
        setWallets([]);
        setSelectedWalletId(null);
      }
    };

    loadWallets();
  }, [user?.id, selectedWalletId]);

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
    
    // Update wallet status in wallets array
    setWallets(prev => prev.map(wallet => 
      wallet.id === walletId 
        ? { ...wallet, initial_scan_complete: true }
        : wallet
    ));
  };

  const isWalletScanning = (walletId: string): boolean => {
    return scanningWallets.has(walletId);
  };

  // Cache functionality
  const getWalletCache = (walletId: string): ProcessedTrade[] | null => {
    const cache = walletCaches.get(walletId);
    if (!cache) return null;
    
    // Check if cache is still valid (default 5 minutes)
    const maxAge = 5 * 60 * 1000; // 5 minutes in milliseconds
    if (Date.now() - cache.timestamp > maxAge) {
      walletCaches.delete(walletId);
      return null;
    }
    
    return cache.trades;
  };

  const setWalletCache = (walletId: string, trades: ProcessedTrade[]) => {
    setWalletCaches(prev => {
      const newMap = new Map(prev);
      newMap.set(walletId, {
        trades,
        timestamp: Date.now()
      });
      return newMap;
    });
  };

  const clearWalletCache = (walletId: string) => {
    setWalletCaches(prev => {
      const newMap = new Map(prev);
      newMap.delete(walletId);
      return newMap;
    });
  };

  const isCacheValid = (walletId: string, maxAgeMinutes: number = 5): boolean => {
    const cache = walletCaches.get(walletId);
    if (!cache) return false;
    
    const maxAge = maxAgeMinutes * 60 * 1000;
    return Date.now() - cache.timestamp <= maxAge;
  };

  const value: WalletSelectionContextType = {
    selectedWalletId,
    setSelectedWalletId,
    wallets,
    setWallets,
    isWalletScanning,
    markWalletAsScanning,
    markWalletScanComplete,
    getWalletCache,
    setWalletCache,
    clearWalletCache,
    isCacheValid
  };

  return (
    <WalletSelectionContext.Provider value={value}>
      {children}
    </WalletSelectionContext.Provider>
  );
}

export function useWalletSelection() {
  const context = useContext(WalletSelectionContext);
  if (context === undefined) {
    throw new Error('useWalletSelection must be used within a WalletSelectionProvider');
  }
  return context;
} 