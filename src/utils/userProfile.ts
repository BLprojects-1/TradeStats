import { supabase } from './supabaseClient';
import { tradingHistoryService } from '../services/tradingHistoryService';

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

    // Check if a profile already exists
    const existingProfile = await getUserProfile(userId);
    if (existingProfile) {
      console.log('Profile already exists, cleaning up old data...');

      // Delete any existing tracked wallets
      const { error: walletsError } = await supabase
        .from('tracked_wallets')
        .delete()
        .eq('user_id', userId);

      if (walletsError) {
        console.error('Error cleaning up old wallets:', walletsError);
        throw walletsError;
      }

      // Update the existing profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('user_profiles')
        .update({ display_name: displayName, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating existing profile:', updateError);
        throw updateError;
      }

      console.log('Profile updated successfully:', updatedProfile);
      return updatedProfile;
    }

    // If no existing profile, create a new one
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

    if (!userId) {
      console.error('Invalid userId provided:', userId);
      return null;
    }

    // First check the auth session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Session error:', sessionError);
      throw sessionError;
    }

    if (!sessionData.session) {
      console.log('No active session found when fetching profile');
      return null;
    }

    // Verify authentication matches requested user
    const authenticatedUserId = sessionData.session.user.id;
    console.log('Authenticated user ID:', authenticatedUserId);

    // For security, normally we would only allow users to access their own profiles
    // But if there's a mismatch and you need to allow it, uncomment and modify this code:
    /*
    if (authenticatedUserId !== userId) {
      console.warn('User ID mismatch - attempting to access another user profile', {
        authenticatedUserId,
        requestedUserId: userId
      });
      // Determine if this is allowed in your application
    }
    */

    // Try to get the profile with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let profileData = null;
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`Attempt ${attempts} to fetch profile...`);

        // Use maybeSingle instead of single to avoid errors on missing rows
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, display_name, created_at, updated_at')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.error(`Error on attempt ${attempts}:`, error);
          lastError = error;

          // If it's a permission error, wait briefly and retry
          if (error.code === 'PGRST301' || error.code === '42501') {
            await new Promise(resolve => setTimeout(resolve, 500 * attempts));
            continue;
          } else {
            // For other errors, throw immediately
            throw error;
          }
        }

        profileData = data;
        break; // Exit the loop if successful
      } catch (e) {
        console.error(`Exception on attempt ${attempts}:`, e);
        lastError = e;

        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempts));
        }
      }
    }

    if (profileData) {
      console.log('User profile fetched successfully');
      return profileData;
    } else {
      if (lastError) {
        console.error('All attempts failed. Last error:', lastError);
        // Return null instead of throwing to keep app working
        return null;
      }
      console.log('No profile found for user:', userId);
      return null;
    }
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    // Return null instead of re-throwing to avoid breaking the app
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

/**
 * Validates a Solana wallet address
 * @param walletAddress The wallet address to validate
 * @returns true if the address is valid, false otherwise
 */
export const isValidSolanaAddress = (walletAddress: string): boolean => {
  if (!walletAddress) return false;

  // Solana addresses are base58 encoded and 32-44 characters long
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    return false;
  }

  // Additional validation to ensure it's not a UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(walletAddress)) {
    return false;
  }

  return true;
};

export const addTrackedWallet = async (userId: string, walletAddress: string, label?: string): Promise<TrackedWallet | null> => {
  try {
    console.log('Adding tracked wallet for userId:', userId, 'with address:', walletAddress);

    // Validate the wallet address format
    if (!isValidSolanaAddress(walletAddress)) {
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

    // First, insert the wallet
    const { data: walletData, error: insertError } = await supabase
      .from('tracked_wallets')
      .insert([
        {
          user_id: userId,
          wallet_address: walletAddress,
          label: label || 'My Wallet',
          initial_scan_complete: false
        },
      ])
      .select('*')
      .single();

    if (insertError) {
      // Check for specific errors
      if (insertError.code === '23505') {
        throw new Error(`Wallet address already exists: ${walletAddress}`);
      }
      if (insertError.code === '23503') {
        throw new Error(`Foreign key violation. User ID may not exist: ${userId}`);
      }

      console.error('Error adding tracked wallet:', insertError);
      throw insertError;
    }

    if (!walletData) {
      throw new Error('Failed to create wallet record');
    }

    // Trigger initial scan in the background
    try {
      // Get transactions from the last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      await tradingHistoryService.getTradingHistory(
        userId,
        walletAddress,
        1000, // Get a large number of trades
        1,
        oneDayAgo.getTime()
      );

      // Removed: update to initial_scan_complete. This is now handled by tradingHistoryService only.

      // console.log(`Initial scan completed for wallet ${walletAddress}. Found ${result.trades.length} trades.`);
    } catch (scanError) {
      console.error('Error during initial scan:', scanError);
      // Don't throw here, as the wallet was successfully added
      // The scan can be retried later
    }

    return walletData;
  } catch (error) {
    console.error('Error in addTrackedWallet:', error);
    throw error;
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

    // Check for user profile
    let profile = await getUserProfile(userId);

    // If no profile exists, check if user has wallets
    if (!profile) {
      const wallets = await getTrackedWallets(userId);
      console.log('Found', wallets.length, 'wallets for user');

      // If user has wallets but no profile, create a profile automatically
      if (wallets.length > 0) {
        console.log('User has wallets but no profile. Creating profile automatically.');
        try {
          // Create a default profile with the user's ID as the display name
          profile = await createUserProfile(userId, `User-${userId.substring(0, 8)}`);
          console.log('Profile created automatically:', profile);
        } catch (profileError) {
          console.error('Error creating profile automatically:', profileError);
        }
      }
    }

    const result = !!profile;

    console.log('Onboarding status:', result ? 'Completed' : 'Not completed', {
      hasProfile: !!profile
    });

    return result;
  } catch (error) {
    console.error('Error in hasCompletedOnboarding:', error);
    return false;
  }
};

export const deleteUserAccount = async (userId: string): Promise<void> => {
  try {
    console.log('Deleting user account:', userId);

    // Delete tracked wallets first
    const { error: walletsError } = await supabase
      .from('tracked_wallets')
      .delete()
      .eq('user_id', userId);

    if (walletsError) {
      console.error('Error deleting tracked wallets:', walletsError);
      throw walletsError;
    }

    // Delete user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting user profile:', profileError);
      throw profileError;
    }

    // Delete from Supabase Auth (admin privilege required)
    // If you don't have admin, you can only delete your own user via supabase.auth.signOut()
    if (supabase.auth.admin && typeof supabase.auth.admin.deleteUser === 'function') {
      await supabase.auth.admin.deleteUser(userId);
    } else {
      // fallback: sign out (user will need to be deleted manually from Auth dashboard)
      await supabase.auth.signOut();
    }

    console.log('User account deleted successfully');
  } catch (error) {
    console.error('Error in deleteUserAccount:', error);
    throw error;
  }
}; 
