import { useState, useCallback, useEffect } from 'react';

interface UseRefreshButtonOptions {
  cooldownMs?: number;
  onRefresh: () => Promise<{ newTradesCount: number, message: string }>;
  useWalletScanModal?: boolean;
  walletAddress?: string;
  userId?: string;
}

interface UseRefreshButtonReturn {
  isLoading: boolean;
  isOnCooldown: boolean;
  cooldownTimeLeft: number;
  showNotification: boolean;
  notificationType: 'success' | 'error' | 'info';
  notificationMessage: string;
  handleRefresh: () => Promise<void>;
  handleDismissNotification: () => void;
  showWalletScanModal: boolean;
  setShowWalletScanModal: (show: boolean) => void;
  handleWalletScanSuccess: (result: { newTradesCount: number, message: string }) => void;
}

export function useRefreshButton({
  cooldownMs = 120000, // Default 2 minutes
  onRefresh,
  useWalletScanModal = false,
  walletAddress,
  userId
}: UseRefreshButtonOptions): UseRefreshButtonReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error' | 'info'>('success');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showWalletScanModal, setShowWalletScanModal] = useState(false);

  // Update cooldown timer
  useEffect(() => {
    if (cooldownTimeLeft > 0) {
      const timer = setInterval(() => {
        const newTimeLeft = Math.max(0, cooldownMs - (Date.now() - lastRefreshTime));
        setCooldownTimeLeft(newTimeLeft);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownTimeLeft, lastRefreshTime, cooldownMs]);

  const handleRefresh = useCallback(async () => {
    // Check if on cooldown
    if (Date.now() - lastRefreshTime < cooldownMs) {
      const timeLeft = Math.ceil((cooldownMs - (Date.now() - lastRefreshTime)) / 1000);
      setNotificationType('error');
      setNotificationMessage(`Please wait ${timeLeft} seconds before refreshing again.`);
      setShowNotification(true);
      return;
    }

    // If using wallet scan modal, show it instead of immediately refreshing
    if (useWalletScanModal) {
      if (!walletAddress || !userId) {
        console.error('Wallet address or user ID is missing for wallet scan modal');
        setNotificationType('error');
        setNotificationMessage('Unable to refresh: wallet information is missing.');
        setShowNotification(true);
        return;
      }

      setShowWalletScanModal(true);
      return;
    }

    // Regular refresh flow
    setIsLoading(true);
    setNotificationType('info');
    setNotificationMessage('Refresh in progress');
    setShowNotification(true);

    try {
      const result = await onRefresh();
      setNotificationType('success');
      setNotificationMessage(result.message || 'Successfully refreshed!');
      setShowNotification(true);
      setLastRefreshTime(Date.now());
      setCooldownTimeLeft(cooldownMs);
    } catch (error) {
      setNotificationType('error');
      setNotificationMessage(error instanceof Error ? error.message : 'Failed to refresh trades.');
      setShowNotification(true);
    } finally {
      setIsLoading(false);
    }
  }, [onRefresh, lastRefreshTime, cooldownMs, useWalletScanModal, walletAddress, userId]);

  // Handle successful wallet scan
  const handleWalletScanSuccess = useCallback((result: { newTradesCount: number, message: string }) => {
    setNotificationType('success');
    setNotificationMessage(result.message);
    setShowNotification(true);
    setLastRefreshTime(Date.now());
    setCooldownTimeLeft(cooldownMs);
  }, [cooldownMs]);

  const handleDismissNotification = useCallback(() => {
    setShowNotification(false);
  }, []);

  return {
    isLoading,
    isOnCooldown: cooldownTimeLeft > 0,
    cooldownTimeLeft,
    showNotification,
    notificationType,
    notificationMessage,
    handleRefresh,
    handleDismissNotification,
    showWalletScanModal,
    setShowWalletScanModal,
    handleWalletScanSuccess
  };
} 
