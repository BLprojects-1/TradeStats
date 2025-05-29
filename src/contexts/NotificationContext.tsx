import React, { createContext, useContext, ReactNode } from 'react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationContextType {
  showLoading: (message: string, options?: { id?: string; position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center' }) => string;
  showSuccess: (message: string, options?: { autoDismissMs?: number; position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center' }) => string;
  showError: (message: string, options?: { autoDismissMs?: number; position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center' }) => string;
  showInfo: (message: string, options?: { autoDismissMs?: number; position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center' }) => string;
  showWarning: (message: string, options?: { autoDismissMs?: number; position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center' }) => string;
  removeNotification: (id: string) => void;
  replaceNotification: (id: string, message: string, type: 'success' | 'error' | 'info' | 'warning', autoDismissMs?: number) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const {
    showLoading,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    removeNotification,
    replaceNotification,
    clearAllNotifications
  } = useNotifications();

  const value: NotificationContextType = {
    showLoading,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    removeNotification,
    replaceNotification,
    clearAllNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 