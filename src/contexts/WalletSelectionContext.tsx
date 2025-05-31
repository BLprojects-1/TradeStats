import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getTrackedWallets, TrackedWallet, updateLastSelectedWallet, getLastSelectedWallet } from '../utils/userProfile';
import { useAuth } from './AuthContext';
import { ProcessedTrade } from '../services/tradeProcessor';
import { supabase } from '../utils/supabaseClient';

interface WalletSelectionContextType {
  selectedWalletId: string | null;
  setSelectedWalletId: (walletId: string | null) => Promise<void>;
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
  // Wallet loading functionality
  reloadWallets: () => Promise<void>;
  isLoading: boolean;
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
  const [selectedWalletId, setInternalSelectedWalletId] = useState<string | null>(null);
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [scanningWallets, setScanningWallets] = useState<Set<string>>(new Set());
  const [walletCaches, setWalletCaches] = useState<Map<string, WalletCache>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedSavedSelection, setHasLoadedSavedSelection] = useState(false);

  // Custom setter that also saves to Supabase
  const setSelectedWalletId = async (walletId: string | null) => {
    console.log('Setting selected wallet ID:', walletId);
    setInternalSelectedWalletId(walletId);
    
    // Save to Supabase if user is authenticated
    if (user?.id) {
      const success = await updateLastSelectedWallet(user.id, walletId);
      if (success) {
        console.log('Selected wallet persisted to Supabase:', walletId);
      } else {
        console.warn('Failed to persist selected wallet to Supabase');
      }
    }
  };

  // Load wallets and handle saved selection
  useEffect(() => {
    const loadWalletsAndSelection = async () => {
      if (!user?.id) {
        console.log('No user, clearing wallets and selection');
        setWallets([]);
        setInternalSelectedWalletId(null);
        setWalletCaches(new Map());
        setHasLoadedSavedSelection(false);
        return;
      }

      // Add a small delay to ensure auth session is fully established
      await new Promise(resolve => setTimeout(resolve, 100));

      setIsLoading(true);
      try {
        console.log('Loading wallets for user:', user.id);
        
        // Double-check auth session before proceeding
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          console.log('No active session found, skipping wallet loading');
          setIsLoading(false);
          return;
        }
        
        // Load wallets
        const userWallets = await getTrackedWallets(user.id);
        console.log('Loaded wallets:', userWallets);
        setWallets(userWallets);
        
        // Load saved selection only if we haven't loaded it yet
        if (!hasLoadedSavedSelection && userWallets.length > 0) {
          console.log('Loading saved wallet selection...');
          const savedWalletId = await getLastSelectedWallet(user.id);
          console.log('Saved wallet ID from Supabase:', savedWalletId);
          
          if (savedWalletId) {
            // Verify the saved wallet still exists in the user's wallets
            const walletExists = userWallets.find(w => w.id === savedWalletId);
            if (walletExists) {
              console.log('Setting saved wallet as selected:', savedWalletId);
              setInternalSelectedWalletId(savedWalletId);
            } else {
              console.log('Saved wallet no longer exists, clearing selection');
              await updateLastSelectedWallet(user.id, null);
              // Auto-select first wallet if available
              if (userWallets.length > 0) {
                console.log('Auto-selecting first wallet:', userWallets[0].id);
                await setSelectedWalletId(userWallets[0].id);
              }
            }
          } else if (userWallets.length > 0) {
            // No saved selection, auto-select first wallet
            console.log('No saved selection, auto-selecting first wallet:', userWallets[0].id);
            await setSelectedWalletId(userWallets[0].id);
          }
          
          setHasLoadedSavedSelection(true);
        } else if (userWallets.length === 0) {
          // No wallets available, clear selection
          console.log('No wallets available, clearing selection');
          setInternalSelectedWalletId(null);
          setHasLoadedSavedSelection(false);
        } else if (hasLoadedSavedSelection && selectedWalletId) {
          // Check if current selection is still valid
          const currentWalletExists = userWallets.find(w => w.id === selectedWalletId);
          if (!currentWalletExists) {
            console.log('Current selection no longer valid, clearing');
            await setSelectedWalletId(null);
            // Auto-select first wallet if available
            if (userWallets.length > 0) {
              console.log('Auto-selecting first wallet after invalid selection:', userWallets[0].id);
              await setSelectedWalletId(userWallets[0].id);
            }
          }
        }
      } catch (error) {
        console.error('Error loading wallets and selection:', error);
        setWallets([]);
        setInternalSelectedWalletId(null);
        setHasLoadedSavedSelection(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadWalletsAndSelection();
  }, [user?.id]); // Only depend on user.id to avoid loops

  const reloadWallets = async () => {
    if (!user?.id || isLoading) return;
    
    setIsLoading(true);
    try {
      console.log('Reloading wallets for user:', user.id);
      const userWallets = await getTrackedWallets(user.id);
      console.log('Reloaded wallets:', userWallets);
      setWallets(userWallets);
      
      // If there are wallets but no selection, select the first one
      if (userWallets.length > 0 && !selectedWalletId) {
        console.log('Auto-selecting first wallet after reload:', userWallets[0].id);
        await setSelectedWalletId(userWallets[0].id);
      } else if (selectedWalletId && !userWallets.find(w => w.id === selectedWalletId)) {
        // If current selection is invalid, clear it
        await setSelectedWalletId(null);
        // Auto-select first wallet if available
        if (userWallets.length > 0) {
          console.log('Auto-selecting first wallet after invalid selection in reload:', userWallets[0].id);
          await setSelectedWalletId(userWallets[0].id);
        }
      }
    } catch (error) {
      console.error('Error reloading wallets:', error);
      // Don't clear wallets on reload error to maintain existing state
    } finally {
      setIsLoading(false);
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
    isCacheValid,
    reloadWallets,
    isLoading
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