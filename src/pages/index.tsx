import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import SignUpModal from '../components/SignUpModal';
import SignInModal from '../components/SignInModal';

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
    const contractAddress = 'CznXPae3VynYrWhbo3RqhyxAWGqcNYg6pfcyjdsipump';
    navigator.clipboard.writeText(contractAddress);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 flex items-center justify-center">
        <div className="animate-pulse text-emerald-400 text-xl">Loading...</div>
      </div>
    );
  }

  // Only render landing page for non-authenticated users
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 text-white relative overflow-x-hidden">
      <Head>
        <title>TradeStats | Professional Solana Trading Analytics</title>
        <meta name="description" content="Advanced trading analytics, portfolio management, and performance insights for professional Solana traders." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
      </Head>

      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/5 rounded-full blur-2xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-slate-950/50 backdrop-blur-xl border-b border-emerald-500/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 transform scale-120 origin-center">
          <div className="flex justify-between items-center py-8">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <img 
                src="/logo.png" 
                alt="TradeStats Logo" 
                className="h-12 w-auto"
              />
            </Link>

            {/* Navigation */}
            <div className="flex items-center space-x-8">
              {/* Social Links */}
              <div className="hidden md:flex items-center space-x-4">
                <a 
                  href="https://x.com/Tradestatsxyz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:scale-110 hover:shadow-emerald-500/30"
                  aria-label="Follow us on X (Twitter)"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <div className="relative">
                  <button 
                    onClick={handleCopyCA}
                    className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:scale-110 hover:shadow-emerald-500/30"
                    aria-label="Copy Contract Address"
                  >
                    <span className="text-white text-sm font-bold">CA</span>
                  </button>
                  {showCopied && (
                    <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap shadow-xl z-50">
                      Copied!
                    </div>
                  )}
                </div>
              </div>

              {/* Auth Buttons */}
              <div className="flex items-center space-x-6">
                <button 
                  onClick={handleOpenSignIn}
                  className="px-6 py-3 text-emerald-300 hover:text-emerald-200 font-medium transition-colors text-lg"
                  aria-label="Sign in"
                >
                  Sign In
                </button>
                <button 
                  onClick={handleOpenSignUp}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 transition-all duration-300 transform hover:scale-105 font-medium text-lg"
                  aria-label="Start now"
                >
                  Start Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto transform scale-120 origin-center">
            <div className="text-center">
              {/* Badge */}
              <div className="inline-flex items-center px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-300 text-base font-medium mb-10">
                <span className="w-3 h-3 bg-emerald-400 rounded-full mr-3 animate-pulse"></span>
                Professional Solana Trading Analytics
              </div>

              {/* Main Heading */}
              <h1 className="text-6xl md:text-8xl font-bold mb-8">
                <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                  Master Your
                </span>
                <br />
                <span className="text-white">Solana Trading</span>
              </h1>

              {/* Subtitle */}
              <p className="text-2xl md:text-3xl text-slate-300 mb-16 max-w-5xl mx-auto leading-relaxed">
                Advanced portfolio analytics, automated trade tracking, and institutional-grade performance insights. 
                Built for serious Solana traders who demand precision.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
                <button 
                  onClick={handleOpenSignUp}
                  className="group px-10 py-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white rounded-xl shadow-xl shadow-emerald-500/30 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 transition-all duration-300 transform hover:scale-105 font-semibold text-xl flex items-center justify-center"
                  aria-label="Start now"
                >
                  <span>Start Now</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 ml-3 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
                <Link 
                  href="/roadmap"
                  className="group px-10 py-5 border border-emerald-500/30 text-emerald-300 rounded-xl hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all duration-300 font-semibold text-xl flex items-center justify-center"
                  aria-label="View our roadmap"
                >
                  <span>View Roadmap</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 ml-3 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                  </svg>
                </Link>
              </div>

              {/* Dashboard Preview */}
              <div className="max-w-6xl mx-auto">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 blur-3xl rounded-3xl"></div>
                  <div className="relative bg-slate-900/50 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-10 shadow-2xl shadow-emerald-900/20">
                    {/* Mock Dashboard Header */}
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex space-x-3">
                        <div className="w-4 h-4 bg-red-400 rounded-full"></div>
                        <div className="w-4 h-4 bg-amber-400 rounded-full"></div>
                        <div className="w-4 h-4 bg-emerald-400 rounded-full"></div>
                      </div>
                      <div className="text-sm text-slate-400">TradeStats.app/dashboard</div>
                    </div>

                    {/* Mock Dashboard Content */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                      <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50">
                        <div className="text-base text-slate-400 mb-3">24h P/L</div>
                        <div className="text-3xl font-bold text-emerald-400">+$2,847.32</div>
                        <div className="text-sm text-emerald-400">+12.4%</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50">
                        <div className="text-base text-slate-400 mb-3">Win Rate</div>
                        <div className="text-3xl font-bold text-teal-400">87.3%</div>
                        <div className="text-sm text-teal-400">+2.1%</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50">
                        <div className="text-base text-slate-400 mb-3">Open Positions</div>
                        <div className="text-3xl font-bold text-amber-400">8</div>
                        <div className="text-sm text-amber-400">$12,456</div>
                      </div>
                    </div>

                    {/* Mock Chart */}
                    <div className="bg-slate-800/30 rounded-xl h-48 border border-slate-700/50 flex items-center justify-center">
                      <svg className="w-full h-full p-8" viewBox="0 0 400 120">
                        <path 
                          d="M20,100 L60,80 L100,60 L140,40 L180,45 L220,30 L260,20 L300,25 L340,15 L380,10" 
                          stroke="url(#chartGradient)" 
                          strokeWidth="3" 
                          fill="none" 
                          className="drop-shadow-sm"
                        />
                        <defs>
                          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="50%" stopColor="#14B8A6" />
                            <stop offset="100%" stopColor="#F59E0B" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto transform scale-120 origin-center">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-6xl font-bold mb-8">
                <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                  Professional Trading Infrastructure
                </span>
              </h2>
              <p className="text-2xl text-slate-300 max-w-4xl mx-auto">
                Enterprise-grade analytics and professional portfolio management tools designed for serious Solana traders.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
              {/* Feature 1 */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-teal-600/10 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-slate-900/50 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-10 transition-all duration-300 hover:border-emerald-500/50">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-emerald-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-6">Real-Time Analytics</h3>
                  <p className="text-slate-300 text-lg">
                    Live portfolio monitoring with professional-grade P/L tracking, performance metrics, and risk analytics.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-600/10 to-amber-600/10 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-slate-900/50 backdrop-blur-xl border border-teal-500/30 rounded-2xl p-10 transition-all duration-300 hover:border-teal-500/50">
                  <div className="w-20 h-20 bg-gradient-to-br from-teal-600 to-amber-600 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-teal-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-6">Advanced Trade Journal</h3>
                  <p className="text-slate-300 text-lg">
                    Comprehensive trade tracking with automated transaction import and professional note-taking capabilities.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-emerald-600/10 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                <div className="relative bg-slate-900/50 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-10 transition-all duration-300 hover:border-amber-500/50">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-600 to-emerald-600 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-amber-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-6">Performance Analytics</h3>
                  <p className="text-slate-300 text-lg">
                    Deep performance insights with statistical analysis, risk metrics, and pattern recognition for strategy optimization.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center transform scale-120 origin-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 blur-3xl rounded-3xl"></div>
              <div className="relative bg-slate-900/50 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-16">
                <h2 className="text-4xl md:text-6xl font-bold mb-8 text-white">
                  Ready to Elevate Your Trading?
                </h2>
                <p className="text-2xl text-slate-300 mb-12 max-w-3xl mx-auto">
                  Join professional traders who rely on TradeStats for advanced analytics and systematic trading discipline.
                </p>
                <div className="flex flex-col sm:flex-row gap-6 justify-center">
                  <button 
                    onClick={handleOpenSignUp}
                    className="px-10 py-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white rounded-xl shadow-xl shadow-emerald-500/30 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 transition-all duration-300 transform hover:scale-105 font-semibold text-xl"
                    aria-label="Start today"
                  >
                    Start Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-slate-950/50 backdrop-blur-xl border-t border-emerald-500/20 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 transform scale-120 origin-center">
          <div className="text-center">
            <p className="text-slate-400 text-lg">
              © 2024 TradeStats. Built for professional Solana traders.
            </p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showSignUpModal && (
        <SignUpModal 
          onClose={handleCloseSignUp}
          onSwitchToSignIn={handleSwitchToSignIn}
        />
      )}
      
      {showSignInModal && (
        <SignInModal 
          onClose={handleCloseSignIn}
        />
      )}
    </div>
  );
}
