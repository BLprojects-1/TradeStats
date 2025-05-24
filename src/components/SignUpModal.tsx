import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

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
          // Use the callback route for email confirmations
          emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      
      // Check if user is confirmed by trying to get the session
      const { data, error } = await supabase.auth.getSession();
      
      console.log('Verification check results:', data);
      
      if (error) {
        console.error('Session check error:', error);
        throw error;
      }
      
      if (data.session) {
        // User is confirmed and logged in
        console.log('Email verified and user logged in!', data.session);
        onClose();
      } else {
        // User is not confirmed yet
        setError('Email not yet confirmed. Please check your inbox and spam folder, or request a new confirmation email below.');
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      setError(null);
      setResendSuccess(false);
      setResendingEmail(true);
      
      console.log('Attempting to resend confirmation email to:', email);
      
      // Use the auth.resend API with signup type
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) {
        console.error('Resend API error:', error);
        throw error;
      }
      
      console.log('Resend confirmation email response:', data);
      setResendSuccess(true);
      setResendCount(prevCount => prevCount + 1);
      
      setTimeout(() => {
        setResendSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Error resending confirmation email:', error);
      
      // Handle specific resend error cases
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          setError('Too many requests. Please wait before trying again.');
        } else {
          setError(error.message);
        }
      } else {
        setError('Failed to resend confirmation email. Please try again later.');
      }
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-[#121212] rounded-lg p-8 max-w-md w-full shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {isSignedUp ? 'Confirm Your Email' : 'Create an Account'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-2 bg-red-900/30 border border-red-500 text-red-200 text-sm rounded">
            {error}
          </div>
        )}
        
        {resendSuccess && (
          <div className="mb-4 p-2 bg-green-900/30 border border-green-500 text-green-200 text-sm rounded">
            Confirmation email has been resent successfully! Please check your inbox and spam folder.
          </div>
        )}
        
        {isSignedUp ? (
          <div>
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-indigo-900 text-indigo-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white mb-2">We've sent a confirmation email to:</p>
              <p className="text-indigo-300 font-semibold mb-4">{email}</p>
              <p className="text-gray-400 text-sm mb-6">
                Please check your inbox and spam folder, then click the confirmation link to activate your account.
                <br/>The link will direct you back to this site to complete your registration.
                <br/><span className="text-yellow-300 mt-2 block">Important: The confirmation link expires after 24 hours.</span>
              </p>
            </div>
            
            <button
              onClick={handleVerifyEmail}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#121212] disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              disabled={verifyingEmail || resendingEmail}
            >
              {verifyingEmail ? 'Verifying...' : 'I\'ve Confirmed My Email'}
            </button>
            
            <button
              onClick={handleResendEmail}
              className="w-full bg-transparent border border-indigo-500 text-indigo-300 py-2 px-4 rounded-md hover:bg-indigo-900/30 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#121212] disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              disabled={verifyingEmail || resendingEmail || resendCount >= 3}
            >
              {resendingEmail 
                ? 'Sending...' 
                : resendCount >= 3 
                  ? 'Maximum resend attempts reached' 
                  : 'Resend Confirmation Email'}
            </button>
            
            <div className="text-center mt-4">
              <p className="text-gray-400 text-sm mb-2">
                {resendCount > 0 && `Resent ${resendCount} time${resendCount > 1 ? 's' : ''}`}
              </p>
              <button
                type="button"
                className="text-indigo-400 hover:text-indigo-300 text-sm"
                onClick={() => setIsSignedUp(false)}
                disabled={verifyingEmail || resendingEmail}
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                style={{
                  WebkitBoxShadow: '0 0 0 1000px #1a1a1a inset',
                  WebkitTextFillColor: 'white',
                  transition: 'background-color 5000s ease-in-out 0s'
                }}
                required
                disabled={loading}
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                style={{
                  WebkitBoxShadow: '0 0 0 1000px #1a1a1a inset',
                  WebkitTextFillColor: 'white',
                  transition: 'background-color 5000s ease-in-out 0s'
                }}
                required
                disabled={loading}
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                style={{
                  WebkitBoxShadow: '0 0 0 1000px #1a1a1a inset',
                  WebkitTextFillColor: 'white',
                  transition: 'background-color 5000s ease-in-out 0s'
                }}
                required
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#121212] disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
            
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onSwitchToSignIn}
                  className="text-indigo-400 hover:text-indigo-300 underline"
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
  );
};

export default SignUpModal;
