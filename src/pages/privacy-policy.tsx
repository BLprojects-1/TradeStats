import React from 'react';
import Head from 'next/head';
import Footer from '../components/Footer';
import Image from 'next/image';
import Link from 'next/link';

const PrivacyPolicy = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-gray-100">
      <Head>
        <title>Privacy Policy | Ryvu</title>
        <meta name="description" content="Ryvu Privacy Policy - Learn how we protect your data and privacy." />
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
            <h1 className="text-3xl font-bold mb-8 text-white">Privacy Policy</h1>
            
            <div className="space-y-6 text-gray-300">
              <p className="text-sm text-gray-400">Last Updated: {new Date().toLocaleDateString()}</p>
              
              <p>
                Welcome to Ryvu ("we," "our," or "us"). At Ryvu, we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website (ryvu.xyz) and services.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">Information We Collect</h2>
              
              <p>We collect information that you provide directly to us when you:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Create an account</li>
                <li>Connect your Solana wallet(s)</li>
                <li>Use our trading journal features</li>
                <li>Contact customer support</li>
                <li>Participate in surveys or promotions</li>
              </ul>
              
              <p>This information may include:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Email address</li>
                <li>Display name</li>
                <li>Wallet addresses</li>
                <li>Trading notes and annotations</li>
                <li>Device information and usage data</li>
              </ul>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">How We Use Your Information</h2>
              
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and manage your account</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Monitor and analyze usage trends</li>
                <li>Detect, prevent, and address technical issues</li>
                <li>Protect against harmful, unauthorized, or illegal activity</li>
              </ul>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">Blockchain Data</h2>
              
              <p>
                Ryvu analyzes public blockchain data associated with connected wallet addresses. This data is already publicly available on the Solana blockchain. We do not have the ability to alter or delete this data, as it is inherent to the blockchain's immutable nature.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">Data Sharing and Disclosure</h2>
              
              <p>We may share your information in the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>With service providers who perform services on our behalf</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights, privacy, safety, or property</li>
                <li>In connection with a business transfer (e.g., merger or acquisition)</li>
              </ul>
              
              <p>
                We will not sell your personal information to third parties.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">Your Choices</h2>
              
              <p>
                You can manage your account information, update preferences, and adjust privacy settings through your account dashboard. You may also disconnect wallet addresses at any time.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">Data Security</h2>
              
              <p>
                We implement appropriate technical and organizational measures to protect your personal information. However, no electronic transmission or storage of information can be entirely secure, so please be vigilant in protecting your login credentials.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">Children's Privacy</h2>
              
              <p>
                Our services are not directed to children under 18. We do not knowingly collect personal information from children under 18. If you believe we have collected information from a child under 18, please contact us.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">Changes to This Privacy Policy</h2>
              
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
              </p>
              
              <h2 className="text-xl font-semibold mt-8 mb-4 text-white">Contact Us</h2>
              
              <p>
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <p className="mt-2">
                <a href="mailto:support@ryvu.xyz" className="text-indigo-400 hover:text-indigo-300 transition">support@ryvu.xyz</a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy; 