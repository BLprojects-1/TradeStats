import { useState, useCallback } from 'react';

export interface NotificationItem {
  id: string;
  message: string;
  type: 'loading' | 'success' | 'error' | 'info' | 'warning';
  autoDismissMs?: number;
  position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center';
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const addNotification = useCallback((
    message: string,
    type: NotificationItem['type'] = 'info',
    options?: {
      autoDismissMs?: number;
      position?: NotificationItem['position'];
      id?: string;
    }
  ): string => {
    const id = options?.id || `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newNotification: NotificationItem = {
      id,
      message,
      type,
      autoDismissMs: options?.autoDismissMs ?? (type === 'loading' ? 0 : 3000),
      position: options?.position ?? 'bottom-right'
    };

    setNotifications(prev => [...prev, newNotification]);
    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<NotificationItem>) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, ...updates }
          : notification
      )
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods for different notification types
  const showLoading = useCallback((message: string, options?: { id?: string; position?: NotificationItem['position'] }) => {
    return addNotification(message, 'loading', options);
  }, [addNotification]);

  const showSuccess = useCallback((message: string, options?: { autoDismissMs?: number; position?: NotificationItem['position'] }) => {
    return addNotification(message, 'success', options);
  }, [addNotification]);

  const showError = useCallback((message: string, options?: { autoDismissMs?: number; position?: NotificationItem['position'] }) => {
    return addNotification(message, 'error', options);
  }, [addNotification]);

  const showInfo = useCallback((message: string, options?: { autoDismissMs?: number; position?: NotificationItem['position'] }) => {
    return addNotification(message, 'info', options);
  }, [addNotification]);

  const showWarning = useCallback((message: string, options?: { autoDismissMs?: number; position?: NotificationItem['position'] }) => {
    return addNotification(message, 'warning', options);
  }, [addNotification]);

  // Utility method to replace a loading notification with a success/error
  const replaceNotification = useCallback((id: string, message: string, type: 'success' | 'error' | 'info' | 'warning', autoDismissMs = 3000) => {
    updateNotification(id, { message, type, autoDismissMs });
  }, [updateNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    updateNotification,
    clearAllNotifications,
    showLoading,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    replaceNotification
  };
}; 