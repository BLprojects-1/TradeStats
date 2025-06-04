import React from 'react';
import Head from 'next/head';
import Footer from '../components/Footer';
import Link from 'next/link';

const TermsOfService = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-background text-slate-100 relative overflow-hidden">
      <Head>
        <title>Terms of Service | TradeStats | Professional Solana Trading Analytics</title>
        <meta name="description" content="TradeStats Terms of Service - Professional trading analytics platform terms and conditions." />
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
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold mb-6 gradient-text">Terms of Service</h1>
              <p className="text-xl text-slate-300">
                Professional trading analytics platform terms and conditions for enterprise-grade service delivery.
              </p>
            </div>
            
            <div className="prose prose-invert prose-blue max-w-none">
              <div className="mb-8 p-4 bg-blue-600/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Last Updated: {new Date().toLocaleDateString()}</p>
                <p className="text-slate-300 font-medium">
                  These Terms of Service govern your use of TradeStats's professional Solana trading analytics platform and services.
                </p>
              </div>
              
              <div className="space-y-8">
                <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-lg p-6">
                  <p className="text-slate-300">
                    Welcome to TradeStats's professional trading analytics platform. By accessing or using our services, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our professional platform.
                  </p>
                  <p className="text-slate-300 mt-4">
                    The terms "User", "You", "Your", "Service", and "Agreement" have specific meanings defined within this document for professional service delivery.
                  </p>
                </div>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">1</span>
                    </div>
                    Professional Service Description
                  </h2>
                  
                  <p className="text-slate-300">
                    TradeStats is a professional-grade Solana trading analytics platform that provides institutional-level portfolio management, trade analysis, and performance optimization tools for serious cryptocurrency traders and investment professionals.
                  </p>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">2</span>
                    </div>
                    Professional Account Registration
                  </h2>
                  
                  <p className="text-slate-300 mb-4">
                    To access our professional features, you must create an account with accurate, current, and complete information. You agree to:
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-300">
                    <li>Provide accurate professional information during registration</li>
                    <li>Maintain and update account information for accuracy</li>
                    <li>Safeguard your account credentials with institutional-level security</li>
                    <li>Immediately notify us of any unauthorized account access</li>
                    <li>Accept responsibility for all activities under your account</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">3</span>
                    </div>
                    Wallet Connection & Analytics
                  </h2>
                  
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                    <p className="text-slate-300 mb-4">
                      Our platform provides professional-grade analytics by connecting to your Solana wallet(s). When connecting your wallet, you:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-300">
                      <li>Authorize read-only access to public blockchain data associated with your wallet</li>
                      <li>Confirm that we maintain zero custody of your funds or private keys</li>
                      <li>Acknowledge rightful ownership or authorized use of connected wallets</li>
                      <li>Accept that all analytics are derived from publicly available blockchain data</li>
                      <li>Understand that wallet disconnection can be performed at any time</li>
                    </ul>
                  </div>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">4</span>
                    </div>
                    Professional Conduct Standards
                  </h2>
                  
                  <p className="text-slate-300 mb-4">As a professional platform user, you agree not to:</p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-300">
                    <li>Use our services for illegal purposes or violate applicable laws</li>
                    <li>Interfere with or disrupt platform integrity or performance</li>
                    <li>Attempt unauthorized access to our systems or infrastructure</li>
                    <li>Impersonate another person, entity, or trading professional</li>
                    <li>Engage in abusive, harassing, or malicious behavior</li>
                    <li>Reverse engineer or attempt to extract proprietary analytics algorithms</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">5</span>
                    </div>
                    Intellectual Property Rights
                  </h2>
                  
                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-6">
                    <p className="text-slate-300 mb-4">
                      Our professional analytics platform, including all content, features, algorithms, and functionality, are owned by TradeStats and protected by intellectual property laws.
                    </p>
                    <p className="text-slate-300">
                      You may not copy, modify, distribute, sell, or lease any part of our professional services without explicit written permission from TradeStats.
                    </p>
                  </div>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">6</span>
                    </div>
                    Professional Content & Analytics
                  </h2>
                  
                  <p className="text-slate-300 mb-4">
                    You retain ownership of trading notes, annotations, and other content you create. By providing content, you grant TradeStats a license to use, process, and display your content for service provision and platform improvement.
                  </p>
                  <p className="text-slate-300">
                    We reserve the right to analyze aggregated, anonymized data for platform enhancement and professional insights development.
                  </p>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">7</span>
                    </div>
                    Professional Disclaimers
                  </h2>
                  
                  <div className="bg-amber-600/10 border border-amber-500/20 rounded-lg p-6">
                    <p className="text-amber-300 font-semibold mb-4 uppercase">
                      IMPORTANT PROFESSIONAL DISCLAIMERS:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-300">
                      <li>Our services are provided "AS IS" without warranties of any kind</li>
                      <li>We do not guarantee uninterrupted, secure, or error-free service</li>
                      <li>Platform analytics are for informational purposes only</li>
                      <li>We do not provide financial, investment, or trading advice</li>
                      <li>All trading decisions are solely your responsibility</li>
                    </ul>
                  </div>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">8</span>
                    </div>
                    Limitation of Liability
                  </h2>
                  
                  <div className="bg-red-600/10 border border-red-500/20 rounded-lg p-6">
                    <p className="text-red-300 font-semibold mb-4 uppercase">
                      CRITICAL LIABILITY LIMITATIONS:
                    </p>
                    <p className="text-slate-300 mb-4">
                      To the maximum extent permitted by law, TradeStats shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our professional services.
                    </p>
                    <p className="text-slate-300">
                      We are not responsible for trading losses, financial damages, data breaches affecting third-party services, or decisions made based on platform analytics.
                    </p>
                  </div>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">9</span>
                    </div>
                    Professional Risk Disclosure
                  </h2>
                  
                  <div className="bg-orange-600/10 border border-orange-500/20 rounded-lg p-6">
                    <p className="text-orange-300 font-semibold mb-4">
                      PROFESSIONAL TRADING RISK ACKNOWLEDGMENT:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-300">
                      <li>Cryptocurrency trading involves substantial financial risk</li>
                      <li>Market volatility can result in significant losses</li>
                      <li>Past performance does not indicate future results</li>
                      <li>You are solely responsible for all trading decisions</li>
                      <li>Our platform provides analytics, not financial advice</li>
                      <li>Professional due diligence is essential for all investments</li>
                    </ul>
                  </div>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">10</span>
                    </div>
                    Account Termination
                  </h2>
                  
                  <p className="text-slate-300">
                    We reserve the right to suspend or terminate your access to our professional platform at any time for violations of these Terms, suspicious activity, or other reasons at our discretion. Upon termination, your right to use the services ceases immediately.
                  </p>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">11</span>
                    </div>
                    Terms Modifications
                  </h2>
                  
                  <p className="text-slate-300">
                    We may modify these Terms at any time to reflect service changes, legal requirements, or business needs. We will notify you of material changes through platform notifications or direct communication. Continued use after modifications constitutes acceptance of the updated Terms.
                  </p>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">12</span>
                    </div>
                    Professional Support & Contact
                  </h2>
                  
                  <div className="bg-gradient-to-r from-blue-600/10 to-emerald-600/10 border border-blue-500/20 rounded-lg p-6">
                    <p className="text-slate-300 mb-4">
                      For questions about these Terms, professional support, or enterprise inquiries, contact our dedicated support team:
                    </p>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <a 
                        href="mailto:TradeStatsjournal@gmail.com?subject=Terms%20of%20Service%20Inquiry" 
                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        TradeStatsjournal@gmail.com
                      </a>
                    </div>
                  </div>
                </section>

                <div className="mt-12 pt-8 border-t border-slate-700/50">
                  <p className="text-slate-400 text-sm">
                    These Terms constitute the entire agreement between you and TradeStats regarding use of our professional trading analytics platform. If any provision is found unenforceable, the remainder shall remain in full force and effect.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfService; 