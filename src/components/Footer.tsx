import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const Footer = () => {
  const [showCopied, setShowCopied] = useState(false);
  
  const handleCopyCA = () => {
    const contractAddress = 'CznXPae3VynYrWhbo3RqhyxAWGqcNYg6pfcyjdsipump';
    navigator.clipboard.writeText(contractAddress);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  return (
    <footer className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-slate-700/50 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-1/4 h-1/3 bg-emerald-600/10 blur-[100px] rounded-full"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-16 lg:gap-24">
          {/* Brand Section */}
          <div className="lg:col-span-2 md:col-span-2">
            <Link href="/" className="inline-block mb-6">
              <svg width="120" height="32" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-10 w-auto">
                <defs>
                  <linearGradient id="footerLogoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{stopColor:'#3B82F6', stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#10B981', stopOpacity:1}} />
                  </linearGradient>
                </defs>
                <g transform="translate(0, 6)">
                  <rect width="20" height="20" rx="4" fill="url(#footerLogoGradient)" />
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
            <p className="text-lg text-slate-300 mb-8 max-w-md leading-relaxed">
              Professional-grade Solana trading analytics and portfolio management for serious traders who demand precision and performance.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center space-x-4 mb-8">
              <a 
                href="https://x.com/Tradestatsxyz" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-110 group"
                aria-label="Follow us on X (Twitter)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white group-hover:scale-110 transition-transform">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
          
          {/* Professional Tools */}
          <div className="lg:col-span-1">
            <h4 className="text-xl font-bold text-white mb-6">Professional Tools</h4>
            <ul className="space-y-4">
              {/* Dexscreener */}
              <li>
                <a
                  href="https://dexscreener.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <img 
                      src="/dexscreener.png" 
                      alt="Dexscreener" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors">Dexscreener</h3>
                    <p className="text-slate-400 text-xs truncate">Real-time DEX charts & analytics</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
              {/* Axiom */}
              <li>
                <a
                  href="https://axiom.trade/@TICKR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <img 
                      src="/axiom.jpg" 
                      alt="Axiom" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors">Axiom</h3>
                    <p className="text-slate-400 text-xs truncate">Advanced trading platform</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <img 
                      src="/bullx.jpg" 
                      alt="BullX" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors">BullX</h3>
                    <p className="text-slate-400 text-xs truncate">Multi-chain trading bot</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-1">
            <h4 className="text-xl font-bold text-white mb-6">Resources</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/privacy-policy" className="text-slate-300 hover:text-blue-300 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                  <span className="text-sm">Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="text-slate-300 hover:text-blue-300 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                  <span className="text-sm">Terms of Service</span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-300 hover:text-blue-300 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                  <span className="text-sm">Contact Us</span>
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className="text-slate-300 hover:text-blue-300 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full mr-3 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                  <span className="text-sm">Roadmap</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Disclaimer & Copyright */}
        <div className="mt-16 pt-8 border-t border-slate-700/50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="max-w-2xl">
              <p className="text-sm text-slate-400 leading-relaxed">
                <strong className="text-slate-300">Professional Trading Platform:</strong> TICKR provides advanced analytics and portfolio management tools for Solana trading. All investments carry risk. Trading cryptocurrencies involves substantial risk and may not be suitable for all investors. Past performance does not guarantee future results.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400 mb-2">
                © 2025 TICKR Analytics. All rights reserved.
              </p>
              <p className="text-xs text-slate-500">
                Built for professional traders
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 