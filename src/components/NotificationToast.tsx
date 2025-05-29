import { useEffect } from 'react';

interface NotificationToastProps {
  message: string;
  isVisible: boolean;
  type?: 'success' | 'error' | 'info';
  autoDismissMs?: number;
  onDismiss: () => void;
  stackIndex?: number;
}

const NotificationToast = ({ 
  message, 
  isVisible, 
  type = 'info', 
  autoDismissMs = 3000, 
  onDismiss,
  stackIndex = 0
}: NotificationToastProps) => {
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

  const bgColor = type === 'success' ? 'bg-green-900/30 border-green-500/20' :
                 type === 'error' ? 'bg-red-900/30 border-red-500/20' :
                 'bg-indigo-900/30 border-indigo-500/20';

  const textColor = type === 'success' ? 'text-green-200' :
                   type === 'error' ? 'text-red-200' :
                   'text-indigo-200';

  const iconColor = type === 'success' ? 'text-green-400' :
                   type === 'error' ? 'text-red-400' :
                   'text-indigo-400';

  // Calculate bottom position based on stack index
  const bottomPosition = 4 + (stackIndex * 80); // 80px spacing between notifications

  return (
    <div 
      className={`
        fixed right-4 
        bg-[#1a1a1a] border ${bgColor.split(' ')[1]}
        rounded-lg shadow-lg p-4 
        transition-all duration-300
        flex items-center space-x-3
        max-w-md
        z-50
        ${textColor}
      `}
      style={{ bottom: `${bottomPosition}px` }}
    >
      <div className={iconColor}>
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
      </div>
      <p className="text-gray-200 text-sm">{message}</p>
    </div>
  );
};

export default NotificationToast; 