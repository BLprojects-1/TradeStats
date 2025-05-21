import { useEffect, useState } from 'react';

interface LoadingToastProps {
  message?: string;
  isVisible: boolean;
}

export default function LoadingToast({ 
  message = "We're experiencing high traffic, loading your trades now...",
  isVisible 
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

  return (
    <div className={`
      fixed bottom-4 right-4 
      bg-[#1a1a1a] border border-indigo-500/20
      rounded-lg shadow-lg p-4 
      transition-opacity duration-300
      ${isVisible ? 'opacity-100' : 'opacity-0'}
      flex items-center space-x-3
      max-w-md
    `}>
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
      <p className="text-gray-200 text-sm">{message}</p>
    </div>
  );
} 