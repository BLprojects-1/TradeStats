import React from 'react';
import UnifiedToast from './UnifiedToast';
import { NotificationItem } from '../hooks/useNotifications';

interface NotificationContainerProps {
  notifications: NotificationItem[];
  onRemoveNotification: (id: string) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onRemoveNotification
}) => {
  // Group notifications by position for proper stacking
  const groupedNotifications = notifications.reduce((groups, notification) => {
    const position = notification.position || 'bottom-right';
    if (!groups[position]) {
      groups[position] = [];
    }
    groups[position].push(notification);
    return groups;
  }, {} as Record<string, NotificationItem[]>);

  return (
    <>
      {Object.entries(groupedNotifications).map(([position, positionNotifications]) =>
        positionNotifications.map((notification, index) => (
          <UnifiedToast
            key={notification.id}
            message={notification.message}
            isVisible={true}
            type={notification.type}
            autoDismissMs={notification.autoDismissMs}
            onDismiss={() => onRemoveNotification(notification.id)}
            stackIndex={index}
            position={position as any}
          />
        ))
      )}
    </>
  );
};

export default NotificationContainer; 