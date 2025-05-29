import React from 'react';
import NotificationToast from './NotificationToast';
import LoadingToast from './LoadingToast';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'loading';
  autoDismissMs?: number;
  isVisible: boolean;
}

interface NotificationStackProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

const NotificationStack: React.FC<NotificationStackProps> = ({ notifications, onDismiss }) => {
  const visibleNotifications = notifications.filter(n => n.isVisible);

  return (
    <>
      {visibleNotifications.map((notification, index) => {
        if (notification.type === 'loading') {
          return (
            <LoadingToast
              key={notification.id}
              message={notification.message}
              isVisible={notification.isVisible}
              stackIndex={index}
            />
          );
        }

        return (
          <NotificationToast
            key={notification.id}
            message={notification.message}
            isVisible={notification.isVisible}
            type={notification.type as 'success' | 'error' | 'info'}
            autoDismissMs={notification.autoDismissMs}
            stackIndex={index}
            onDismiss={() => onDismiss(notification.id)}
          />
        );
      })}
    </>
  );
};

export default NotificationStack; 