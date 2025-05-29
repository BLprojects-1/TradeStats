import { useState, useCallback } from 'react';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'loading';
  autoDismissMs?: number;
  isVisible: boolean;
}

export const useNotificationStack = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((
    message: string, 
    type: 'success' | 'error' | 'info' | 'loading' = 'info',
    autoDismissMs: number = 3000
  ) => {
    const id = Date.now().toString() + Math.random().toString(36);
    const newNotification: Notification = {
      id,
      message,
      type,
      autoDismissMs,
      isVisible: true
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-dismiss if specified
    if (autoDismissMs > 0 && type !== 'loading') {
      setTimeout(() => {
        removeNotification(id);
      }, autoDismissMs);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
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

  return {
    notifications,
    addNotification,
    removeNotification,
    updateNotification,
    clearAllNotifications
  };
}; 