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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white">Welcome Back</h2>
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
                placeholder="Enter your password"
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
                  <span>Signing you in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
            
            <div className="text-center pt-4">
              <button
                type="button"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200"
                onClick={handleResetPassword}
                disabled={loading}
              >
                Forgot your password?
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignInModal;
