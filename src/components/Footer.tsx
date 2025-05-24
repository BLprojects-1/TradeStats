import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const Footer = () => {
  const [showCopied, setShowCopied] = useState(false);
  
  const handleCopyCA = () => {
    // This will be updated when we have the actual CA
    const contractAddress = 'Coming Soon';
    
    // When we have the actual address, uncomment this
    // navigator.clipboard.writeText(contractAddress);
    
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  return (
    <footer className="bg-[#0a0a0f] border-t border-indigo-900/20 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:justify-between">
          <div className="mb-8 md:mb-0">
            <Link href="/" className="block mb-3">
              <Image 
                src="/logo.png" 
                alt="Ryvu Logo" 
                width={140} 
                height={40}
                className="h-10 w-auto"
              />
            </Link>
            <p className="mt-2 text-gray-500 max-w-md">
              Simplifying on-chain trade tracking, turning blockchain complexity into clear, actionable insights.
            </p>
            <div className="flex items-center mt-6 space-x-4">
              <a 
                href="https://x.com/Ryvujournal" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-transform hover:scale-110"
                aria-label="Follow us on X (Twitter)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a 
                href="https://discord.gg/ryvu" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-transform hover:scale-110"
                aria-label="Join our Discord server"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <button 
                onClick={handleCopyCA}
                className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg shadow-md shadow-indigo-900/30 text-white text-sm transition-transform hover:scale-110 relative"
                aria-label="Copy Contract Address"
              >
                <span>CA</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
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
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-3 text-gray-300">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link href="/privacy-policy" className="text-gray-500 hover:text-indigo-300 transition">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="text-gray-500 hover:text-indigo-300 transition">Terms of Service</Link></li>
              <li><Link href="/contact" className="text-gray-500 hover:text-indigo-300 transition">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-indigo-900/20 text-center text-gray-600">
          <p>© {new Date().getFullYear()} Ryvu. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 