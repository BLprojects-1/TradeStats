/**
 * Utility functions to help debug Supabase authentication issues
 */
import { supabase } from './supabaseClient';

/**
 * Gets the current auth status and returns detailed information for debugging
 */
export const getAuthDebugInfo = async () => {
  try {
    // Get session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // Get user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    // Try to call debug function if it exists
    let dbDebugResult;
    try {
      const { data: debugData, error: debugError } = await supabase
        .from('debug_auth')
        .select('*');
        
      if (!debugError) {
        dbDebugResult = debugData;
      }
    } catch (e) {
      console.log('Debug function not available:', e);
    }
    
    // Check RLS permissions with simple query
    let hasReadPermission = false;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);
      
      hasReadPermission = !error;
    } catch (e) {
      console.log('Permission check failed:', e);
    }
    
    // Get JWT token for inspection (don't log this in production)
    const token = sessionData?.session?.access_token || null;
    
    // Get token expiry
    let tokenExpiry = null;
    if (token) {
      try {
        // Parse JWT without verification
        const payload = JSON.parse(atob(token.split('.')[1]));
        tokenExpiry = new Date(payload.exp * 1000).toISOString();
      } catch (e) {
        console.log('Could not parse token:', e);
      }
    }
    
    return {
      authenticated: !!sessionData?.session,
      sessionError: sessionError?.message,
      userError: userError?.message,
      userId: userData?.user?.id,
      role: userData?.user?.role,
      email: userData?.user?.email,
      emailConfirmed: userData?.user?.email_confirmed_at,
      dbDebugResult,
      hasReadPermission,
      tokenExpiry
    };
  } catch (error) {
    console.error('Error getting auth debug info:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Checks if the auth session is valid and token hasn't expired
 */
export const isAuthValid = async (): Promise<boolean> => {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch (e) {
    console.error('Auth validation error:', e);
    return false;
  }
}; 