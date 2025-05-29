import React from 'react';
import Head from 'next/head';
import Footer from '../components/Footer';
import Image from 'next/image';
import Link from 'next/link';

const TermsOfService = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-gray-100">
      <Head>
        <title>Terms of Service | Ryvu</title>
        <meta name="description" content="Ryvu Terms of Service - Learn about the terms that govern your use of our platform." />
      </Head>

      <header className="bg-[#0a0a0f]/80 backdrop-blur-md border-b border-indigo-900/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-5 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="block">
              <Image 
                src="/logo.png" 
                alt="Ryvu Logo" 
                width={140} 
                height={40}
                className="h-6 sm:h-10 w-auto"
                priority
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={() => {navigator.clipboard.writeText('Coming Soon')}}
              className="flex items-center space-x-1.5 px-2.5 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg shadow-md shadow-indigo-900/30 text-white text-sm transition-transform hover:scale-110 relative"
              aria-label="Copy Contract Address"
              tabIndex={0}
              onKeyDown={e => {if (e.key === 'Enter' || e.key === ' ') {navigator.clipboard.writeText('Coming Soon')}}}
            >
              <span>CA</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <div>
            <Link href="/" className="px-3 sm:px-4 py-1 sm:py-2 text-sm sm:text-base text-indigo-300 hover:text-indigo-200 font-medium transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-b from-[#1a1a2e] to-[#1a1a28] p-8 md:p-12 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/5">
            <h1 className="text-3xl font-bold mb-8 text-white">Terms of Service</h1>
            
            <div className="space-y-6 text-gray-300">
              <p className="text-sm text-gray-400">Last Updated: {new Date().toLocaleDateString()}</p>
              
              <p>
                Welcome to Ryvu. Please read these Terms of Service ("Terms") carefully before using our website (ryvu.xyz) and services.
              </p>
              
              <p>
                By accessing or using Ryvu, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our services.
              </p>
              
              <p>The terms &quot;User&quot;, &quot;You&quot;, &quot;Your&quot;, &quot;Service&quot;, and &quot;Agreement&quot; have specific meanings in this document.</p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">1. Service Description</h2>
              
              <p>
                Ryvu is a Solana trading journal platform that allows users to track, analyze, and optimize their cryptocurrency trading activities on the Solana blockchain.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">2. Account Registration</h2>
              
              <p>
                To use certain features of our service, you may need to create an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate and complete.
              </p>
              
              <p>
                You are responsible for safeguarding your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">3. Wallet Connection</h2>
              
              <p>
                Our service allows you to connect your Solana wallet(s) to analyze your trading activity. When connecting your wallet, you:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Authorize us to read public blockchain data associated with your wallet address</li>
                <li>Understand that we do not take custody of your funds or private keys</li>
                <li>Acknowledge that you are the rightful owner or authorized user of any wallet you connect</li>
              </ul>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">4. User Conduct</h2>
              
              <p>You agree not to:</p>
              
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Use our services for any illegal purpose</li>
                <li>Violate any laws in your jurisdiction</li>
                <li>Interfere with or disrupt the integrity or performance of our services</li>
                <li>Attempt to gain unauthorized access to our services or systems</li>
                <li>Impersonate another person or entity</li>
                <li>Engage in any abusive, harassing, or harmful behavior</li>
              </ul>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">5. Intellectual Property</h2>
              
              <p>
                Our services, including all content, features, and functionality, are owned by Ryvu and are protected by copyright, trademark, and other intellectual property laws.
              </p>
              
              <p>
                You may not copy, modify, distribute, sell, or lease any part of our services without our explicit permission.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">6. User Content</h2>
              
              <p>
                You retain ownership of any content you create, submit, or display through our services. By providing content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content for the purpose of providing and improving our services.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">7. Disclaimer of Warranties</h2>
              
              <p className="uppercase font-medium">
                Our services are provided "as is" and "as available" without warranties of any kind, either express or implied.
              </p>
              
              <p>
                We do not guarantee that our services will be uninterrupted, secure, or error-free. We do not warrant the accuracy, completeness, or usefulness of any information provided.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">8. Limitation of Liability</h2>
              
              <p className="uppercase font-medium">
                To the maximum extent permitted by law, Ryvu shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use our services.
              </p>
              
              <p>
                We are not responsible for any losses or damages resulting from your use of our services, including but not limited to trading decisions, financial losses, or data breaches.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">9. Risk Disclosure</h2>
              
              <p>
                Cryptocurrency trading involves significant risk. You acknowledge and agree that:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Cryptocurrency prices can be volatile</li>
                <li>Past performance is not indicative of future results</li>
                <li>You are solely responsible for your trading decisions</li>
                <li>Our platform is for informational purposes only and does not constitute financial advice</li>
              </ul>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">10. Termination</h2>
              
              <p>
                We reserve the right to suspend or terminate your access to our services at any time for any reason, including but not limited to a violation of these Terms.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">11. Changes to Terms</h2>
              
              <p>
                We may modify these Terms at any time. We will notify you of any changes by updating the "Last Updated" date at the top of these Terms.
              </p>
              
              <p>
                Your continued use of our services after the changes take effect constitutes your acceptance of the revised Terms.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">12. Governing Law</h2>
              
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Ryvu operates, without regard to its conflict of law provisions.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">13. Contact Us</h2>
              
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="mt-2">
                <a href="mailto:ryvujournal@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition">ryvujournal@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfService; 