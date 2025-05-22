import { useState } from 'react';

interface ApiErrorBannerProps {
  message: string;
  onRetry?: () => void;
  errorType?: 'rpc' | 'auth' | 'timeout' | 'general';
}

const ApiErrorBanner = ({ message, onRetry, errorType = 'general' }: ApiErrorBannerProps) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showTips, setShowTips] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      await onRetry();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  // Get troubleshooting tips based on error type
  const getTroubleshootingTips = () => {
    switch (errorType) {
      case 'rpc':
        return [
          "RPC services occasionally experience high traffic or maintenance.",
          "Try again in a few minutes as the issue is likely temporary.",
          "Some older transaction data may be pruned from the blockchain."
        ];
      case 'auth':
        return [
          "Authentication issues may be due to API key rotation or service limits.",
          "Our team has been automatically notified of this issue.",
          "Please try again later when our systems have refreshed the API keys."
        ];
      case 'timeout':
        return [
          "Timeout errors typically occur during high network congestion.",
          "Try loading a smaller date range if available.",
          "The Solana network may be experiencing high traffic volumes."
        ];
      default:
        return [
          "Try refreshing the page and selecting your wallet again.",
          "Check your internet connection.",
          "If the problem persists, please try again later."
        ];
    }
  };

  return (
    <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-200 px-4 py-3 rounded mb-6">
      <div className="flex flex-col">
        <div className="flex items-start mb-2">
          <svg className="h-5 w-5 text-indigo-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium">{message}</p>
            {retryCount > 2 && (
              <p className="mt-1 text-sm">We're experiencing persistent issues. Our team is working on it.</p>
            )}
        </div>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowTips(!showTips)}
            className="text-indigo-300 hover:text-indigo-100 text-sm underline"
          >
            {showTips ? 'Hide troubleshooting tips' : 'Show troubleshooting tips'}
          </button>
          
        {onRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
            >
              {isRetrying ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Retrying...
                </span>
              ) : 'Try again'}
            </button>
          )}
        </div>
        
        {showTips && (
          <div className="mt-3 p-3 bg-indigo-900/50 rounded text-sm">
            <p className="font-medium mb-2">Troubleshooting tips:</p>
            <ul className="list-disc pl-5 space-y-1">
              {getTroubleshootingTips().map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiErrorBanner; 