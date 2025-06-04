import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getSiteUrl } from '../utils/siteConfig';

interface SignUpModalProps {
  onClose: () => void;
  onSwitchToSignIn?: () => void;
}

const SignUpModal = ({ onClose, onSwitchToSignIn }: SignUpModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  
  // When component mounts, check URL for any error parameters (could be from a failed redirect)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      console.log('Found error in URL hash:', hash);
      // This could be from a failed email confirmation
      setError('There was an issue with email confirmation. Please try again or request a new link.');
    }
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
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
      
      // Log a message about the signup attempt
      console.log('Attempting to sign up with email:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Use the getSiteUrl function for email redirects
          emailRedirectTo: `${getSiteUrl()}/auth/callback`,
          // Make sure email confirmation is required (this is default in Supabase but making it explicit)
          data: {
            email_confirmed: false
          }
        }
      });
      
      if (error) {
        console.error('Sign up API error:', error);
        throw error;
      }
      
      console.log('Sign up API response:', data);
      
      // Check for user and confirmation status
      if (data && data.user) {
        if (data.user.identities && data.user.identities.length === 0) {
          throw new Error('This email is already registered. Please sign in or use a different email.');
        }
        
        // Show the confirmation screen even if session is null
        // This is expected because email confirmation is required
        setIsSignedUp(true);
        console.log('Sign up successful! Awaiting email confirmation.', data.user);
      } else {
        throw new Error('No user data received from sign-up');
      }
    } catch (error) {
      console.error('Error signing up:', error);
      
      // Handle specific error cases with more user-friendly messages
      if (error instanceof Error) {
        if (error.message.includes('already registered')) {
          setError('This email is already registered. Please sign in instead.');
        } else {
          setError(error.message);
        }
      } else {
        setError('An unexpected error occurred during sign-up. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    try {
      setError(null);
      setVerifyingEmail(true);
      
      console.log('Starting email verification check...');
      
      // First, get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('Current session state:', { session, error: sessionError });
      
      if (sessionError) {
        console.error('Session check error:', sessionError);
        throw sessionError;
      }
      
      // If no session, try to refresh it
      if (!session) {
        console.log('No session found, attempting to refresh auth state...');
        const { data: { user }, error: refreshError } = await supabase.auth.refreshSession();
        
        console.log('Auth refresh result:', { user, error: refreshError });
        
        if (refreshError) {
          console.error('Auth refresh error:', refreshError);
          throw refreshError;
        }
        
        // If still no user after refresh, email is not confirmed
        if (!user) {
          throw new Error('Email not yet confirmed. Please check your inbox and click the confirmation link.');
        }
      }
      
      // Get the latest user data
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      console.log('Current user state:', { user, error: userError });
      
      if (userError) {
        console.error('User data fetch error:', userError);
        throw userError;
      }
      
      if (!user) {
        throw new Error('Unable to verify email confirmation status. Please try again.');
      }
      
      // Check if email is confirmed
      if (!user.email_confirmed_at) {
        throw new Error('Email not yet confirmed. Please check your inbox and click the confirmation link.');
      }
      
      console.log('Email verification successful!', {
        email: user.email,
        confirmed_at: user.email_confirmed_at
      });
      
      // If we get here, email is confirmed
      onClose();
    } catch (error) {
      console.error('Error in handleVerifyEmail:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not confirmed')) {
          setError('Email not yet confirmed. Please check your inbox and spam folder, or request a new confirmation email below.');
        } else if (error.message.includes('expired')) {
          setError('Your session has expired. Please request a new confirmation email.');
        } else {
          setError(error.message);
        }
      } else {
        setError('An unexpected error occurred while verifying your email.');
      }
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      setError(null);
      setResendSuccess(false);
      setResendingEmail(true);
      
      // Debug log the current state
      console.log('Starting resend process with:', {
        email,
        redirectUrl: `${getSiteUrl()}/auth/callback`,
        currentUrl: window.location.href
      });
      
      // Explicitly construct the payload with correct types
      const { data, error } = await supabase.auth.resend({
        type: 'signup' as const,  // Explicitly type as 'signup'
        email,
        options: {
          emailRedirectTo: `${getSiteUrl()}/auth/callback`
        }
      });
      
      // Debug log the complete response
      console.log('Complete Resend API Response:', {
        data,
        error,
        status: error ? 'error' : 'success',
        timestamp: new Date().toISOString()
      });
      
      if (error) {
        console.error('Resend API error:', error);
        throw error;
      }
      
      // Check if the response indicates success
      if (!data) {
        console.warn('No data received from resend operation');
        throw new Error('Failed to resend confirmation email - no response data');
      }
      
      console.log('Resend successful:', {
        timestamp: new Date().toISOString(),
        email,
        data
      });
      
      setResendSuccess(true);
      setResendCount(prevCount => prevCount + 1);
      
      // Show success message for 5 seconds
      setTimeout(() => {
        setResendSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Error in handleResendEmail:', error);
      
      // Enhanced error handling with specific messages
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          setError('Please wait a few minutes before requesting another email.');
        } else if (error.message.includes('not found')) {
          setError('This email address is not found in our system. Please sign up first.');
        } else if (error.message.includes('already confirmed')) {
          setError('This email is already confirmed. Please try signing in.');
        } else if (error.message.includes('invalid email')) {
          setError('Please provide a valid email address.');
        } else {
          setError(`Failed to resend: ${error.message}`);
        }
      } else {
        setError('An unexpected error occurred while resending the confirmation email.');
      }
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative max-w-md w-full">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 blur-3xl rounded-3xl"></div>
        
        {/* Modal content */}
        <div className="relative bg-slate-900/80 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-8 shadow-2xl shadow-emerald-900/20">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                {isSignedUp ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                )}
              </div>
              <h2 className="text-3xl font-bold text-white">
                {isSignedUp ? 'Check Your Email' : 'Join TICKR'}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500/50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-300 transition-all duration-200"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 text-red-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}
          
          {resendSuccess && (
            <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-500/50 text-emerald-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Confirmation email has been resent successfully! Please check your inbox and spam folder.</span>
              </div>
            </div>
          )}
          
          {isSignedUp ? (
            <div className="space-y-6">
              {/* Email confirmation content */}
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-lg font-semibold mb-2">We've sent a confirmation email to:</p>
                  <p className="text-emerald-300 font-bold text-lg mb-4">{email}</p>
                  <div className="bg-slate-800/30 border border-slate-600/30 rounded-xl p-4 space-y-2">
                    <p className="text-slate-300 text-sm">
                      Please check your inbox and spam folder, then click the confirmation link to activate your account.
                    </p>
                    <p className="text-slate-300 text-sm">
                      The link will direct you back to this site to complete your registration.
                    </p>
                    <p className="text-amber-300 text-sm font-medium">
                      ⚠️ Important: The confirmation link expires after 24 hours.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={handleVerifyEmail}
                  className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white py-4 px-6 rounded-xl hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 transition-all duration-300 transform hover:scale-[1.02] shadow-lg shadow-emerald-500/30 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  disabled={verifyingEmail || resendingEmail}
                >
                  {verifyingEmail ? (
                    <div className="flex items-center justify-center space-x-3">
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    'I\'ve Confirmed My Email'
                  )}
                </button>
                
                <button
                  onClick={handleResendEmail}
                  className="w-full bg-slate-800/50 hover:bg-slate-700/50 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 hover:text-emerald-200 py-4 px-6 rounded-xl transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={verifyingEmail || resendingEmail || resendCount >= 3}
                >
                  {resendingEmail ? (
                    <div className="flex items-center justify-center space-x-3">
                      <svg className="animate-spin h-5 w-5 text-emerald-300" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Sending...</span>
                    </div>
                  ) : resendCount >= 3 ? (
                    'Maximum resend attempts reached'
                  ) : (
                    'Resend Confirmation Email'
                  )}
                </button>
              </div>
              
              <div className="text-center pt-4 space-y-2">
                {resendCount > 0 && (
                  <p className="text-slate-400 text-sm">
                    Resent {resendCount} time{resendCount > 1 ? 's' : ''}
                  </p>
                )}
                <button
                  type="button"
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200"
                  onClick={() => setIsSignedUp(false)}
                  disabled={verifyingEmail || resendingEmail}
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-300 mb-3">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 border border-emerald-500/20 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400/50 hover:border-emerald-500/30 transition-all duration-200 placeholder-slate-400"
                  style={{
                    WebkitBoxShadow: '0 0 0 1000px rgb(30 41 59 / 0.8) inset',
                    WebkitTextFillColor: 'white',
                    transition: 'background-color 5000s ease-in-out 0s'
                  }}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-300 mb-3">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 border border-emerald-500/20 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400/50 hover:border-emerald-500/30 transition-all duration-200 placeholder-slate-400"
                  style={{
                    WebkitBoxShadow: '0 0 0 1000px rgb(30 41 59 / 0.8) inset',
                    WebkitTextFillColor: 'white',
                    transition: 'background-color 5000s ease-in-out 0s'
                  }}
                  placeholder="Create a password"
                  required
                  disabled={loading}
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-300 mb-3">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 border border-emerald-500/20 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400/50 hover:border-emerald-500/30 transition-all duration-200 placeholder-slate-400"
                  style={{
                    WebkitBoxShadow: '0 0 0 1000px rgb(30 41 59 / 0.8) inset',
                    WebkitTextFillColor: 'white',
                    transition: 'background-color 5000s ease-in-out 0s'
                  }}
                  placeholder="Confirm your password"
                  required
                  disabled={loading}
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white py-4 px-6 rounded-xl hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 transition-all duration-300 transform hover:scale-[1.02] shadow-lg shadow-emerald-500/30 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-3">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Creating your account...</span>
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
              
              <div className="text-center pt-4">
                <p className="text-slate-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToSignIn}
                    className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200"
                    disabled={loading}
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignUpModal;
