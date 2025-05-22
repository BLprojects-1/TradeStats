import React, { ReactNode } from 'react';
import Head from 'next/head';
import Footer from '../Footer';
import Link from 'next/link';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  showHeader?: boolean;
  userName?: string;
  onSignOut?: () => void;
}

export default function MainLayout({
  children,
  title = "Home",
  description = "Solana Trading Journal",
  showHeader = true,
  userName,
  onSignOut
}: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Head>
        <title>{title} | ryvu</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {showHeader && (
        <header className="bg-gradient-to-r from-[#0c0c0f] to-[#1a1a1a] shadow-md border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <img src="/logo.png" alt="ryvu Logo" className="h-8 w-auto mr-3" />
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-indigo-400">ryvu</h1>
              </Link>
            </div>
            
            {userName && onSignOut && (
              <div className="flex items-center gap-4">
                <div className="text-gray-300">Welcome, {userName}</div>
                <button 
                  onClick={onSignOut}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition font-medium"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="flex-grow">
        {children}
      </main>

      <Footer />
    </div>
  );
} 