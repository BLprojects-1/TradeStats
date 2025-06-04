import React from 'react';
import Head from 'next/head';
import Footer from '../components/Footer';
import Link from 'next/link';

const PrivacyPolicy = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-background text-slate-100 relative overflow-hidden">
      <Head>
        <title>Privacy Policy | TICKR | Professional Solana Trading Analytics</title>
        <meta name="description" content="TICKR Privacy Policy - Learn how we protect your data and privacy in our professional trading analytics platform." />
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
                  navigator.clipboard.writeText('4Hcm1TfA1MvVhCQHvJCcKL7ymUhJZAV7P439H5ZHnKRh');
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
              <h1 className="text-4xl sm:text-5xl font-bold mb-6 gradient-text">Privacy Policy</h1>
              <p className="text-xl text-slate-300">
                Your privacy and data security are fundamental to our professional trading analytics platform.
              </p>
            </div>
            
            <div className="prose prose-invert prose-blue max-w-none">
              <div className="mb-8 p-4 bg-blue-600/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Last Updated: {new Date().toLocaleDateString()}</p>
                <p className="text-slate-300 font-medium">
                  This Privacy Policy outlines how TICKR collects, uses, and protects your information when using our professional Solana trading analytics platform.
                </p>
              </div>
              
              <div className="space-y-8">
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">1</span>
                    </div>
                    Information We Collect
                  </h2>
                  
                  <p className="text-slate-300 mb-4">
                    We collect information that you provide directly to us when you:
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-300">
                    <li>Create an account on our professional platform</li>
                    <li>Connect your Solana wallet(s) for analytics</li>
                    <li>Use our trading journal and analytics features</li>
                    <li>Contact our professional support team</li>
                    <li>Participate in surveys or promotional activities</li>
                  </ul>
                  
                  <p className="text-slate-300 mt-4 mb-2">This information may include:</p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-300">
                    <li>Email address for account management</li>
                    <li>Professional display name and preferences</li>
                    <li>Solana wallet addresses for analytics</li>
                    <li>Trading notes, annotations, and checklist data</li>
                    <li>Device information and platform usage analytics</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">2</span>
                    </div>
                    How We Use Your Information
                  </h2>
                  
                  <p className="text-slate-300 mb-4">
                    We use the information we collect to provide and enhance our professional trading analytics services:
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-300">
                    <li>Provide, maintain, and improve our analytics platform</li>
                    <li>Process transactions and manage your professional account</li>
                    <li>Deliver technical updates, security alerts, and support communications</li>
                    <li>Respond to your inquiries and provide professional customer service</li>
                    <li>Monitor platform performance and analyze usage patterns</li>
                    <li>Detect, prevent, and address technical and security issues</li>
                    <li>Protect against unauthorized access and malicious activity</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">3</span>
                    </div>
                    Blockchain Data & Analytics
                  </h2>
                  
                  <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-lg p-6">
                    <p className="text-slate-300">
                      <strong className="text-emerald-400">Professional-Grade Analytics:</strong> TICKR analyzes public blockchain data associated with your connected wallet addresses to provide institutional-level trading insights. This data is already publicly available on the Solana blockchain and immutable by design. We transform this raw data into actionable professional analytics while maintaining the highest standards of data integrity.
                    </p>
                  </div>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">4</span>
                    </div>
                    Data Sharing and Disclosure
                  </h2>
                  
                  <p className="text-slate-300 mb-4">
                    We may share your information only in these specific circumstances:
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-300">
                    <li>With trusted service providers who perform services on our behalf</li>
                    <li>To comply with legal obligations and regulatory requirements</li>
                    <li>To protect our rights, privacy, safety, and intellectual property</li>
                    <li>In connection with a business transfer, merger, or acquisition</li>
                  </ul>
                  
                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-4 mt-4">
                    <p className="text-blue-300 font-medium">
                      <strong>Enterprise Commitment:</strong> We will never sell your personal information to third parties. Your trading data and professional insights remain confidential and secure.
                    </p>
                  </div>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">5</span>
                    </div>
                    Your Professional Controls
                  </h2>
                  
                  <p className="text-slate-300 mb-4">
                    You have full control over your professional account and data:
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-300">
                    <li>Manage account information and preferences through your dashboard</li>
                    <li>Update privacy settings and notification preferences</li>
                    <li>Disconnect wallet addresses at any time</li>
                    <li>Export your trading analytics and data</li>
                    <li>Request account deletion and data removal</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">6</span>
                    </div>
                    Enterprise-Grade Security
                  </h2>
                  
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                    <p className="text-slate-300 mb-4">
                      We implement institutional-level security measures to protect your information:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-300">
                      <li>End-to-end encryption for sensitive data</li>
                      <li>Regular security audits and penetration testing</li>
                      <li>SOC 2 compliant data handling procedures</li>
                      <li>Multi-factor authentication support</li>
                      <li>Secure cloud infrastructure with automated backups</li>
                    </ul>
                    <p className="text-slate-400 text-sm mt-4">
                      However, no electronic transmission or storage can be entirely secure. Please protect your login credentials and report any suspicious activity immediately.
                    </p>
                  </div>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">7</span>
                    </div>
                    Professional Age Requirements
                  </h2>
                  
                  <p className="text-slate-300">
                    Our professional platform is designed for adult traders. We do not knowingly collect personal information from individuals under 18. If you believe we have collected information from a minor, please contact us immediately for removal.
                  </p>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">8</span>
                    </div>
                    Policy Updates
                  </h2>
                  
                  <p className="text-slate-300">
                    We may update this Privacy Policy to reflect changes in our practices or legal requirements. We will notify you of any material changes by updating the "Last Updated" date and, for significant changes, through direct communication or platform notifications.
                  </p>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">9</span>
                    </div>
                    Contact Our Privacy Team
                  </h2>
                  
                  <div className="bg-gradient-to-r from-blue-600/10 to-emerald-600/10 border border-blue-500/20 rounded-lg p-6">
                    <p className="text-slate-300 mb-4">
                      For privacy-related questions, data requests, or concerns about this policy, contact our dedicated privacy team:
                    </p>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <a 
                        href="mailto:TICKRjournal@gmail.com?subject=Privacy%20Policy%20Inquiry" 
                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        TICKRjournal@gmail.com
                      </a>
                    </div>
                  </div>
                </section>

                <div className="mt-12 pt-8 border-t border-slate-700/50">
                  <p className="text-slate-400 text-sm">
                    The terms "Personal Data", "Data Subject", "Controller", and "Processor" have the meanings given in applicable data protection regulations including GDPR where applicable.
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

export default PrivacyPolicy; 