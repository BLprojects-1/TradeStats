import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getSiteUrl } from '../utils/siteConfig';

interface SignInModalProps {
  onClose: () => void;
}

const SignInModal = ({ onClose }: SignInModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check for auth errors in URL when component mounts
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      console.log('Found error in URL hash during sign-in:', hash);
      
      // Parse the hash fragment
      const hashParts = hash.substring(1).split('&');
      const hashParams: Record<string, string> = {};
      
      hashParts.forEach(part => {
        const [key, value] = part.split('=');
        hashParams[key] = decodeURIComponent(value || '');
      });
      
      // Handle specific error types
      if (hashParams.error_code === 'otp_expired') {
        setError('Your email confirmation link has expired. Please request a new one.');
      } else if (hashParams.error) {
        setError(`Authentication error: ${hashParams.error_description || hashParams.error}`);
      }
    }
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      setLoading(true);
      
      console.log('Attempting to sign in with:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error details:', error);
        
        // Check if the error is related to email confirmation
        if (error.message.includes('Email not confirmed') || 
            error.message.includes('Invalid login credentials')) {
          throw new Error('Please check if you have confirmed your email. If you need to resend the confirmation, please use the sign up form.');
        }
        throw error;
      }
      
      console.log('Sign in API response:', data);
      
      if (data.user) {
        console.log('Sign in successful!', data.user);
        onClose();
      }
    } catch (error) {
      console.error('Error signing in:', error);
      setError(error instanceof Error ? error.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email to reset your password');
      return;
    }
    
    try {
      setError(null);
      setLoading(true);
      
      console.log('Sending password reset email to:', email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteUrl()}/auth/callback`,
      });
      
      if (error) {
        console.error('Password reset error:', error);
        throw error;
      }
      
      console.log('Password reset email sent successfully');
      alert('Password reset link sent to your email!');
    } catch (error) {
      console.error('Error resetting password:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-[#121212] rounded-lg p-8 max-w-md w-full shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Sign In</h2>
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
          
          <div className="mb-6">
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
          
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#121212] disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
          
          <div className="text-center">
            <button
              type="button"
              className="text-indigo-400 hover:text-indigo-300 text-sm"
              onClick={handleResetPassword}
              disabled={loading}
            >
              Forgot your password?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignInModal;
