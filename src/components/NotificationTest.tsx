import React from 'react';
import { useNotificationContext } from '../contexts/NotificationContext';

const NotificationTest: React.FC = () => {
  const { showLoading, showSuccess, showError, showInfo, showWarning, replaceNotification } = useNotificationContext();

  const handleTestLoading = () => {
    const loadingId = showLoading('Processing your request...');
    
    // Simulate async operation
    setTimeout(() => {
      replaceNotification(loadingId, 'Operation completed successfully!', 'success');
    }, 3000);
  };

  const handleTestSuccess = () => {
    showSuccess('This is a success notification!');
  };

  const handleTestError = () => {
    showError('This is an error notification!');
  };

  const handleTestInfo = () => {
    showInfo('This is an info notification!');
  };

  const handleTestWarning = () => {
    showWarning('This is a warning notification!');
  };

  const handleTestPositions = () => {
    showSuccess('Top Right!', { position: 'top-right' });
    setTimeout(() => showInfo('Top Center!', { position: 'top-center' }), 500);
    setTimeout(() => showWarning('Bottom Center!', { position: 'bottom-center' }), 1000);
    setTimeout(() => showError('Bottom Right!', { position: 'bottom-right' }), 1500);
  };

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-semibold text-white mb-4">Notification System Test</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <button
          onClick={handleTestLoading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          Test Loading → Success
        </button>
        
        <button
          onClick={handleTestSuccess}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          Test Success
        </button>
        
        <button
          onClick={handleTestError}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Test Error
        </button>
        
        <button
          onClick={handleTestInfo}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Test Info
        </button>
        
        <button
          onClick={handleTestWarning}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
        >
          Test Warning
        </button>
        
        <button
          onClick={handleTestPositions}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          Test All Positions
        </button>
      </div>
    </div>
  );
};

export default NotificationTest; 