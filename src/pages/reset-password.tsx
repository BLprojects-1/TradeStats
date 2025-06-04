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
    <div className="flex flex-col min-h-screen bg-gradient-background text-slate-100 relative overflow-hidden">
      <Head>
        <title>Reset Password | TradeStats | Professional Solana Trading Analytics</title>
        <meta name="description" content="Reset your TradeStats account password securely" />
        <link rel="icon" href="/favicon.svg" />
      </Head>

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-blue-600/10 blur-[150px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-emerald-600/10 blur-[120px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
      </div>

      <header className="relative z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <svg width="120" height="32" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{stopColor:'#3B82F6', stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#10B981', stopOpacity:1}} />
                  </linearGradient>
                </defs>
                <g transform="translate(0, 6)">
                  <rect width="20" height="20" rx="4" fill="url(#logoGradient)" />
                  <path d="M6 10 L9 13 L14 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </g>
                <g transform="translate(28, 0)" fill="#F1F5F9">
                  <path d="M2 4 L2 8 L0 8 L0 10 L2 10 L2 28 L4 28 L4 10 L6 10 L6 8 L4 8 L4 4 Z" />
                  <path d="M10 4 L10 28 L12 28 L12 4 Z" />
                  <path d="M16 6 C16 4.895 16.895 4 18 4 L20 4 C21.105 4 22 4.895 22 6 L22 8 L20 8 L20 6 L18 6 L18 26 L20 26 L20 24 L22 24 L22 26 C22 27.105 21.105 28 20 28 L18 28 C16.895 28 16 27.105 16 26 Z" />
                  <path d="M26 4 L26 14 L30 10 L32 10 L29 13 L32 28 L30 28 L28 18 L26 20 L26 28 L24 28 L24 4 Z" />
                  <path d="M36 4 L36 28 L38 28 L38 18 L40 18 L42 28 L44 28 L42 18 C43.105 18 44 17.105 44 16 L44 6 C44 4.895 43.105 4 42 4 Z M38 6 L42 6 L42 16 L38 16 Z" />
                </g>
              </svg>
            </Link>
          </div>
          <div className="hidden sm:flex items-center space-x-6">
            <Link 
              href="/" 
              className="text-slate-300 hover:text-blue-300 font-medium transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow relative z-10 flex items-center justify-center py-20 px-4">
        <div className="w-full max-w-md">
          <div className="card-glass p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Reset Your Password</h1>
              <p className="text-slate-400">Enter your new password to secure your professional trading account</p>
            </div>
            
            {/* Status Messages */}
            {error && (
              <div className="mb-6 p-4 bg-red-600/10 border border-red-500/20 text-red-300 text-sm rounded-lg flex items-start space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>{error}</span>
              </div>
            )}
            
            {message && (
              <div className="mb-6 p-4 bg-emerald-600/10 border border-emerald-500/20 text-emerald-300 text-sm rounded-lg flex items-start space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{message}</span>
              </div>
            )}
            
            {/* Password Reset Form */}
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder-slate-400"
                  placeholder="Enter your new password"
                  required
                  disabled={loading || message !== null}
                  minLength={6}
                />
                <p className="text-xs text-slate-400 mt-1">Must be at least 6 characters long</p>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder-slate-400"
                  placeholder="Confirm your new password"
                  required
                  disabled={loading || message !== null}
                  minLength={6}
                />
              </div>
              
              <button
                type="submit"
                className="btn-primary w-full text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || message !== null}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Updating Password...</span>
                  </div>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>

            {/* Success Actions */}
            {message && (
              <div className="mt-8 pt-6 border-t border-slate-700/50">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/"
                    className="btn-secondary flex-1 text-center"
                  >
                    Return to Sign In
                  </Link>
                  <Link
                    href="/dashboard"
                    className="btn-primary flex-1 text-center"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            )}

            {/* Help Text */}
            <div className="mt-8 pt-6 border-t border-slate-700/50">
              <p className="text-center text-sm text-slate-400">
                Having trouble? 
                <a 
                  href="mailto:TradeStatsjournal@gmail.com?subject=Password%20Reset%20Help" 
                  className="text-blue-400 hover:text-blue-300 ml-1 font-medium transition-colors"
                >
                  Contact Support
                </a>
              </p>
            </div>
          </div>
          
          {/* Security Notice */}
          <div className="mt-8 card-glass p-6 border border-emerald-500/20 bg-emerald-600/5">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-emerald-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-emerald-400 mb-1">Enterprise-Grade Security</h3>
                <p className="text-xs text-slate-400">
                  Your password is encrypted using industry-standard security protocols. We never store your password in plain text.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
} 