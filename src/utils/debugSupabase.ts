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

    // Check RLS permissions with more detailed error handling
    let profileQueryResult: { 
      hasReadPermission: boolean; 
      error: { code?: string; message: string; details?: string; status?: number; } | null; 
      data: any; 
    } = { 
      hasReadPermission: false, 
      error: null, 
      data: null 
    };
    try {
      if (userData?.user?.id) {
        const { data, error, status } = await supabase
          .from('user_profiles')
          .select('id, display_name')
          .eq('id', userData.user.id)
          .single();

        profileQueryResult = {
          hasReadPermission: !error,
          error: error ? { code: error.code, message: error.message, details: error.details, status } : null,
          data: data
        };
      } else {
        profileQueryResult.error = { message: "No user ID available for profile query" };
      }
    } catch (e) {
      console.log('Permission check failed:', e);
      profileQueryResult.error = { message: e instanceof Error ? e.message : 'Unknown error' };
    }

    // Get JWT token for inspection (don't log this in production)
    const token = sessionData?.session?.access_token || null;

    // Get token expiry and additional payload info
    let tokenInfo = null;
    if (token) {
      try {
        // Parse JWT without verification
        const payload = JSON.parse(atob(token.split('.')[1]));
        tokenInfo = {
          expiry: new Date(payload.exp * 1000).toISOString(),
          role: payload.role,
          aud: payload.aud,
          sub: payload.sub,
        };
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
      profileQueryResult,
      tokenInfo,
      headers: supabase.rest.headers
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
