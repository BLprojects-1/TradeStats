import React from 'react';

interface ApiErrorBannerProps {
  message?: string;
  onRetry?: () => void;
}

const ApiErrorBanner: React.FC<ApiErrorBannerProps> = ({ 
  message = "We're having trouble connecting to the Solana network.", 
  onRetry 
}) => {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-800 p-4 mb-6" role="alert">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">{message}</p>
          <p className="text-xs mt-1">Our servers are working to resolve this issue. Please try again in a few moments.</p>
        </div>
        {onRetry && (
          <div className="ml-auto pl-3">
            <button
              onClick={onRetry}
              className="bg-amber-100 hover:bg-amber-200 text-amber-800 py-1 px-3 rounded text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiErrorBanner; 