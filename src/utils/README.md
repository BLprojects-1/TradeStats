# Authentication System in Journi

This document provides an overview of how authentication works in Journi.

## Overview

Journi uses Supabase for authentication, with the following features:

- Email/password authentication
- Email confirmation
- Password reset
- JWT-based session management
- Row Level Security (RLS) for data access control

## Key Files

- `supabaseClient.ts` - Creates the Supabase client instance
- `contexts/AuthContext.tsx` - React context for auth state management
- `debugSupabase.ts` - Utilities for debugging auth issues

## Authentication Flow

1. **Sign Up**:
   - User enters email/password in `SignUpModal.tsx`
   - Confirmation email is sent (required)
   - User clicks link in email to verify account
   - Redirected to `auth/callback.tsx` for verification

2. **Sign In**:
   - User enters credentials in `SignInModal.tsx`
   - On success, redirected to dashboard
   - Session information stored in browser

3. **Session Management**:
   - `AuthContext.tsx` provides app-wide access to auth state
   - Auto-refreshes tokens
   - Handles auth state changes

4. **Data Access**:
   - After authentication, the JWT token is used for database access
   - Row Level Security (RLS) policies determine what data the user can access
   - Each database table has RLS policies to restrict access to the user's own data

## Common Issues

### 401 Unauthorized Errors

If encountering 401 errors when accessing data:

1. Ensure RLS policies are correctly set up (see `supabase/migrations/20240529_fix_rls_auth_issue.sql`)
2. Verify the JWT token is valid using `debugSupabase.ts`
3. Check that the user is properly authenticated

### Session Expiration

- JWT tokens expire after about 1 hour
- Supabase automatically refreshes tokens using a refresh token
- If refresh fails, user may need to re-authenticate

## Using the Auth Context

To use auth-related functionality in components:

```tsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, loading, signOut, refreshSession } = useAuth();
  
  // Check if user is authenticated
  if (!user) return <p>Please log in</p>;
  
  // Use user information
  return <p>Welcome, {user.email}</p>;
}
```

## Debugging

For auth-related debugging, use the `getAuthDebugInfo` function:

```tsx
import { getAuthDebugInfo } from '../utils/debugSupabase';

// Inside your component
const debugInfo = await getAuthDebugInfo();
console.log(debugInfo);
```

This provides detailed information about the current auth state. 