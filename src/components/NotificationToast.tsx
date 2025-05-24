import { useEffect } from 'react';

interface NotificationToastProps {
  message: string;
  type?: 'success' | 'error';
  isVisible: boolean;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function NotificationToast({
  message,
  type = 'success',
  isVisible,
  onDismiss,
  autoDismissMs = 5000 // Default 5 seconds auto-dismiss
}: NotificationToastProps) {
  useEffect(() => {
    if (isVisible && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoDismissMs, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div 
        className={`rounded-lg shadow-lg px-4 py-3 ${
          type === 'success' 
            ? 'bg-green-900 text-green-100' 
            : 'bg-red-900 text-red-100'
        }`}
      >
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">{message}</span>
          <button
            onClick={onDismiss}
            className="ml-2 text-gray-300 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
} 