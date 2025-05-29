import { useEffect, useState } from 'react';

export interface UnifiedToastProps {
  message: string;
  isVisible: boolean;
  type?: 'loading' | 'success' | 'error' | 'info' | 'warning';
  autoDismissMs?: number;
  onDismiss?: () => void;
  stackIndex?: number;
  position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center';
}

const UnifiedToast = ({ 
  message, 
  isVisible, 
  type = 'info', 
  autoDismissMs = 3000, 
  onDismiss,
  stackIndex = 0,
  position = 'bottom-right'
}: UnifiedToastProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
    } else {
      // Add a small delay before hiding to allow for animation
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isVisible && autoDismissMs > 0 && type !== 'loading' && onDismiss) {
      timer = setTimeout(onDismiss, autoDismissMs);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isVisible, autoDismissMs, onDismiss, type]);

  if (!show) return null;

  // Type-specific styling
  const getTypeStyles = () => {
    switch (type) {
      case 'loading':
        return {
          bg: 'bg-[#1a1a1a] border-indigo-500/30',
          text: 'text-gray-200',
          icon: 'text-indigo-400',
          shadow: 'shadow-xl shadow-indigo-500/10'
        };
      case 'success':
        return {
          bg: 'bg-[#1a1a1a] border-green-500/30',
          text: 'text-green-200',
          icon: 'text-green-400',
          shadow: 'shadow-xl shadow-green-500/10'
        };
      case 'error':
        return {
          bg: 'bg-[#1a1a1a] border-red-500/30',
          text: 'text-red-200',
          icon: 'text-red-400',
          shadow: 'shadow-xl shadow-red-500/10'
        };
      case 'warning':
        return {
          bg: 'bg-[#1a1a1a] border-yellow-500/30',
          text: 'text-yellow-200',
          icon: 'text-yellow-400',
          shadow: 'shadow-xl shadow-yellow-500/10'
        };
      default: // info
        return {
          bg: 'bg-[#1a1a1a] border-indigo-500/30',
          text: 'text-indigo-200',
          icon: 'text-indigo-400',
          shadow: 'shadow-xl shadow-indigo-500/10'
        };
    }
  };

  const styles = getTypeStyles();

  // Position-based styling
  const getPositionStyles = () => {
    const spacing = 90; // Space between stacked notifications
    const baseOffset = 16; // Base distance from edge
    
    switch (position) {
      case 'top-right':
        return {
          className: 'fixed top-4 right-4',
          style: { top: `${baseOffset + (stackIndex * spacing)}px` }
        };
      case 'top-center':
        return {
          className: 'fixed top-4 left-1/2 transform -translate-x-1/2',
          style: { top: `${baseOffset + (stackIndex * spacing)}px` }
        };
      case 'bottom-center':
        return {
          className: 'fixed bottom-4 left-1/2 transform -translate-x-1/2',
          style: { bottom: `${baseOffset + (stackIndex * spacing)}px` }
        };
      default: // bottom-right
        return {
          className: 'fixed bottom-4 right-4',
          style: { bottom: `${baseOffset + (stackIndex * spacing)}px` }
        };
    }
  };

  const positionStyles = getPositionStyles();

  // Icon rendering
  const renderIcon = () => {
    const iconClass = `w-5 h-5 ${styles.icon}`;
    
    switch (type) {
      case 'loading':
        return (
          <div className={`animate-spin rounded-full h-5 w-5 border-b-2 border-t-2 ${styles.icon.replace('text-', 'border-')}`} />
        );
      case 'success':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default: // info
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div 
      className={`
        ${positionStyles.className}
        ${styles.bg} border 
        rounded-xl ${styles.shadow}
        backdrop-blur-md p-4 
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-2 scale-95'}
        flex items-center space-x-3
        max-w-sm min-w-[280px]
        z-50
        ${styles.text}
      `}
      style={positionStyles.style}
    >
      <div className="flex-shrink-0">
        {renderIcon()}
      </div>
      <div className="flex-1">
        <p className="text-gray-200 text-sm font-medium leading-5">{message}</p>
      </div>
      {/* Dismiss button for non-loading notifications */}
      {type !== 'loading' && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default UnifiedToast; 