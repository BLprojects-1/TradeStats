import { useEffect, useState } from 'react';

interface NotificationToastProps {
  message: string;
  isVisible: boolean;
  type?: 'success' | 'info' | 'warning' | 'error';
  duration?: number; // Auto-hide duration in milliseconds
}

export default function NotificationToast({ 
  message,
  isVisible,
  type = 'success',
  duration = 3000
}: NotificationToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      
      // Auto-hide after duration
      if (duration > 0) {
        const timer = setTimeout(() => setShow(false), duration);
        return () => clearTimeout(timer);
      }
    } else {
      // Add a small delay before hiding to allow for animation
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  if (!show) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'border-green-500/20 text-green-200';
      case 'info':
        return 'border-indigo-500/20 text-indigo-200';
      case 'warning':
        return 'border-yellow-500/20 text-yellow-200';
      case 'error':
        return 'border-red-500/20 text-red-200';
      default:
        return 'border-green-500/20 text-green-200';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`
      fixed bottom-4 right-4 z-50
      bg-[#1a1a1a] border ${getTypeStyles()}
      rounded-lg shadow-lg p-4 
      transition-all duration-300 ease-in-out
      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      flex items-center space-x-3
      max-w-md
    `}>
      {getIcon()}
      <p className={`text-sm font-medium ${getTypeStyles().split(' ')[1]}`}>{message}</p>
    </div>
  );
} 