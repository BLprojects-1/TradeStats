import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: true, // Enable debug logs for authentication
  }
});

// Log when auth state changes to help with debugging
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session ? 'User session exists' : 'No user session');
});

// Helper function to check if a user has confirmed their email
export const isEmailConfirmed = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error in isEmailConfirmed:', error);
      throw error;
    }
    
    if (data.session && data.session.user) {
      console.log('User has confirmed email and has active session');
      return true;
    }
    
    console.log('No active session found, email may not be confirmed');
    return false;
  } catch (error) {
    console.error('Error checking email confirmation:', error);
    return false;
  }
};

// Helper function to get current user
export const getCurrentUser = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error in getCurrentUser:', error);
      throw error;
    }
    
    console.log('Current user data:', data.user);
    return data.user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}; 