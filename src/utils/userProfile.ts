import { supabase } from './supabaseClient';

export interface UserProfile {
  id: string;
  display_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface TrackedWallet {
  id: string;
  user_id: string;
  wallet_address: string;
  label?: string;
  nickname?: string;
  initial_scan_complete?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const createUserProfile = async (userId: string, displayName: string): Promise<UserProfile | null> => {
  try {
    console.log('Creating user profile for userId:', userId, 'with display name:', displayName);
    
    // First check if the user session exists instead of explicitly fetching the user
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      throw new Error(`Auth session check failed: ${sessionError.message}`);
    }
    
    if (!sessionData.session || !sessionData.session.user) {
      console.error('No active session found');
      throw new Error('Authentication required. Please sign in again.');
    }
    
    // Verify the user from the session matches the provided userId
    if (sessionData.session.user.id !== userId) {
      console.error('User ID mismatch:', {
        providedUserId: userId,
        sessionUserId: sessionData.session.user.id
      });
      throw new Error('User ID validation failed. The provided ID does not match the authenticated user.');
    }
    
    // If user exists, proceed with profile creation
    const { data, error } = await supabase
      .from('user_profiles')
      .insert([
        {
          id: userId,
          display_name: displayName,
        },
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }

    console.log('User profile created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in createUserProfile:', error);
    throw error; // Rethrow to allow proper handling in the UI
  }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    console.log('Fetching user profile for userId:', userId);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is code for "no rows returned"
      console.error('Error fetching user profile:', error);
      throw error;
    }

    console.log('User profile fetched:', data || 'No profile found');
    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, displayName: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    throw error;
  }
};

export const addTrackedWallet = async (userId: string, walletAddress: string, label?: string): Promise<TrackedWallet | null> => {
  try {
    console.log('Adding tracked wallet for userId:', userId, 'with address:', walletAddress);
    
    // Validate the wallet address format
    if (!walletAddress || !/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(walletAddress)) {
      throw new Error('Invalid Solana wallet address format');
    }
    
    // Verify session and user authentication
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      throw new Error(`Auth session check failed: ${sessionError.message}`);
    }
    
    if (!sessionData.session || !sessionData.session.user) {
      console.error('No active session found');
      throw new Error('Authentication required. Please sign in again.');
    }
    
    // Verify the user from the session matches the provided userId
    if (sessionData.session.user.id !== userId) {
      console.error('User ID mismatch:', {
        providedUserId: userId,
        sessionUserId: sessionData.session.user.id
      });
      throw new Error('User ID validation failed. The provided ID does not match the authenticated user.');
    }
    
    const { data, error } = await supabase
      .from('tracked_wallets')
      .insert([
        {
          user_id: userId,
          wallet_address: walletAddress,
          label: label || 'My Wallet',
        },
      ])
      .select('*')
      .single();

    if (error) {
      // Check for specific errors
      if (error.code === '23505') {
        throw new Error(`Wallet address already exists: ${walletAddress}`);
      }
      if (error.code === '23503') {
        throw new Error(`Foreign key violation. User ID may not exist: ${userId}`);
      }
      
      console.error('Error adding tracked wallet:', error);
      throw error;
    }

    console.log('Wallet added successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in addTrackedWallet:', error);
    throw error; // Rethrow to allow UI layer to handle
  }
};

export const getTrackedWallets = async (userId: string): Promise<TrackedWallet[]> => {
  try {
    console.log('Fetching tracked wallets for userId:', userId);
    
    const { data, error } = await supabase
      .from('tracked_wallets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tracked wallets:', error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} wallets for user`);
    return data || [];
  } catch (error) {
    console.error('Error in getTrackedWallets:', error);
    return [];
  }
};

export const removeTrackedWallet = async (walletId: string): Promise<boolean> => {
  try {
    console.log('Removing wallet with id:', walletId);
    
    const { error } = await supabase
      .from('tracked_wallets')
      .delete()
      .eq('id', walletId);

    if (error) {
      console.error('Error removing tracked wallet:', error);
      throw error;
    }

    console.log('Wallet removed successfully');
    return true;
  } catch (error) {
    console.error('Error in removeTrackedWallet:', error);
    return false;
  }
};

export const hasCompletedOnboarding = async (userId: string): Promise<boolean> => {
  try {
    console.log('Checking if user has completed onboarding:', userId);
    const profile = await getUserProfile(userId);
    const result = !!profile;
    console.log('Onboarding status:', result ? 'Completed' : 'Not completed');
    return result;
  } catch (error) {
    console.error('Error in hasCompletedOnboarding:', error);
    return false;
  }
};

export const deleteUserAccount = async (userId: string): Promise<void> => {
  // Delete from user_profiles table
  await supabase.from('user_profiles').delete().eq('id', userId);
  // Delete from Supabase Auth (admin privilege required)
  // If you don't have admin, you can only delete your own user via supabase.auth.signOut()
  if (supabase.auth.admin && typeof supabase.auth.admin.deleteUser === 'function') {
    await supabase.auth.admin.deleteUser(userId);
  } else {
    // fallback: sign out (user will need to be deleted manually from Auth dashboard)
    await supabase.auth.signOut();
  }
}; 