import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';
import Footer from '../../components/Footer';

export default function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Processing authentication...');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Access query parameters and URL hash
      const { query } = router;
      const hash = window.location.hash;

      console.log('Auth callback called with hash:', hash);
      console.log('Auth query params:', query);
      
      // Parse the hash fragment if it exists
      let hashParams: Record<string, string> = {};
      if (hash) {
        const hashParts = hash.substring(1).split('&');
        hashParts.forEach(part => {
          const [key, value] = part.split('=');
          hashParams[key] = decodeURIComponent(value || '');
        });
        console.log('Parsed hash params:', hashParams);
      }

      if (!hash && Object.keys(query).length === 0) {
        setError('No authentication data found');
        setStatus('error');
        return;
      }

      // Check for errors in the hash (such as expired OTP)
      if (hashParams.error) {
        const errorMessage = hashParams.error_description || hashParams.error;
        console.error('Auth hash error:', errorMessage);
        
        // Extract email from the error description if possible
        const emailMatch = errorMessage.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
          setEmail(emailMatch[0]);
        }
        
        if (hashParams.error === 'access_denied' && hashParams.error_code === 'otp_expired') {
          setError('Your email confirmation link has expired. Please request a new one.');
          setStatus('error');
          return;
        } else {
          setError(`Authentication error: ${errorMessage}`);
          setStatus('error');
          return;
        }
      }

      try {
        // Let Supabase handle the auth callback
        const { data, error } = await supabase.auth.getSession();
        console.log('Auth session result:', data, error);
        
        if (error) throw error;
        
        if (data.session) {
          // If we have a session, authentication was successful
          setMessage('Authentication successful! Redirecting to your dashboard...');
          setStatus('success');
          
          // Redirect to dashboard after successful authentication
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          // Check for error in the URL query parameters
          if (query.error) {
            setError(`Authentication error: ${query.error_description || query.error}`);
          } else {
            setError('Authentication failed. No session established.');
          }
          setStatus('error');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setStatus('error');
      }
    };

    if (router.isReady) {
      handleAuthCallback();
    }
  }, [router.isReady, router, router.query]);

  const handleResendEmail = async () => {
    if (!email) {
      alert('Please sign in again to resend the confirmation email.');
      router.push('/');
      return;
    }

    try {
      setMessage('Sending a new confirmation email...');
      setStatus('processing');

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) {
        console.error('Error resending email:', error);
        setError(error.message);
        setStatus('error');
        return;
      }

      setMessage('A new confirmation email has been sent. Please check your inbox.');
      setStatus('success');
    } catch (err) {
      console.error('Resend email error:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend confirmation email');
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Head>
        <title>
          {status === 'success' 
            ? 'Authentication Successful' 
            : status === 'error' 
              ? 'Authentication Error' 
              : 'Processing Authentication'}
           | ryvu
        </title>
        <meta name="description" content="Completing your authentication" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <header className="bg-gradient-to-r from-[#0c0c0f] to-[#1a1a1a] shadow-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/logo.png" alt="ryvu Logo" className="h-8 w-auto mr-3" />
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-indigo-400">ryvu</h1>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center py-20 px-4">
        <div className="bg-[#121212] rounded-lg shadow-xl p-8 max-w-md w-full">
          {status === 'processing' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-900 text-indigo-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-10 h-10 border-t-2 border-b-2 border-indigo-200 rounded-full animate-spin"></div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Processing Your Authentication</h1>
              <p className="text-gray-300 mb-6">{message}</p>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full animate-pulse"></div>
              </div>
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-900 text-green-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Authentication Successful!</h1>
              <p className="text-gray-300 mb-6">{message}</p>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full w-full"></div>
              </div>
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-900 text-red-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Authentication Error</h1>
              <p className="text-red-300 mb-6">{error}</p>
              
              {error?.includes('expired') && (
                <button
                  onClick={handleResendEmail}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition mb-4 w-full"
                >
                  Resend Confirmation Email
                </button>
              )}
              
              <button
                onClick={() => router.push('/')}
                className="px-6 py-2 bg-transparent border border-indigo-500 text-indigo-300 rounded-md hover:bg-indigo-900/30 transition w-full"
              >
                Return to Home
              </button>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
} 