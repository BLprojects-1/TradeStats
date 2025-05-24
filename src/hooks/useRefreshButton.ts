import { useState, useCallback, useEffect } from 'react';

interface UseRefreshButtonOptions {
  cooldownMs?: number;
  onRefresh: () => Promise<{ newTradesCount: number, message: string }>;
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
}

export function useRefreshButton({
  cooldownMs = 120000, // Default 2 minutes
  onRefresh
}: UseRefreshButtonOptions): UseRefreshButtonReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error' | 'info'>('success');
  const [notificationMessage, setNotificationMessage] = useState('');

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

    setIsLoading(true);
    setNotificationType('info');
    setNotificationMessage('Refresh in progress');
    setShowNotification(true);
    
    try {
      const result = await onRefresh();
      setNotificationType('success');
      setNotificationMessage('Successfully refreshed!');
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
  }, [onRefresh, lastRefreshTime, cooldownMs]);

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
    handleDismissNotification
  };
} 