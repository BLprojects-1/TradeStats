import { useEffect } from 'react';

interface NotificationToastProps {
  message: string;
  isVisible: boolean;
  type?: 'success' | 'error' | 'info';
  autoDismissMs?: number;
  onDismiss: () => void;
}

const NotificationToast = ({ message, isVisible, type = 'info', autoDismissMs = 3000, onDismiss }: NotificationToastProps) => {
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isVisible && autoDismissMs > 0) {
      timer = setTimeout(onDismiss, autoDismissMs);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isVisible, autoDismissMs, onDismiss]);

  if (!isVisible) return null;

  const bgColor = type === 'success' ? 'bg-green-900/30 border-green-500' :
                 type === 'error' ? 'bg-red-900/30 border-red-500' :
                 'bg-blue-900/30 border-blue-500';

  const textColor = type === 'success' ? 'text-green-200' :
                   type === 'error' ? 'text-red-200' :
                   'text-blue-200';

  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg border ${bgColor} ${textColor} z-50`}>
      <div className="flex items-center space-x-2">
        {type === 'success' && (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {type === 'error' && (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {type === 'info' && (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span>{message}</span>
      </div>
    </div>
  );
};

export default NotificationToast; 