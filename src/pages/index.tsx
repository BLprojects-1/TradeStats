import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import SignUpModal from '../components/SignUpModal';
import SignInModal from '../components/SignInModal';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleOpenSignUp = () => setShowSignUpModal(true);
  const handleCloseSignUp = () => setShowSignUpModal(false);
  const handleOpenSignIn = () => setShowSignInModal(true);
  const handleCloseSignIn = () => setShowSignInModal(false);
  
  const handleCopyCA = () => {
    // This will be updated when we have the actual CA
    const contractAddress = 'Coming Soon';
    
    // When we have the actual address, uncomment this
    // navigator.clipboard.writeText(contractAddress);
    
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-pulse text-indigo-400 text-xl">Loading...</div>
      </div>
    );
  }

  // Only render landing page for non-authenticated users
  if (user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-gray-100 relative overflow-hidden">
      <Head>
        <title>Journi | Solana Trading Journal</title>
        <meta name="description" content="Track your Solana trades with ease and gain actionable insights." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/20 blur-[150px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/10 blur-[120px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
      </div>

      <header className="relative z-10 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-indigo-900/20 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <div className="flex items-center">
            <a href="/" className="block">
              <Image 
                src="/logo.png" 
                alt="Journi Logo" 
                width={140} 
                height={40}
                className="h-10 w-auto"
                priority
              />
            </a>
          </div>
          <div className="flex gap-6 items-center">
            <div className="hidden sm:flex items-center space-x-3">
              <a 
                href="https://x.com/Ryvujournal" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-transform hover:scale-110"
                aria-label="Follow us on X (Twitter)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <button 
                onClick={handleCopyCA}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg shadow-md shadow-indigo-900/30 text-white text-sm transition-transform hover:scale-110 relative"
                aria-label="Copy Contract Address"
              >
                <span>CA</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                {showCopied && (
                  <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white text-indigo-900 px-2 py-1 rounded text-xs font-medium">
                    Coming Soon
                  </span>
                )}
              </button>
            </div>
            <button 
              onClick={handleOpenSignIn}
              className="px-4 py-2 text-indigo-300 hover:text-indigo-200 font-medium transition-colors"
              aria-label="Sign in"
            >
              Sign In
            </button>
            <button 
              onClick={handleOpenSignUp}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-md hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-900/30 transition-all duration-300 font-medium"
              aria-label="Sign up for free"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow relative z-10">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center py-20 px-4 sm:px-6 lg:px-8 mx-auto">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl sm:text-6xl font-bold leading-tight">
                <span className="text-white">Master Your</span>
                <br />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Solana Trades</span>
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                Journi turns complex blockchain activity into clear, actionable insights so you can focus on strategy, not spreadsheets.
              </p>
              <div className="pt-4">
                <button 
                  onClick={handleOpenSignUp}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-md hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-900/30 transition-all duration-300 text-lg font-medium flex items-center gap-2 group"
                  aria-label="Start your free journal"
                >
                  <span>Start Your Free Journal</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="w-full h-[400px] bg-gradient-to-br from-indigo-800/20 via-purple-800/20 to-indigo-900/20 rounded-2xl border border-indigo-500/20 backdrop-blur-sm shadow-2xl shadow-indigo-900/20 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('/dashboard-preview.jpg')] bg-cover bg-center opacity-60 mix-blend-luminosity"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                Turn On-Chain Activity Into Trading Wisdom
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full"></div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 blur transition-all duration-300 rounded-xl"></div>
                <div className="relative bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] hover:from-[#1a1a34] hover:to-[#1a1a30] p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 transition-all duration-300 h-full flex flex-col">
                  <div className="mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-900/30 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-white">Seamless Onboarding</h3>
                  </div>
                  <p className="text-gray-300 flex-grow">
                    Sign up in seconds and connect your Solana wallets to instantly view your trading history.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 blur transition-all duration-300 rounded-xl"></div>
                <div className="relative bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] hover:from-[#1a1a34] hover:to-[#1a1a30] p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 transition-all duration-300 h-full flex flex-col">
                  <div className="mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-900/30 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-white">Actionable Analytics</h3>
                  </div>
                  <p className="text-gray-300 flex-grow">
                    Dedicated views for trading history, top trades, and open positions to identify your best strategies.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 blur transition-all duration-300 rounded-xl"></div>
                <div className="relative bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] hover:from-[#1a1a34] hover:to-[#1a1a30] p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 transition-all duration-300 h-full flex flex-col">
                  <div className="mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-900/30 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-white">Personalized Notes</h3>
                  </div>
                  <p className="text-gray-300 flex-grow">
                    Attach private notes to any trade, turning raw blockchain data into a personalized learning resource.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 relative">
          <div className="absolute inset-0 bg-[#0a0a0f] pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                How Journi Works
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full"></div>
            </div>
            
            <div className="relative">
              {/* Connection Line */}
              <div className="absolute top-24 left-1/2 h-[calc(100%-130px)] w-1 bg-gradient-to-b from-indigo-600 to-indigo-800 rounded-full hidden md:block"></div>
              
              <div className="grid md:grid-cols-3 gap-16 relative">
                <div className="flex flex-col items-center text-center relative">
                  <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-indigo-900/30 z-10">
                    1
                  </div>
                  <div className="bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 h-full w-full">
                    <h3 className="text-xl font-semibold mb-4 text-white">Connect Your Wallets</h3>
                    <p className="text-gray-300">
                      Securely link your Solana wallets to view your complete trading history.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center relative">
                  <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-indigo-900/30 z-10">
                    2
                  </div>
                  <div className="bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 h-full w-full">
                    <h3 className="text-xl font-semibold mb-4 text-white">Analyze Your Trades</h3>
                    <p className="text-gray-300">
                      Gain instant insights into profit/loss, open positions, and top-performing trades.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center relative">
                  <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-indigo-900/30 z-10">
                    3
                  </div>
                  <div className="bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 h-full w-full">
                    <h3 className="text-xl font-semibold mb-4 text-white">Improve Your Strategy</h3>
                    <p className="text-gray-300">
                      Add notes, track performance, and refine your approach based on real data.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] pointer-events-none"></div>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                Frequently Asked Questions
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full"></div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 hover:shadow-indigo-900/10 hover:border-indigo-500/30 transition-all duration-300">
                <h3 className="text-xl font-semibold mb-3 text-white">Is Journi really free?</h3>
                <p className="text-gray-300">
                  Yes, Journi is completely free to use. We believe that every trader should have access to tools that help them improve.
                </p>
              </div>
              <div className="bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 hover:shadow-indigo-900/10 hover:border-indigo-500/30 transition-all duration-300">
                <h3 className="text-xl font-semibold mb-3 text-white">Is my data secure?</h3>
                <p className="text-gray-300">
                  Absolutely. Journi only reads public blockchain data. Your private notes are securely stored and only visible to you.
                </p>
              </div>
              <div className="bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 hover:shadow-indigo-900/10 hover:border-indigo-500/30 transition-all duration-300">
                <h3 className="text-xl font-semibold mb-3 text-white">How many wallets can I connect?</h3>
                <p className="text-gray-300">
                  You can connect as many Solana wallets as you need, making it easy to track all your trading activity in one place.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-12 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/20">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                  Ready to Master Your Solana Trading?
                </h2>
                <p className="text-xl text-indigo-100 mb-10">
                  Join Journi today and turn blockchain complexity into clear, actionable insights.
                </p>
                <button 
                  onClick={handleOpenSignUp}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-md hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-900/30 transform transition-all duration-300 text-lg font-medium hover:scale-105"
                  aria-label="Get started for free"
                >
                  Get Started For Free
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Modals */}
      {showSignUpModal && <SignUpModal onClose={handleCloseSignUp} />}
      {showSignInModal && <SignInModal onClose={handleCloseSignIn} />}
    </div>
  );
}
