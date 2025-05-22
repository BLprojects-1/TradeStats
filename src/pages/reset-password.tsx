import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';
import Link from 'next/link';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  // Check if this is an access token URL (from an email confirmation)
  useEffect(() => {
    const handleHashChange = async () => {
      // The hash contains the access token
      const hash = window.location.hash;
      
      if (hash && hash.includes('access_token')) {
        // Let Supabase handle the hash
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session from hash:', error);
          setError(error.message);
        }
        
        if (data.session) {
          setMessage('Your email has been confirmed. You can now update your password.');
        }
      }
    };
    
    handleHashChange();
  }, []);

  // Redirect if user is already logged in (but not from reset password flow)
  useEffect(() => {
    if (user && !window.location.hash) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Password validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    try {
      setError(null);
      setLoading(true);
      
      const { error } = await supabase.auth.updateUser({
        password,
      });
      
      if (error) throw error;
      
      setMessage('Your password has been updated successfully. You can now sign in with your new password.');
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (error) {
      console.error('Error resetting password:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Head>
        <title>Reset Password | ryvu</title>
        <meta name="description" content="Reset your ryvu account password" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-gradient-to-r from-[#0c0c0f] to-[#1a1a1a] shadow-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/logo.png" alt="ryvu Logo" className="h-8 w-auto mr-3" />
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-indigo-400">ryvu</h1>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="bg-[#121212] rounded-lg p-8 max-w-md w-full shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">Reset Your Password</h2>
          
          {error && (
            <div className="mb-4 p-2 bg-red-900/30 border border-red-500 text-red-200 text-sm rounded">
              {error}
            </div>
          )}
          
          {message && (
            <div className="mb-4 p-2 bg-green-900/30 border border-green-500 text-green-200 text-sm rounded">
              {message}
            </div>
          )}
          
          <form onSubmit={handleResetPassword}>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                disabled={loading || message !== null}
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                disabled={loading || message !== null}
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#121212] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || message !== null}
            >
              {loading ? 'Updating Password...' : 'Reset Password'}
            </button>
            
            {message && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="text-indigo-400 hover:text-indigo-300 text-sm"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
} 