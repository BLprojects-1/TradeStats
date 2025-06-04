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
      console.error('TradeStats Retry failed:', err);
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
          "Some older transaction data may be pruned from the blockchain.",
          "TradeStats automatically rotates RPC endpoints to maintain reliability."
        ];
      case 'auth':
        return [
          "Authentication issues may be due to API key rotation or service limits.",
          "Our TradeStats team has been automatically notified of this issue.",
          "Please try again later when our systems have refreshed the API keys.",
          "TradeStats uses multiple authentication providers for redundancy."
        ];
      case 'timeout':
        return [
          "Timeout errors typically occur during high network congestion.",
          "Try loading a smaller date range if available.",
          "The Solana network may be experiencing high traffic volumes.",
          "TradeStats implements smart retry logic to handle network issues."
        ];
      default:
        return [
          "Try refreshing the page and selecting your wallet again.",
          "Check your internet connection stability.",
          "If the problem persists, please try again later.",
          "TradeStats continuously monitors system health for optimal performance."
        ];
    }
  };

  return (
    <div className="bg-gradient-to-r from-orange-900/40 via-red-900/40 to-orange-900/40 border border-orange-500/50 text-orange-200 px-6 py-4 rounded-2xl mb-6 backdrop-blur-sm shadow-lg shadow-orange-500/10">
      <div className="flex flex-col">
        <div className="flex items-start mb-3">
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-3 shadow-lg">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-orange-100 mb-1">TradeStats System Alert</h4>
            <p className="font-medium">{message}</p>
            {retryCount > 2 && (
              <p className="mt-2 text-sm bg-gradient-to-r from-red-500/20 to-orange-500/20 p-2 rounded-lg border border-red-400/30">
                ⚠️ We're experiencing persistent issues. Our TradeStats team is working on it.
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowTips(!showTips)}
            className="text-orange-300 hover:text-orange-100 text-sm font-medium underline decoration-orange-400/50 hover:decoration-orange-300 transition-all duration-200 flex items-center space-x-1"
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${showTips ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>{showTips ? 'Hide TradeStats troubleshooting tips' : 'Show TradeStats troubleshooting tips'}</span>
          </button>
          
          {onRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="group bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 transform hover:scale-105 disabled:hover:scale-100"
            >
              {isRetrying ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Retrying...
                </span>
              ) : (
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try Again
                </span>
              )}
            </button>
          )}
        </div>
        
        {showTips && (
          <div className="mt-4 p-4 bg-gradient-to-br from-orange-900/60 to-red-900/60 rounded-xl text-sm border border-orange-400/30 backdrop-blur-sm">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center mr-2">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-semibold text-orange-200">TradeStats Troubleshooting Guide:</p>
            </div>
            <ul className="list-disc pl-6 space-y-2 text-orange-300">
              {getTroubleshootingTips().map((tip, index) => (
                <li key={index} className="leading-relaxed">{tip}</li>
              ))}
            </ul>
            <div className="mt-3 p-2 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-lg border border-emerald-400/20">
              <p className="text-xs text-emerald-300 flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                TradeStats monitors all systems 24/7 for optimal performance
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiErrorBanner; 