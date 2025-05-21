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

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-indigo-400 text-xl">Loading...</div>
      </div>
    );
  }

  // Only render landing page for non-authenticated users
  if (user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Head>
        <title>Journi | Solana Trading Journal</title>
        <meta name="description" content="Track your Solana trades with ease and gain actionable insights." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-black shadow-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-indigo-400">Journi</h1>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleOpenSignIn}
              className="px-4 py-2 text-indigo-300 hover:text-indigo-200 font-medium"
            >
              Sign In
            </button>
            <button 
              onClick={handleOpenSignUp}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition font-medium"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-black">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Master Your Solana Trades
            </h1>
            <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
              Journi turns complex blockchain activity into clear, actionable insights so you can focus on strategy, not spreadsheets.
            </p>
            <button 
              onClick={handleOpenSignUp}
              className="px-8 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 transition text-lg font-medium"
            >
              Start Your Free Journal
            </button>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-[#050505]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-white mb-12">
              Turn On-Chain Activity Into Trading Wisdom
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-indigo-900 text-indigo-300 rounded-lg flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-200">Seamless Onboarding</h3>
                <p className="text-gray-300">
                  Sign up in seconds and connect your Solana wallets to instantly view your trading history.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-indigo-900 text-indigo-300 rounded-lg flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-200">Actionable Analytics</h3>
                <p className="text-gray-300">
                  Dedicated views for trading history, top trades, and open positions to identify your best strategies.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-indigo-900 text-indigo-300 rounded-lg flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-200">Personalized Notes</h3>
                <p className="text-gray-300">
                  Attach private notes to any trade, turning raw blockchain data into a personalized learning resource.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 bg-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-white mb-12">
              How Journi Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-700 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-200">Connect Your Wallets</h3>
                <p className="text-gray-300">
                  Securely link your Solana wallets to view your complete trading history.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-700 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-200">Analyze Your Trades</h3>
                <p className="text-gray-300">
                  Gain instant insights into profit/loss, open positions, and top-performing trades.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-700 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-200">Improve Your Strategy</h3>
                <p className="text-gray-300">
                  Add notes, track performance, and refine your approach based on real data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 bg-[#050505]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-white mb-12">
              Frequently Asked Questions
            </h2>
            <div className="space-y-8">
              <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2 text-indigo-200">Is Journi really free?</h3>
                <p className="text-gray-300">
                  Yes, Journi is completely free to use. We believe that every trader should have access to tools that help them improve.
                </p>
              </div>
              <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2 text-indigo-200">Is my data secure?</h3>
                <p className="text-gray-300">
                  Absolutely. Journi only reads public blockchain data. Your private notes are securely stored and only visible to you.
                </p>
              </div>
              <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2 text-indigo-200">How many wallets can I connect?</h3>
                <p className="text-gray-300">
                  You can connect as many Solana wallets as you need, making it easy to track all your trading activity in one place.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-indigo-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-6">
              Ready to Master Your Solana Trading?
            </h2>
            <p className="text-xl text-indigo-100 mb-10 max-w-3xl mx-auto">
              Join Journi today and turn blockchain complexity into clear, actionable insights.
            </p>
            <button 
              onClick={handleOpenSignUp}
              className="px-8 py-3 bg-white text-indigo-900 rounded-md hover:bg-indigo-100 transition text-lg font-medium"
            >
              Get Started For Free
            </button>
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
