import { supabase } from './supabaseClient';

/**
 * Function to test Supabase authentication and profile access
 */
export const testSupabaseAuth = async () => {
  console.log('========== SUPABASE AUTH DEBUGGING ==========');
  
  try {
    // Step 1: Check session
    console.log('1. Checking current session...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return { success: false, error: sessionError };
    }
    
    if (!sessionData.session) {
      console.log('No active session found. User is not logged in.');
      return { success: false, error: 'No active session' };
    }
    
    console.log('Session found:', {
      userId: sessionData.session.user.id,
      email: sessionData.session.user.email,
      expiresAt: new Date(sessionData.session.expires_at! * 1000).toISOString()
    });
    
    // Step 2: Test direct access to user_profiles
    console.log('\n2. Testing direct access to user_profiles...');
    const userId = sessionData.session.user.id;
    
    // Log full request for debugging
    const originalFetch = globalThis.fetch;
    
    // Temporarily override fetch to log requests
    globalThis.fetch = async (...args) => {
      console.log('Fetch request:', {
        url: args[0],
        options: args[1] ? {
          method: args[1].method,
          headers: args[1].headers,
        } : 'N/A'
      });
      
      const response = await originalFetch(...args);
      
      // Clone the response so we can log it and still return it
      const clone = response.clone();
      const responseData = await clone.text();
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      try {
        // Try to parse as JSON
        const jsonData = JSON.parse(responseData);
        console.log('Response data:', jsonData);
      } catch {
        // If not JSON, show as text
        console.log('Response data (text):', responseData.substring(0, 500) + (responseData.length > 500 ? '...' : ''));
      }
      
      return response;
    };
    
    try {
      console.log('Querying user_profiles table...');
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('Error accessing user_profiles:', profileError);
        console.error('Error details:', {
          code: profileError.code,
          message: profileError.message,
          hint: profileError.hint || 'N/A',
          details: profileError.details || 'N/A'
        });
      } else {
        console.log('Successfully retrieved profile:', profileData);
      }
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
    
    // Step 3: Test creating a test profile if none exists
    console.log('\n3. Testing profile creation if needed...');
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (!existingProfile) {
      console.log('No profile exists, attempting to create one...');
      const { data: insertedProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert([{ id: userId, display_name: 'Test User' }])
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating test profile:', insertError);
      } else {
        console.log('Successfully created test profile:', insertedProfile);
      }
    } else {
      console.log('Profile already exists, skipping creation test');
    }
    
    return { 
      success: true, 
      userId, 
      email: sessionData.session.user.email 
    };
  } catch (error) {
    console.error('Uncaught error during authentication test:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  } finally {
    console.log('========== END DEBUGGING ==========');
  }
};

// If this file is run directly
if (typeof window === 'undefined' && require.main === module) {
  testSupabaseAuth().then(result => {
    console.log('Test completed with result:', result);
    process.exit(0);
  }).catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
}
