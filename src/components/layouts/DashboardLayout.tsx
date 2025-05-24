import React, { ReactNode, useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { TrackedWallet } from '../../utils/userProfile';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import NotificationToast from '../NotificationToast';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  wallets?: TrackedWallet[];
  selectedWalletId?: string | null;
  onWalletChange?: (walletId: string | null) => void;
}

const DashboardLayout = ({
  children,
  title,
  description = "Your Solana Trading Journal Dashboard",
  wallets: propWallets,
  selectedWalletId: propSelectedWalletId,
  onWalletChange
}: DashboardLayoutProps) => {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const walletDropdownRef = useRef<HTMLDivElement>(null);

  // Use the shared wallet selection context
  const { 
    wallets: contextWallets, 
    selectedWalletId: contextSelectedWalletId,
    setSelectedWalletId: contextSetSelectedWalletId
  } = useWalletSelection();

  // Use context values, falling back to props for backward compatibility
  const wallets = contextWallets || propWallets || [];
  const selectedWalletId = contextSelectedWalletId !== null ? contextSelectedWalletId : propSelectedWalletId;

  const handleAvatarClick = () => setDropdownOpen((open) => !open);
  const handleAvatarKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setDropdownOpen((open) => !open);
    }
  };
  const handleSignOut = () => {
    setDropdownOpen(false);
    signOut && signOut();
  };

  const handleWalletDropdownClick = () => setWalletDropdownOpen((open) => !open);
  const handleWalletDropdownKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setWalletDropdownOpen((open) => !open);
    }
  };
  const handleWalletSelect = (walletId: string | null) => {
    // Update the context first
    contextSetSelectedWalletId(walletId);
    // Also call the prop handler for backward compatibility
    if (onWalletChange) {
      onWalletChange(walletId);
    }
    // Close dropdown immediately since we're using mousedown now
    setWalletDropdownOpen(false);
    
    // Show notification
    if (walletId) {
      const selectedWallet = wallets.find(w => w.id === walletId);
      if (selectedWallet) {
        const walletDisplay = selectedWallet.label || selectedWallet.nickname || 
          `${selectedWallet.wallet_address.substring(0, 6)}...${selectedWallet.wallet_address.substring(selectedWallet.wallet_address.length - 4)}`;
        setNotificationMessage(`Loading saved wallets for: ${walletDisplay}`);
        setNotificationVisible(true);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          setNotificationVisible(false);
        }, 3000);
      }
    }
  };

  const selectedWallet = selectedWalletId
    ? wallets.find((w) => w.id === selectedWalletId)
    : null;

  const handleCopyCA = () => {
    // This will be updated when we have the actual CA
    const contractAddress = 'Coming Soon';
    
    // When we have the actual address, uncomment this
    // navigator.clipboard.writeText(contractAddress);
    
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { name: 'Open Trades', href: '/dashboard/open-trades', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { name: 'Top Trades', href: '/dashboard/top-trades', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { name: 'Trading History', href: '/dashboard/trading-history', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { name: 'Trade Log', href: '/dashboard/trade-log', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
    { name: 'Account', href: '/dashboard/account', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }
  ];

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
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

  // Close wallet dropdown on outside click
  useEffect(() => {
    if (!walletDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        walletDropdownRef.current &&
        !walletDropdownRef.current.contains(e.target as Node)
      ) {
        setWalletDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [walletDropdownOpen]);

  // Close mobile sidebar on outside click or route change
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsMobileSidebarOpen(false);
      }
    };

    if (isMobileSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileSidebarOpen]);

  // Close mobile sidebar on route change
  useEffect(() => {
    const handleRouteChange = () => {
      setIsMobileSidebarOpen(false);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  // Handle wallet selection change
  const handleWalletChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newWalletId = e.target.value || null;
    
    // Update the context
    contextSetSelectedWalletId(newWalletId);
    
    // Also call the prop handler for backward compatibility
    if (onWalletChange) {
      onWalletChange(newWalletId);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black">
      <Head>
        <title>{title} | ryvu</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.ico" />
        <style jsx>{`
          @keyframes slideDownFadeIn {
            0% {
              opacity: 0;
              transform: translateY(-10px) scale(0.95);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes slideUpFadeOut {
            0% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-10px) scale(0.95);
            }
          }
        `}</style>
      </Head>

      <div className="flex flex-1 min-h-0">
        {/* Mobile Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-70 z-30 md:hidden" onClick={toggleMobileSidebar} />
        )}

        {/* Sidebar - Hidden on mobile, revealed with toggle */}
        <aside 
          ref={sidebarRef}
          className={`fixed md:relative bg-[#1a1a1a] h-full transition-all duration-300 ease-in-out z-40
            ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'} 
            ${isMobileSidebarOpen ? 'w-64 left-0' : '-left-64 md:left-0'} 
            flex flex-col border-r border-gray-800`}
        >
          {/* Logo/Platform Name and Toggle */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Image 
                src="/logo.png" 
                alt="Ryvu Logo" 
                width={isSidebarCollapsed ? 32 : 120} 
                height={32}
                className="h-7 w-auto"
                priority
              />
            </div>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors ml-2 hidden md:block"
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
            <button
              onClick={toggleMobileSidebar}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors ml-2 md:hidden"
              aria-label="Close sidebar"
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
                  d="M6 18L18 6M6 6l12 12"
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
                      {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                        <span className="ml-3">{item.name}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Social Links */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center justify-center space-x-3">
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
              <a 
                href="https://discord.gg/ryvu" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-transform hover:scale-110"
                aria-label="Join our Discord server"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <button 
                onClick={handleCopyCA}
                className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-transform hover:scale-110 relative group"
                aria-label="Copy Contract Address"
              >
                <span className="text-white text-sm font-medium">CA</span>
                {showCopied && (
                  <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white text-indigo-900 px-2 py-1 rounded text-xs font-medium">
                    Coming Soon
                  </span>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-black">
          {/* Fixed header row inside content area */}
          <div className="relative">
            {/* Completely redesigned header */}
            <header 
              className="fixed top-0 right-0 z-20 w-full md:w-auto md:left-0 transition-all duration-300" 
              style={{ 
                marginLeft: `${isSidebarCollapsed ? '5rem' : '16rem'}`,
              }}
              // Media query handled by CSS instead of inline style
              // The mobile view will have marginLeft: 0 through responsive classes
              
            >
              <div className="bg-[#1a1a1a] border-b border-gray-800 shadow-lg">
                <div className="flex items-center justify-between h-[60px] p-9">
                  {/* Left side - Title and Mobile Menu */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleMobileSidebar}
                      className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors md:hidden"
                      aria-label="Open menu"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      </svg>
                    </button>

                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                        {title}
                      </span>
                    </h1>
                  </div>
                  
                  {/* Right side - Wallet selector and user avatar */}
                  <div className="flex items-center gap-3 sm:gap-5">
                    {/* Wallet Dropdown - Desktop */}
                    <div className="relative hidden sm:block min-w-[180px] lg:min-w-[250px]" ref={walletDropdownRef}>
                      <button
                        onClick={handleWalletDropdownClick}
                        onKeyDown={handleWalletDropdownKeyDown}
                        className="flex items-center justify-between w-full bg-[#1d1d23] border border-gray-700 hover:border-indigo-400 rounded-lg px-3 py-2.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10"
                        aria-label="Select wallet"
                        tabIndex={0}
                      >
                        <span className="text-sm text-gray-100 group-hover:text-white transition-colors duration-200 truncate">
                          {selectedWalletId 
                            ? (() => {
                                const wallet = wallets.find(w => w.id === selectedWalletId);
                                if (!wallet) return 'Select wallet';
                                return `${wallet.wallet_address.substring(0, 6)}...${wallet.wallet_address.substring(wallet.wallet_address.length - 4)}${wallet.label ? ` (${wallet.label})` : wallet.nickname ? ` (${wallet.nickname})` : ''}`;
                              })()
                            : 'Select wallet'
                          }
                        </span>
                        <div className="pointer-events-none transform transition-transform duration-200 group-hover:scale-110 ml-2">
                          <svg className={`w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-all duration-200 ${walletDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                          </svg>
                        </div>
                      </button>

                      {/* Wallet dropdown menu */}
                      {walletDropdownOpen && (
                        <div
                          className="absolute left-0 mt-3 w-full bg-[#1d1d23] rounded-xl shadow-2xl border border-gray-600 overflow-hidden z-30 
                                   transform transition-all duration-200 ease-out origin-top
                                   animate-in slide-in-from-top-2 fade-in-0"
                          style={{
                            animation: 'slideDownFadeIn 0.2s ease-out forwards'
                          }}
                        >
                          <div className="max-h-64 overflow-y-auto">
                            <div className="py-1">
                              {!selectedWalletId && (
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleWalletSelect(null);
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gradient-to-r hover:from-indigo-900/20 hover:to-indigo-800/20 focus:bg-gradient-to-r focus:from-indigo-900/20 focus:to-indigo-800/20 focus:outline-none transition-all duration-150"
                                >
                                  Select wallet
                                </button>
                              )}
                              {wallets.map((wallet) => (
                                <button
                                  key={wallet.id}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleWalletSelect(wallet.id);
                                  }}
                                  className={`w-full text-left px-4 py-3 text-sm transition-all duration-150 focus:outline-none group ${
                                    selectedWalletId === wallet.id
                                      ? 'bg-gradient-to-r from-indigo-900/40 to-indigo-800/40 text-indigo-200'
                                      : 'text-gray-100 hover:bg-gradient-to-r hover:from-indigo-900/20 hover:to-indigo-800/20 focus:bg-gradient-to-r focus:from-indigo-900/20 focus:to-indigo-800/20'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium">
                                        {wallet.wallet_address.substring(0, 6)}...{wallet.wallet_address.substring(wallet.wallet_address.length - 4)}
                                      </div>
                                      {(wallet.label || wallet.nickname) && (
                                        <div className="text-xs text-gray-400 mt-0.5">
                                          {wallet.label || wallet.nickname}
                                        </div>
                                      )}
                                    </div>
                                    {selectedWalletId === wallet.id && (
                                      <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* User Avatar - Fixed TypeScript errors with button ref and keyboard handler */}
                    <div className="relative">
                      <button
                        ref={avatarRef}
                        className="h-9 w-9 rounded-full overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-[#1a1a1a] transition-all hover:from-indigo-500 hover:to-indigo-700 shadow-md"
                        onClick={handleAvatarClick}
                        onKeyDown={handleAvatarKeyDown}
                        aria-label="User menu"
                        tabIndex={0}
                      >
                        {user?.email ? user.email[0].toUpperCase() : 'U'}
                      </button>
                      
                      {/* Avatar dropdown */}
                      {dropdownOpen && (
                        <div
                          ref={dropdownRef}
                          className="absolute right-0 mt-3 w-56 bg-[#1d1d23] rounded-xl shadow-2xl border border-gray-600 overflow-hidden z-30 
                                   transform transition-all duration-200 ease-out origin-top-right
                                   animate-in slide-in-from-top-2 fade-in-0"
                          style={{
                            animation: 'slideDownFadeIn 0.2s ease-out forwards'
                          }}
                        >
                          <div className="px-4 py-3 bg-gradient-to-r from-[#1d1d23] to-[#252530] border-b border-gray-600">
                            <div className="text-sm font-medium text-gray-200 truncate">{user?.email}</div>
                            <div className="text-xs text-gray-400 mt-1">Account Settings</div>
                          </div>
                          <div className="py-1">
                            <button
                              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gradient-to-r hover:from-red-900/20 hover:to-red-800/20 focus:bg-gradient-to-r focus:from-red-900/20 focus:to-red-800/20 focus:outline-none transition-all duration-150 flex items-center gap-3 group"
                              onClick={handleSignOut}
                              tabIndex={0}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                              <span className="font-medium">Sign out</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Mobile wallet selector - Improved styling */}
              <div className="bg-[#1a1a1a] border-b border-gray-800 p-4 sm:hidden shadow-md">
                <div className="relative" ref={walletDropdownRef}>
                  <button
                    onClick={handleWalletDropdownClick}
                    onKeyDown={handleWalletDropdownKeyDown}
                    className="flex items-center justify-between w-full bg-[#1d1d23] border border-gray-700 hover:border-indigo-400 rounded-lg px-3 py-2.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10"
                    aria-label="Select wallet"
                    tabIndex={0}
                  >
                    <span className="text-sm text-gray-100 group-hover:text-white transition-colors duration-200 truncate">
                      {selectedWalletId 
                        ? (() => {
                            const wallet = wallets.find(w => w.id === selectedWalletId);
                            if (!wallet) return 'Select wallet';
                            return `${wallet.wallet_address.substring(0, 6)}...${wallet.wallet_address.substring(wallet.wallet_address.length - 4)}${wallet.label ? ` (${wallet.label})` : wallet.nickname ? ` (${wallet.nickname})` : ''}`;
                          })()
                        : 'Select wallet'
                      }
                    </span>
                    <div className="pointer-events-none transform transition-transform duration-200 group-hover:scale-110 ml-2">
                      <svg className={`w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-all duration-200 ${walletDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </button>

                  {/* Mobile wallet dropdown menu */}
                  {walletDropdownOpen && (
                    <div
                      className="absolute left-0 mt-3 w-full bg-[#1d1d23] rounded-xl shadow-2xl border border-gray-600 overflow-hidden z-30 
                               transform transition-all duration-200 ease-out origin-top
                               animate-in slide-in-from-top-2 fade-in-0"
                      style={{
                        animation: 'slideDownFadeIn 0.2s ease-out forwards'
                      }}
                    >
                      <div className="max-h-64 overflow-y-auto">
                        <div className="py-1">
                          {!selectedWalletId && (
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleWalletSelect(null);
                              }}
                              className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gradient-to-r hover:from-indigo-900/20 hover:to-indigo-800/20 focus:bg-gradient-to-r focus:from-indigo-900/20 focus:to-indigo-800/20 focus:outline-none transition-all duration-150"
                            >
                              Select wallet
                            </button>
                          )}
                          {wallets.map((wallet) => (
                            <button
                              key={wallet.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleWalletSelect(wallet.id);
                              }}
                              className={`w-full text-left px-4 py-3 text-sm transition-all duration-150 focus:outline-none group ${
                                selectedWalletId === wallet.id
                                  ? 'bg-gradient-to-r from-indigo-900/40 to-indigo-800/40 text-indigo-200'
                                  : 'text-gray-100 hover:bg-gradient-to-r hover:from-indigo-900/20 hover:to-indigo-800/20 focus:bg-gradient-to-r focus:from-indigo-900/20 focus:to-indigo-800/20'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">
                                    {wallet.wallet_address.substring(0, 6)}...{wallet.wallet_address.substring(wallet.wallet_address.length - 4)}
                                  </div>
                                  {(wallet.label || wallet.nickname) && (
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      {wallet.label || wallet.nickname}
                                    </div>
                                  )}
                                </div>
                                {selectedWalletId === wallet.id && (
                                  <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Content with adjusted padding to account for fixed header */}
            <div className="container mx-auto px-4 sm:px-6 pt-44 sm:pt-32 md:pt-30 pb-6">
              {children}
            </div>
          </div>
        </main>
      </div>
      
      {/* Notification Toast */}
      <NotificationToast
        message={notificationMessage}
        isVisible={notificationVisible}
        type="success"
        autoDismissMs={3000}
        onDismiss={() => setNotificationVisible(false)}
      />
    </div>
  );
};

export default DashboardLayout; 