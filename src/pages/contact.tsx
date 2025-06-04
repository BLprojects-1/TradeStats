import React from 'react';
import Head from 'next/head';
import Footer from '../components/Footer';
import Link from 'next/link';

const Contact = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-background text-slate-100 relative overflow-hidden">
      <Head>
        <title>Contact Us | TradeStats | Professional Solana Trading Analytics</title>
        <meta name="description" content="Contact the TradeStats team for professional trading analytics support, enterprise inquiries, and technical assistance." />
        <link rel="icon" href="/favicon.svg" />
      </Head>

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-blue-600/10 blur-[150px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-emerald-600/10 blur-[120px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
      </div>

      <header className="relative z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex justify-between items-center">
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
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3">
              <a 
                href="https://x.com/Tradestatsxyz" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all duration-200 hover:scale-110 hover:shadow-blue-500/30"
                aria-label="Follow us on X (Twitter)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText('CznXPae3VynYrWhbo3RqhyxAWGqcNYg6pfcyjdsipump');
                  const notification = document.createElement('div');
                  notification.textContent = 'Contract address copied!';
                  notification.className = 'fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
                  document.body.appendChild(notification);
                  setTimeout(() => notification.remove(), 2000);
                }}
                className="flex items-center space-x-1.5 px-2.5 h-9 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg shadow-lg shadow-blue-500/20 text-white text-sm transition-all duration-200 hover:scale-110 hover:shadow-blue-500/30"
                aria-label="Copy Contract Address"
              >
                <span>CA</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <Link 
              href="/" 
              className="text-slate-300 hover:text-blue-300 font-medium transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow relative z-10 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card-glass p-8 md:p-12">
            {/* Header Section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold mb-6 gradient-text">
                Contact Our Team
              </h1>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                Professional support for your trading analytics needs. Our team is here to help with platform inquiries, enterprise solutions, and technical assistance.
              </p>
            </div>
            
            {/* Contact Methods */}
            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              {/* Email Support */}
              <div className="bg-slate-800/30 rounded-xl p-8 border border-slate-700/50 hover:border-blue-400/40 transition-all duration-300 group">
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-2xl font-bold text-white mb-4">Professional Support</h3>
                    <p className="text-slate-300 mb-4">
                      Direct access to our technical team for platform support, feature requests, and troubleshooting assistance.
                    </p>
                    <a 
                      href="mailto:TradeStatsjournal@gmail.com" 
                      className="inline-flex items-center text-blue-400 hover:text-blue-300 font-medium transition-colors group"
                    >
                      <span>TradeStatsjournal@gmail.com</span>
                      <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* Community Support */}
              <div className="bg-slate-800/30 rounded-xl p-8 border border-slate-700/50 hover:border-emerald-400/40 transition-all duration-300 group">
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-2xl font-bold text-white mb-4">Community & Social</h3>
                    <p className="text-slate-300 mb-4">
                      Join our active community for real-time updates, trading discussions, and peer support from professional traders.
                    </p>
                    <div className="flex items-center space-x-4">
                      <a 
                        href="https://x.com/Tradestatsxyz" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        @TradeStatsjournal
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enterprise & Business Inquiries */}
            <div className="bg-gradient-to-r from-blue-600/10 to-emerald-600/10 rounded-xl p-8 border border-blue-500/20">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Enterprise Solutions</h3>
                <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
                  Interested in enterprise-grade analytics solutions, institutional partnerships, or custom integrations? Our business development team is ready to discuss professional solutions tailored to your organization.
                </p>
                <a 
                  href="mailto:TradeStatsjournal@gmail.com?subject=Enterprise%20Inquiry" 
                  className="btn-primary text-lg inline-flex items-center gap-2"
                >
                  <span>Contact Enterprise Sales</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Response Time Notice */}
            <div className="mt-12 text-center">
              <div className="inline-flex items-center space-x-2 text-sm text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Our team typically responds within 24 hours during business days</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact; 