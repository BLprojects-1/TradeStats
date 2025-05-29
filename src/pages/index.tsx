import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import SignUpModal from '../components/SignUpModal';
import SignInModal from '../components/SignInModal';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';

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
  
  const handleSwitchToSignIn = () => {
    setShowSignUpModal(false);
    setShowSignInModal(true);
  };
  
  const handleSwitchToSignUp = () => {
    setShowSignInModal(false);
    setShowSignUpModal(true);
  };
  
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
        <title>ryvu | Solana Trading Journal</title>
        <meta name="description" content="Track your Solana trades with ease and gain actionable insights." />
        <link rel="icon" href="/favicon.png" />
      </Head>

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/20 blur-[150px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/10 blur-[120px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
      </div>

      <header className="relative z-10 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-indigo-900/20 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/logo.png" alt="Journi Logo" className="h-6 sm:h-10 w-auto" />
            </Link>
          </div>
          <div className="flex gap-3 sm:gap-6 items-center">
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
              <a 
                href="https://discord.gg/ryvu" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-transform hover:scale-110"
                aria-label="Join our Discord server"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <button 
                onClick={handleCopyCA}
                className="flex items-center space-x-1.5 px-2.5 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg shadow-md shadow-indigo-900/30 text-white text-sm transition-transform hover:scale-110 relative"
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
              className="px-3 sm:px-4 py-2 sm:py-2 text-sm sm:text-base text-indigo-300 hover:text-indigo-200 font-medium transition-colors"
              aria-label="Sign in"
            >
              Sign In
            </button>
            <button 
              onClick={handleOpenSignUp}
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-md hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-900/30 transition-all duration-300 font-medium"
              aria-label="Sign up for free"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow relative z-10">
        {/* Hero Section */}
        <section className="relative min-h-[95vh] flex items-center py-20 px-4 sm:px-6 lg:px-8 mx-auto">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-sm font-medium">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2 animate-pulse"></span>
                  Self-Custodial Solana Trading Dashboard
                </div>
                <h1 className="text-6xl sm:text-7xl font-bold leading-tight">
                  <span className="text-white">Meet </span>
                  <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Ryvu</span>
                </h1>
                <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
                  Real-time portfolio views, automated trade tracking, deep performance analytics, and trade-discipline tools—all in one self-custodial platform.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleOpenSignUp}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-md hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-900/30 transition-all duration-300 text-lg font-medium flex items-center justify-center gap-2 group"
                  aria-label="Get started for free"
                >
                  <span>Get Started Free</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="relative">
              <div className="w-full h-[500px] bg-gradient-to-br from-indigo-800/20 via-purple-800/20 to-indigo-900/20 rounded-2xl border border-indigo-500/20 backdrop-blur-sm shadow-2xl shadow-indigo-900/20 overflow-hidden relative">
                {/* Dashboard Preview Mock */}
                <div className="absolute inset-4 bg-[#0a0a0f]/90 rounded-xl border border-indigo-500/10 overflow-hidden">
                  {/* Header */}
                  <div className="h-12 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border-b border-indigo-500/10 flex items-center px-4">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                    <div className="ml-4 text-xs text-gray-400">ryvu.app/dashboard</div>
                  </div>
                  
                  {/* Dashboard Content */}
                  <div className="p-4 space-y-4">
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-indigo-900/20 rounded-lg p-3 border border-indigo-500/10">
                        <div className="text-xs text-gray-400">24h P/L</div>
                        <div className="text-lg font-bold text-green-400">+$1,247</div>
                      </div>
                      <div className="bg-indigo-900/20 rounded-lg p-3 border border-indigo-500/10">
                        <div className="text-xs text-gray-400">Win Rate</div>
                        <div className="text-lg font-bold text-indigo-300">73%</div>
                      </div>
                      <div className="bg-indigo-900/20 rounded-lg p-3 border border-indigo-500/10">
                        <div className="text-xs text-gray-400">Open Positions</div>
                        <div className="text-lg font-bold text-purple-300">12</div>
                      </div>
                    </div>
                    
                    {/* Chart Area */}
                    <div className="bg-indigo-900/10 rounded-lg h-32 border border-indigo-500/10 flex items-center justify-center">
                      <svg className="w-full h-full p-4" viewBox="0 0 300 100">
                        <path d="M20,80 L50,60 L80,45 L110,30 L140,35 L170,25 L200,15 L230,20 L260,10 L280,5" 
                              stroke="url(#heroGrad)" strokeWidth="2" fill="none" />
                        <defs>
                          <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6366F1" />
                            <stop offset="100%" stopColor="#A855F7" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    
                    {/* Trading List */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Recent Trades</span>
                        <span className="text-indigo-400">View All</span>
                      </div>
                      {[1,2,3].map(i => (
                        <div key={i} className="flex justify-between items-center py-1.5 px-2 bg-indigo-900/10 rounded border border-indigo-500/5">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"></div>
                            <span className="text-xs text-gray-300">TOKEN{i}</span>
                          </div>
                          <div className="text-xs text-green-400">+{(Math.random() * 100).toFixed(0)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Floating elements */}
                <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-xl"></div>
                <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-xl"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Features Showcase */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                Everything You Need to Master Solana Trading
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                From real-time portfolio tracking to advanced analytics and trade discipline tools—Ryvu gives you complete visibility into your trading performance.
              </p>
            </div>
            
            {/* Feature Grid */}
            <div className="grid lg:grid-cols-2 gap-12 mb-20">
              {/* Dashboard Feature */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10 transition-all duration-300 hover:border-indigo-400/40">
                  <div className="flex items-start space-x-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8 text-white">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-2xl font-bold text-white mb-4">Real-Time Dashboard</h3>
                      <p className="text-gray-300 mb-6">
                        Get instant visibility into your open positions, 24h performance metrics, realized P/L, and win rates. Your complete trading scoreboard at a glance.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Open positions with unrealized P/L</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">24h performance overview & charts</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Getting started checklist for new users</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trading History Feature */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10 transition-all duration-300 hover:border-indigo-400/40">
                  <div className="flex items-start space-x-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/30">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8 text-white">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-2xl font-bold text-white mb-4">Complete Trading History</h3>
                      <p className="text-gray-300 mb-6">
                        The ability to add every buy and sell transaction, timestamped and filterable. Star trades, add notes, and build your personalized trading journal.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Paginated, filterable trade feed</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Star, note, and tag any trade</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Search by token or date range</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Analytics Feature */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-emerald-600/20 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10 transition-all duration-300 hover:border-indigo-400/40">
                  <div className="flex items-start space-x-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/30">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8 text-white">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-2xl font-bold text-white mb-4">Deep Performance Analytics</h3>
                      <p className="text-gray-300 mb-6">
                        Analyze your best and worst trades, track win rates, identify "faded runners," and discover patterns in your trading behavior.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Win rate & profit factor analysis</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Best/worst trades identification</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Faded runners & missed opportunities</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trade Checklist Feature */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-red-600/20 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10 transition-all duration-300 hover:border-indigo-400/40">
                  <div className="flex items-start space-x-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/30">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8 text-white">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-2xl font-bold text-white mb-4">Custom Trade Checklist</h3>
                      <p className="text-gray-300 mb-6">
                        Build your own trading criteria with Yes/No questions, numeric thresholds, and custom rules. Enforce discipline and eliminate emotional trading.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Custom criteria builder</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Numeric & text-based rules</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">Pre-trade discipline enforcement</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Highlights */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                Built for Performance & Security
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Enterprise-grade infrastructure meets user-friendly design. Self-custodial, fast, and reliable.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-900/30 group-hover:scale-110 transition-transform duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Self-Custodial</h3>
                <p className="text-gray-300">Your keys, your crypto. We never have access to your funds or private keys.</p>
              </div>
              
              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-900/30 group-hover:scale-110 transition-transform duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">DRPC & Helius</h3>
                <p className="text-gray-300">Ultra-fast Solana RPC connections with reliable Jupiter price feeds.</p>
              </div>
              
              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-900/30 group-hover:scale-110 transition-transform duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Supabase Backend</h3>
                <p className="text-gray-300">Scalable PostgreSQL database with real-time subscriptions and auth.</p>
              </div>
              
              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-900/30 group-hover:scale-110 transition-transform duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Smart Caching</h3>
                <p className="text-gray-300">Optimized data flow that only fetches new trades since your last scan.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-[#0a0a0f] pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                From Wallet to Wisdom in Minutes
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Get started with Ryvu in three simple steps. No API keys, no complex setup-just add your wallets and go.
              </p>
            </div>
            
            <div className="relative">
              <div className="grid lg:grid-cols-3 gap-16 relative">
                <div className="text-center relative">
                  <div className="w-24 h-24 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-8 shadow-xl shadow-indigo-900/30 mx-auto relative z-10">
                    1
                  </div>
                  <div className="bg-gradient-to-b from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10">
                    <h3 className="text-2xl font-bold text-white mb-4">Add Your Wallet</h3>
                    <p className="text-gray-300 mb-6">
                    Simply add your Solana wallet address for read-only tracking. You don't even need to connect a wallet.
                    </p>
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <span className="text-sm text-green-400 font-medium">100% Self-Managed</span>
                    </div>
                  </div>
                </div>

                <div className="text-center relative">
                  <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-8 shadow-xl shadow-purple-900/30 mx-auto relative z-10">
                    2
                  </div>
                  <div className="bg-gradient-to-b from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10">
                    <h3 className="text-2xl font-bold text-white mb-4">Auto-Import Trades</h3>
                    <p className="text-gray-300 mb-6">
                      Ryvu automatically imports your last 24h of transactions, then backfills your complete trading history in the background.
                    </p>
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-blue-400 font-medium">Real-Time Sync</span>
                    </div>
                  </div>
                </div>

                <div className="text-center relative">
                  <div className="w-24 h-24 bg-gradient-to-r from-pink-600 to-orange-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-8 shadow-xl shadow-pink-900/30 mx-auto relative z-10">
                    3
                  </div>
                  <div className="bg-gradient-to-b from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10">
                    <h3 className="text-2xl font-bold text-white mb-4">Analyze & Improve</h3>
                    <p className="text-gray-300 mb-6">
                      Explore your dashboard, star favorite trades, build your checklist, and start making data-driven trading decisions.
                    </p>
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                      <span className="text-sm text-purple-400 font-medium">Actionable Insights</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Section */}
            <div className="mt-20 grid md:grid-cols-4 gap-8 text-center">
              <div className="bg-gradient-to-b from-[#1a1a2e]/60 to-[#1a1a28]/60 backdrop-blur-sm p-6 rounded-xl border border-indigo-500/10">
                <div className="text-3xl font-bold text-indigo-400 mb-2">&lt;30s</div>
                <div className="text-sm text-gray-400">Setup Time</div>
              </div>
              <div className="bg-gradient-to-b from-[#1a1a2e]/60 to-[#1a1a28]/60 backdrop-blur-sm p-6 rounded-xl border border-indigo-500/10">
                <div className="text-3xl font-bold text-purple-400 mb-2">3</div>
                <div className="text-sm text-gray-400">Wallets Supported</div>
              </div>
              <div className="bg-gradient-to-b from-[#1a1a2e]/60 to-[#1a1a28]/60 backdrop-blur-sm p-6 rounded-xl border border-indigo-500/10">
                <div className="text-3xl font-bold text-green-400 mb-2">24/7</div>
                <div className="text-sm text-gray-400">Real-Time Updates</div>
              </div>
              <div className="bg-gradient-to-b from-[#1a1a2e]/60 to-[#1a1a28]/60 backdrop-blur-sm p-6 rounded-xl border border-indigo-500/10">
                <div className="text-3xl font-bold text-orange-400 mb-2">$0</div>
                <div className="text-sm text-gray-400">Forever Free</div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] pointer-events-none"></div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                Frequently Asked Questions
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full"></div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 hover:shadow-indigo-900/10 hover:border-indigo-500/30 transition-all duration-300">
                <h3 className="text-xl font-semibold mb-3 text-white">How is Ryvu different from other portfolio trackers?</h3>
                <p className="text-gray-300">
                  Ryvu is built specifically for Solana traders and focuses on actionable insights, not just portfolio tracking. Our trade checklist, performance analytics, and trade journaling features help you become a better trader, not just track your P/L.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 hover:shadow-indigo-900/10 hover:border-indigo-500/30 transition-all duration-300">
                <h3 className="text-xl font-semibold mb-3 text-white">Is my trading data secure and private?</h3>
                <p className="text-gray-300">
                  Absolutely. Ryvu only reads public blockchain data using your wallet addresses. Your private notes and checklist data are encrypted and stored securely.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 hover:shadow-indigo-900/10 hover:border-indigo-500/30 transition-all duration-300">
                <h3 className="text-xl font-semibold mb-3 text-white">Does Ryvu support all Solana DEXs and tokens?</h3>
                <p className="text-gray-300">
                  Yes! Ryvu tracks trades from all major Solana DEXs including Jupiter, Raydium, Orca, and more. We support all SPL tokens and automatically fetch price data and metadata from Jupiter's API.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 hover:shadow-indigo-900/10 hover:border-indigo-500/30 transition-all duration-300">
                <h3 className="text-xl font-semibold mb-3 text-white">Can I scan multiple wallets?</h3>
                <p className="text-gray-300">
                  Yes, you can scan up to 3 Solana wallets to your account. Ryvu will aggregate all your trading activity across wallets to give you a complete view of your performance.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5 hover:shadow-indigo-900/10 hover:border-indigo-500/30 transition-all duration-300">
                <h3 className="text-xl font-semibold mb-3 text-white">How far back does trade history go?</h3>
                <p className="text-gray-300">
                  Ryvu fetches your complete trading history from the beginning of your wallet's activity. There's no limit to how far back we can go—if it's on the Solana blockchain, we can track it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced CTA Section */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-pink-900/40 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-sm p-16 rounded-3xl border border-indigo-500/20 shadow-2xl shadow-indigo-900/20 relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="ctaPattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                      <circle cx="50" cy="50" r="2" fill="currentColor" className="text-indigo-400" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#ctaPattern)" />
                </svg>
              </div>
              
              <div className="max-w-4xl mx-auto text-center relative z-10">
                <h2 className="text-4xl sm:text-6xl font-bold text-white mb-8">
                  Ready to Master Your
                  <span className="block bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Solana Trading?
                  </span>
                </h2>
                <p className="text-xl text-indigo-100 mb-12 max-w-2xl mx-auto">
                  Join thousands of traders who use Ryvu to turn blockchain complexity into clear, actionable insights. Start your journey to better trading today.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <button 
                    onClick={handleOpenSignUp}
                    className="px-10 py-5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl hover:from-indigo-500 hover:to-indigo-400 shadow-xl shadow-indigo-900/30 transform transition-all duration-300 text-lg font-semibold hover:scale-105 flex items-center gap-3 group"
                    aria-label="Get started for free"
                  >
                    <span>Get Started For Free</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                  
                  <div className="flex items-center space-x-4 text-indigo-200">
                    <div className="flex items-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>No credit card required</span>
                    </div>
                    <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                    <div className="flex items-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Self-custodial</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Modals */}
      {showSignUpModal && <SignUpModal onClose={handleCloseSignUp} onSwitchToSignIn={handleSwitchToSignIn} />}
      {showSignInModal && <SignInModal onClose={handleCloseSignIn} />}
    </div>
  );
}
