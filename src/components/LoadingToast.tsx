import { useEffect, useState } from 'react';

interface LoadingToastProps {
  message?: string;
  isVisible: boolean;
  stackIndex?: number;
}

export default function LoadingToast({ 
  message = "We're experiencing high traffic, loading your trades now...",
  isVisible,
  stackIndex = 0
}: LoadingToastProps) {
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

  if (!show) return null;

  // Calculate bottom position based on stack index
  const bottomPosition = 4 + (stackIndex * 80); // 80px spacing between notifications

  return (
    <div 
      className={`
        fixed right-4 
        bg-[#1a1a1a] border border-indigo-500/20
        rounded-lg shadow-lg p-4 
        transition-all duration-300
        ${isVisible ? 'opacity-100' : 'opacity-0'}
        flex items-center space-x-3
        max-w-md
        z-50
      `}
      style={{ bottom: `${bottomPosition}px` }}
    >
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400"></div>
      <p className="text-gray-200 text-sm">{message}</p>
    </div>
  );
} 