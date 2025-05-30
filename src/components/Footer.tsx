import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const Footer = () => {
  const [showCopied, setShowCopied] = useState(false);
  
  const handleCopyCA = () => {
    const contractAddress = 'EWnHE6JuF1nrih1xZNJBSd6977swuEquuyyrTuLQpump';
    navigator.clipboard.writeText(contractAddress);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  return (
    <footer className="relative bg-gradient-to-b from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] border-t border-indigo-500/20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-indigo-900/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-1/4 h-1/3 bg-purple-900/10 blur-[100px] rounded-full"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-16 lg:gap-24">
          {/* Brand Section */}
          <div className="lg:col-span-2 md:col-span-2">
            <Link href="/" className="inline-block mb-6">
              <Image 
                src="/logo.png" 
                alt="Ryvu Logo" 
                width={140} 
                height={40}
                className="h-12 w-auto"
              />
            </Link>
            <p className="text-lg text-gray-300 mb-8 max-w-md leading-relaxed">
              Simplifying on-chain trade tracking, turning blockchain complexity into clear, actionable insights.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center space-x-4 mb-8">
              <a 
                href="https://x.com/Ryvujournal" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30 transition-all duration-300 hover:scale-110 group"
                aria-label="Follow us on X (Twitter)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white group-hover:scale-110 transition-transform">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a 
                href="https://t.me/+Jq_SuZsXYlI3NWNk" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30 transition-all duration-300 hover:scale-110 group"
                aria-label="Join our Telegram channel"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white group-hover:scale-110 transition-transform">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
              <a 
                href="https://discord.gg/6q7UrFsy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30 transition-all duration-300 hover:scale-110 group"
                aria-label="Join our Discord server"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white group-hover:scale-110 transition-transform">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <button 
                onClick={handleCopyCA}
                className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-900/30 text-white text-sm transition-all duration-300 hover:scale-110 relative group"
                aria-label="Copy Contract Address"
              >
                <span className="font-medium">CA</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:scale-110 transition-transform">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                {showCopied && (
                  <span className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-white text-indigo-900 px-3 py-2 rounded-lg text-xs font-medium shadow-lg">
                    Copied!
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* Trading Tools */}
          <div className="lg:col-span-1">
            <h4 className="text-xl font-bold text-white mb-6">Trading Tools</h4>
            <ul className="space-y-4">
              {/* Dexscreener */}
              <li>
                <a
                  href="https://dexscreener.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#252525] transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <img 
                      src="/dexscreener.png" 
                      alt="Dexscreener" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-sm font-medium group-hover:text-indigo-200 transition-colors">Dexscreener</h3>
                    <p className="text-gray-400 text-xs truncate">Real-time DEX charts & analytics</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
              {/* Axiom */}
              <li>
                <a
                  href="https://axiom.trade/@ryvu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#252525] transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <img 
                      src="/axiom.jpg" 
                      alt="Axiom" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-sm font-medium group-hover:text-indigo-200 transition-colors">Axiom</h3>
                    <p className="text-gray-400 text-xs truncate">Advanced trading platform</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
              {/* BullX */}
              <li>
                <a
                  href="https://bull-x.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#252525] transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <img 
                      src="/bullx.jpg" 
                      alt="BullX" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-sm font-medium group-hover:text-indigo-200 transition-colors">BullX</h3>
                    <p className="text-gray-400 text-xs truncate">Multi-chain trading bot</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-1">
            <h4 className="text-xl font-bold text-white mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/privacy-policy" className="text-gray-300 hover:text-indigo-300 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full mr-3 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                  <span className="text-sm">Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="text-gray-300 hover:text-indigo-300 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full mr-3 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                  <span className="text-sm">Terms of Service</span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-300 hover:text-indigo-300 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full mr-3 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                  <span className="text-sm">Contact Us</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Disclaimer & Copyright */}
        <div className="mt-16 pt-8 border-t border-indigo-500/20">
          <div className="flex flex-col lg:flex-row justify-between items-center space-y-6 lg:space-y-0">
            <div className="text-center lg:text-left">
              <p className="text-gray-400 mb-2">© {new Date().getFullYear()} Ryvu. All rights reserved.</p>
              <p className="text-sm text-gray-500">Self-custodial trading analytics for the Solana ecosystem. Not financial advice. Some data may be inaccurate.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 