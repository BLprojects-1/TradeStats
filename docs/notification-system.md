# Unified Notification System

This app now uses a unified notification system that provides consistent styling and behavior across all popups and messages.

## Components

### 1. UnifiedToast
The main notification component that displays all types of messages with consistent styling.

### 2. NotificationContainer
Manages the display of multiple notifications and handles proper stacking.

### 3. useNotifications Hook
Provides methods to manage notifications within any component.

### 4. NotificationProvider Context
Makes notification methods available throughout the dashboard.

## Usage

### Basic Usage in Dashboard Pages

```tsx
import { useNotificationContext } from '../../contexts/NotificationContext';

export default function MyDashboardPage() {
  const { showLoading, showSuccess, showError, showInfo, showWarning, replaceNotification } = useNotificationContext();

  const handleRefresh = async () => {
    // Show loading notification
    const loadingId = showLoading('Loading comprehensive trading data...');
    
    try {
      await refreshData();
      
      // Replace loading with success
      replaceNotification(loadingId, 'Data refreshed successfully!', 'success');
    } catch (error) {
      // Replace loading with error
      replaceNotification(loadingId, 'Failed to refresh data.', 'error');
    }
  };

  const handleSimpleAction = () => {
    // Simple success message
    showSuccess('Trade added to watchlist!');
    
    // Error with custom duration
    showError('Failed to connect to wallet', { autoDismissMs: 5000 });
    
    // Info message positioned at top
    showInfo('New features available!', { position: 'top-center' });
    
    // Warning message
    showWarning('This action cannot be undone');
  };

  return (
    // Your component JSX
  );
}
```

## Notification Types

### 1. Loading
- **Purpose**: Show progress for async operations
- **Auto-dismiss**: No (must be manually replaced/removed)
- **Icon**: Spinning loader
- **Color**: Indigo

```tsx
const loadingId = showLoading('Processing your request...');
```

### 2. Success
- **Purpose**: Confirm successful operations
- **Auto-dismiss**: Yes (3 seconds default)
- **Icon**: Checkmark
- **Color**: Green

```tsx
showSuccess('Trade executed successfully!');
```

### 3. Error
- **Purpose**: Show error messages and failures
- **Auto-dismiss**: Yes (3 seconds default)
- **Icon**: X mark
- **Color**: Red

```tsx
showError('Failed to connect to wallet');
```

### 4. Info
- **Purpose**: General information messages
- **Auto-dismiss**: Yes (3 seconds default)
- **Icon**: Info circle
- **Color**: Indigo

```tsx
showInfo('Market data updated');
```

### 5. Warning
- **Purpose**: Important warnings and cautions
- **Auto-dismiss**: Yes (3 seconds default)
- **Icon**: Warning triangle
- **Color**: Yellow

```tsx
showWarning('Transaction fees are high');
```

## Advanced Usage

### Custom Options

```tsx
// Custom position and duration
showSuccess('Trade completed!', {
  autoDismissMs: 5000,
  position: 'top-right'
});

// Custom loading ID for replacement
const myLoadingId = showLoading('Custom loading...', {
  id: 'my-unique-id',
  position: 'bottom-center'
});
```

### Replace Loading with Result

```tsx
const handleAsyncOperation = async () => {
  const loadingId = showLoading('Processing...');
  
  try {
    const result = await apiCall();
    replaceNotification(loadingId, 'Operation completed!', 'success');
  } catch (error) {
    replaceNotification(loadingId, error.message, 'error');
  }
};
```

## Migration from Old System

### Before (old systems):
```tsx
// Old LoadingToast
<LoadingToast isVisible={loading} message="Loading..." />

// Old NotificationToast
<NotificationToast 
  isVisible={showNotif} 
  message="Success!" 
  type="success" 
  onDismiss={() => setShowNotif(false)} 
/>

// Old useRefreshButton
const { showNotification, notificationType, notificationMessage } = useRefreshButton(...);
```

### After (unified system):
```tsx
// New unified approach
const { showLoading, showSuccess, showError } = useNotificationContext();

// Show loading
const loadingId = showLoading('Loading...');

// Show success  
showSuccess('Success!');

// Show error
showError('Something went wrong');
```

## Benefits

1. **Consistent Styling**: All notifications look the same across the app
2. **Smart Stacking**: Multiple notifications stack properly without overlapping
3. **Type Safety**: TypeScript ensures correct usage
4. **Easy Replacement**: Loading notifications can be easily replaced with results
5. **Flexible Positioning**: Notifications can appear in different screen positions
6. **Auto-dismiss**: Non-loading notifications automatically disappear
7. **Manual Control**: Notifications can be manually dismissed when needed

## Best Practices

1. **Use Loading for Async Operations**: Always show loading notifications for operations that take time
2. **Replace Loading with Results**: Don't just dismiss loading - replace with success/error
3. **Keep Messages Short**: Notification text should be concise and clear  
4. **Use Appropriate Types**: Choose the right notification type for the context
5. **Handle Errors Gracefully**: Always show error notifications when operations fail
6. **Don't Overwhelm**: Avoid showing too many notifications at once 