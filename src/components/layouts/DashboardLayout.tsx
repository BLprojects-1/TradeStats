import React, { ReactNode, useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  wallets?: { id: string; wallet_address: string; label?: string }[];
  selectedWalletId?: string | null;
  onWalletChange?: (walletId: string | null) => void;
}

const DashboardLayout = ({
  children,
  title,
  description = "Your Solana Trading Journal Dashboard",
  wallets = [],
  selectedWalletId = null,
  onWalletChange,
}: DashboardLayoutProps) => {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleAvatarClick = () => setDropdownOpen((open) => !open);
  const handleAvatarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setDropdownOpen((open) => !open);
    }
  };
  const handleSignOut = () => {
    setDropdownOpen(false);
    signOut && signOut();
  };

  const handleWalletDropdownClick = () => setWalletDropdownOpen((open) => !open);
  const handleWalletDropdownKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setWalletDropdownOpen((open) => !open);
    }
  };
  const handleWalletSelect = (walletId: string | null) => {
    setWalletDropdownOpen(false);
    onWalletChange && onWalletChange(walletId);
  };

  const selectedWallet = selectedWalletId
    ? wallets.find((w) => w.id === selectedWalletId)
    : null;

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { name: 'Account', href: '/dashboard/account', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { name: 'Open Trades', href: '/dashboard/open-trades', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { name: 'Top Trades', href: '/dashboard/top-trades', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { name: 'Trading History', href: '/dashboard/trading-history', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  return (
    <div className="flex flex-col h-screen bg-black">
      <Head>
        <title>{title} | Journi</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside 
          className={`bg-[#1a1a1a] transition-all duration-300 ease-in-out ${
            isSidebarCollapsed ? 'w-20' : 'w-64'
          } flex flex-col`}
        >
          {/* Logo/Platform Name and Toggle */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg select-none" aria-label="Journi logo" tabIndex={0}>
                J
              </div>
              {!isSidebarCollapsed && (
                <span className="text-xl font-bold text-white tracking-wide select-none">Journi</span>
              )}
            </div>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors ml-2"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isSidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"}
                />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-2 px-2">
              {navigationItems.map((item) => {
                const isActive = router.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={item.icon}
                        />
                      </svg>
                      {!isSidebarCollapsed && (
                        <span className="ml-3">{item.name}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-black">
          {/* Fixed header row inside content area */}
          <div className="relative">
            <div className="fixed top-0 right-0 left-64 z-20 bg-black border-b border-gray-800 shadow-sm px-6 py-4 flex items-center justify-between" style={{height: '72px'}}>
              <h1 className="text-3xl font-bold text-white">{title}</h1>
              <div className="flex items-center gap-4">
                {/* Wallet Dropdown */}
                <div className="relative">
                  <div
                    className="flex items-center gap-2 px-4 py-2 bg-[#23232b] text-white rounded-lg cursor-pointer hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[140px]"
                    tabIndex={0}
                    aria-label="Select wallet"
                    onClick={handleWalletDropdownClick}
                    onKeyDown={handleWalletDropdownKeyDown}
                  >
                    <span className="truncate">
                      {selectedWallet ? (selectedWallet.label || 'Wallet') : 'All wallets'}
                    </span>
                    <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {walletDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-[#23232b] rounded-md shadow-lg py-2 z-30 border border-gray-700 animate-fade-in max-h-72 overflow-y-auto">
                      <button
                        className={`w-full text-left px-4 py-2 text-sm ${!selectedWalletId ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'} focus:bg-gray-800 focus:outline-none`}
                        onClick={() => handleWalletSelect(null)}
                        tabIndex={0}
                        aria-label="Select all wallets"
                      >
                        All wallets
                      </button>
                      {wallets.map((wallet) => (
                        <button
                          key={wallet.id}
                          className={`w-full text-left px-4 py-2 text-sm truncate ${selectedWalletId === wallet.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'} focus:bg-gray-800 focus:outline-none`}
                          onClick={() => handleWalletSelect(wallet.id)}
                          tabIndex={0}
                          aria-label={`Select wallet ${wallet.label || wallet.wallet_address}`}
                        >
                          {wallet.label || 'Wallet'}
                          <span className="block text-xs text-gray-400 truncate">{wallet.wallet_address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* User Avatar */}
                <div className="relative flex items-center">
                  <div
                    ref={avatarRef}
                    className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 transition hover:bg-indigo-600 relative group"
                    tabIndex={0}
                    aria-label="User menu"
                    onClick={handleAvatarClick}
                    onKeyDown={handleAvatarKeyDown}
                  >
                    {user?.email ? user.email[0].toUpperCase() : 'U'}
                    <svg className="w-4 h-4 ml-1 absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 text-indigo-200 group-hover:text-white transition" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {/* Dropdown */}
                  {dropdownOpen && (
                    <div
                      ref={dropdownRef}
                      className="absolute right-0 mt-2 w-48 bg-[#23232b] rounded-xl shadow-lg border border-gray-700 py-2 z-30 animate-fade-in"
                    >
                      <div className="px-4 py-2 text-sm text-gray-300 truncate">{user?.email}</div>
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 focus:bg-gray-800 focus:outline-none rounded-b-xl"
                        onClick={handleSignOut}
                        tabIndex={0}
                        aria-label="Sign out"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* End Content Header Row */}
            <div className="container mx-auto px-6 pt-28">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout; 