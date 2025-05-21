import React from 'react';
import Head from 'next/head';

export default function TestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <Head>
        <title>Test Page | Journi</title>
      </Head>
      <div className="text-center p-8 bg-[#121212] rounded-lg shadow-xl">
        <h1 className="text-4xl font-bold text-indigo-400 mb-4">Test Page - Journi App</h1>
        <p className="text-gray-300 text-xl">Your black themed Solana trading journal is working!</p>
        <a 
          href="/" 
          className="mt-6 inline-block px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
} 