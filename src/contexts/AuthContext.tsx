import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to refresh the session
  const refreshSession = async () => {
    try {
      setLoading(true);
      
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        return;
      }
      
      if (currentSession) {
        // Check if the session is expired
        const expiresAt = new Date(currentSession.expires_at! * 1000);
        const now = new Date();
        
        if (expiresAt > now) {
          console.log('Session refreshed:', currentSession.user.id);
          setSession(currentSession);
          setUser(currentSession.user);
        } else {
          // Session is expired, try to refresh it
          const { data: { session: refreshedSession }, error: refreshError } = 
            await supabase.auth.refreshSession();
            
          if (refreshError) {
            console.error('Error refreshing expired session:', refreshError);
            setSession(null);
            setUser(null);
          } else if (refreshedSession) {
            console.log('Session refreshed after expiration:', refreshedSession.user.id);
            setSession(refreshedSession);
            setUser(refreshedSession.user);
          }
        }
      } else {
        console.log('No session found during refresh');
        setSession(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Unexpected error refreshing session:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) {
            setSession(null);
            setUser(null);
          }
          return;
        }
        
        if (currentSession) {
          console.log('Initial session loaded for user:', currentSession.user.id);
          if (mounted) {
            setSession(currentSession);
            setUser(currentSession.user);
          }
        } else {
          console.log('No initial session found');
        }
      } catch (error) {
        console.error('Unexpected error getting session:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    initSession();

    // Set up auth change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession ? `User: ${currentSession.user.id}` : 'No session');
        
        if (mounted) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
          }
          setLoading(false);
        }
      }
    );

    // Clean up
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('Signing out user');
      
      await supabase.auth.signOut({
        scope: 'local'
      });
      
      // Clear local state
      setSession(null);
      setUser(null);
      
      // Clear storage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if there's an error, try to clear everything
      setSession(null);
      setUser(null);
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          sessionStorage.removeItem(key);
        }
      });
      window.location.href = '/';
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext; 