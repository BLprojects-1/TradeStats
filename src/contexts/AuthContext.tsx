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
      
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        return;
      }
      
      if (data.session) {
        console.log('Session refreshed:', data.session.user.id);
        setSession(data.session);
        setUser(data.session.user);
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
    // Get initial session
    const initSession = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setSession(null);
          setUser(null);
          return;
        }
        
        if (data.session) {
          console.log('Initial session loaded for user:', data.session.user.id);
          setSession(data.session);
          setUser(data.session.user);
        } else {
          console.log('No initial session found');
        }
      } catch (error) {
        console.error('Unexpected error getting session:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initSession();

    // Set up auth change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session ? `User: ${session.user.id}` : 'No session');
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Clean up the subscription
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      console.log('Signing out user');
      
      // Sign out with scope: 'local' to clear all local session data
      await supabase.auth.signOut({
        scope: 'local'
      });
      
      // Clear all Supabase-related items from localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear session storage as well
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Clear local state
      setSession(null);
      setUser(null);
      
      // Force a complete page reload and redirect
      window.location.href = '/';
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if there's an error, try to clear everything
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
      setSession(null);
      setUser(null);
      window.location.href = '/';
      window.location.reload();
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