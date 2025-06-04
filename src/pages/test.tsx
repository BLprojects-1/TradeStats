import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function TestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <Head>
        <title>Test Page | TICKR</title>
      </Head>
      <div className="text-center p-8 bg-[#121212] rounded-lg shadow-xl">
        <h1 className="text-4xl font-bold text-indigo-400 mb-4">Test Page - TICKR App</h1>
        <p className="text-gray-300 text-xl">Your black themed Solana trading journal is working!</p>
        <Link href="/" className="text-blue-500 hover:text-blue-700">
          Go back home
        </Link>
      </div>
    </div>
  );
} 