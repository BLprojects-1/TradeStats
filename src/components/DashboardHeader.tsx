import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { useDashboardNavigation, DashboardPage } from '../contexts/DashboardNavigationContext';
import { useAddTokenModal } from '../components/layouts/NewDashboardLayout';
import { TrackedWallet } from '../utils/userProfile';
import NotificationToast from './NotificationToast';
import AddWalletModal from './AddWalletModal';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HiPlus,
  HiHome,
  HiClipboardList,
  HiTrendingUp,
  HiClock,
  HiStar,
  HiCheckCircle,
  HiUser,
  HiMenu,
  HiX,
  HiCog,
  HiLogout
} from 'react-icons/hi';

interface DashboardHeaderProps {
  title: string;
  isSidebarCollapsed: boolean;
  isMobile: boolean;
  onToggleMobileSidebar: () => void;
}

interface NavigationItem {
  name: string;
  page: DashboardPage;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: 'main' | 'trading' | 'settings';
}

const useSafeDashboardNavigation = () => {
  const router = useRouter();
  
  try {
    return useDashboardNavigation();
  } catch (error) {
    // Fallback when context is not available
    console.warn('DashboardNavigationProvider not available, using fallback navigation');
    
    return {
      currentPage: 'dashboard' as DashboardPage,
      navigateToPage: (page: DashboardPage) => {
        const pageMap: Record<DashboardPage, string> = {
          'dashboard': '/dashboard',
          'open-trades': '/dashboard/open-trades',
          'top-trades': '/dashboard/top-trades',
          'trading-history': '/dashboard/trading-history',
          'trade-log': '/dashboard/trade-log',
          'checklist': '/checklist',
          'account': '/dashboard/account'
        };
        router.push(pageMap[page] || '/dashboard');
      },
      isTransitioning: false,
      navigationItems: [],
      getPageFromPath: (path: string) => 'dashboard' as DashboardPage,
      getPathFromPage: (page: DashboardPage) => '/dashboard'
    };
  }
};

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  isSidebarCollapsed,
  isMobile,
  onToggleMobileSidebar
}) => {
  const { user, signOut } = useAuth();
  const { wallets, selectedWalletId, setSelectedWalletId } = useWalletSelection();
  const { currentPage, navigateToPage, isTransitioning } = useSafeDashboardNavigation();
  const { openAddTokenModal } = useAddTokenModal();
  const router = useRouter();

  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [notificationVisible, setNotificationVisible] = useState<boolean>(false);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [showAddWalletModal, setShowAddWalletModal] = useState<boolean>(false);
  const [showCopied, setShowCopied] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const walletButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const handleAddTokenClick = () => {
    setMobileMenuOpen(false);
    openAddTokenModal();
  };

  const handleCopyCA = () => {
    const contractAddress = '4Hcm1TfA1MvVhCQHvJCcKL7ymUhJZAV7P439H5ZHnKRh';
    navigator.clipboard.writeText(contractAddress);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // Navigation items with proper icons
  const navigationItems: NavigationItem[] = [
    { 
      name: 'Dashboard', 
      page: 'dashboard',
      icon: HiHome, 
      description: 'Overview',
      category: 'main' 
    },
    { 
      name: 'Open Trades', 
      page: 'open-trades',
      icon: HiClipboardList, 
      description: 'Active positions',
      category: 'trading' 
    },
    { 
      name: 'Top Trades', 
      page: 'top-trades',
      icon: HiTrendingUp, 
      description: 'Best performers',
      category: 'trading' 
    },
    { 
      name: 'Trading History', 
      page: 'trading-history',
      icon: HiClock, 
      description: 'All trades',
      category: 'trading' 
    },
    { 
      name: 'Trade Log', 
      page: 'trade-log',
      icon: HiStar, 
      description: 'Starred trades',
      category: 'trading' 
    },
    { 
      name: 'Checklist', 
      page: 'checklist',
      icon: HiCheckCircle, 
      description: 'Trade criteria',
      category: 'settings' 
    },
    { 
      name: 'Account', 
      page: 'account',
      icon: HiUser, 
      description: 'Settings',
      category: 'settings' 
    }
  ];

  const handleNavigationClick = (page: DashboardPage) => {
    setMobileMenuOpen(false);
    navigateToPage(page);
  };

  const handleAvatarClick = () => setDropdownOpen((open) => !open);
  const handleSignOut = () => {
    signOut();
    setDropdownOpen(false);
  };
  const handleAccountSettings = () => {
    router.push('/dashboard/account');
    setDropdownOpen(false);
  };
  const handleWalletDropdownClick = () => setWalletDropdownOpen((open) => !open);
  const handleWalletSelect = async (walletId: string | null) => {
    await setSelectedWalletId(walletId);
    setWalletDropdownOpen(false);
    
    if (walletId) {
      const wallet = wallets.find(w => w.id === walletId);
      if (wallet) {
        setNotificationMessage(`Switched to wallet ${wallet.wallet_address.substring(0, 6)}...${wallet.wallet_address.substring(wallet.wallet_address.length - 4)}`);
        setNotificationVisible(true);
      }
    }
  };
  const handleAddWallet = () => setShowAddWalletModal(true);
  const handleCloseAddWalletModal = () => setShowAddWalletModal(false);
  const handleWalletAdded = async (newWallet: TrackedWallet) => {
    setShowAddWalletModal(false);
    setNotificationMessage('Wallet added successfully!');
    setNotificationVisible(true);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (walletDropdownOpen && walletDropdownRef.current && !walletDropdownRef.current.contains(e.target as Node) && walletButtonRef.current && !walletButtonRef.current.contains(e.target as Node)) {
        setWalletDropdownOpen(false);
      }
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen, walletDropdownOpen, mobileMenuOpen]);

  return (
    <>
      {/* Ultra-Professional Header */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900/98 via-slate-950/96 to-emerald-950/98 backdrop-blur-2xl border-b border-emerald-400/30 shadow-2xl shadow-emerald-900/20"
      >
        {/* Main Navigation Bar */}
        <div className="relative z-10 flex items-center justify-between h-20 px-6 lg:px-8">
          
          {/* Left: Professional Logo */}
          <motion.div 
            className="flex items-center"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <Link href="/dashboard" className="flex items-center group">
              <div className="relative">
                <Image 
                  src="/logo.png" 
                  alt="TradeStats Logo" 
                  width={160} 
                  height={40}
                  className="h-12 w-auto transition-all duration-300 group-hover:scale-105"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
              </div>
            </Link>
          </motion.div>

          {/* Center: Advanced Navigation */}
          <nav className="hidden xl:flex items-center gap-2">
            {/* Premium Add Token Button */}
            <motion.button
              onClick={handleAddTokenClick}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-400/50 text-emerald-100 hover:from-emerald-500/40 hover:to-teal-500/40 hover:border-emerald-300/70 transition-all duration-300 shadow-xl shadow-emerald-900/30 hover:shadow-2xl hover:shadow-emerald-500/40 mr-4"
            >
              <motion.div
                animate={{ rotate: [0, 90, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <HiPlus className="w-5 h-5" />
              </motion.div>
              <span className="font-semibold">Add Token</span>
            </motion.button>

            {/* Premium Navigation Items */}
            {navigationItems.map((item, index) => {
              const isActive = currentPage === item.page;
              const IconComponent = item.icon;
              
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                >
                  <button
                    onClick={() => handleNavigationClick(item.page)}
                    className={`group relative flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-500/50 to-teal-500/50 text-white shadow-2xl shadow-emerald-500/40 border border-emerald-300/60'
                        : 'text-gray-300 hover:text-white hover:bg-emerald-500/20 border border-transparent hover:border-emerald-400/40 hover:shadow-xl hover:shadow-emerald-500/20'
                    }`}
                  >
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.2 }}
                    >
                      <IconComponent className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-emerald-200' : ''}`} />
                    </motion.div>
                    <span className="font-medium text-sm">{item.name}</span>
                    
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div 
                        layoutId="activeTab"
                        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </nav>

          {/* Right: Premium Controls */}
          <div className="flex items-center gap-4">
            
            {/* Premium Social Links */}
            <div className="hidden 2xl:flex items-center gap-3 mr-4">
              {[
                { href: "https://x.com/Tradestatsxyz", icon: "X", label: "Follow us on X" },
                { href: "#", icon: "CA", label: "Copy Contract Address", onClick: handleCopyCA }
              ].map((social, index) => (
                <motion.a
                  key={social.icon}
                  href={social.href}
                  onClick={social.onClick}
                  target={social.href !== "#" ? "_blank" : undefined}
                  rel={social.href !== "#" ? "noopener noreferrer" : undefined}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative w-11 h-11 bg-gradient-to-br from-emerald-600/80 to-teal-600/80 rounded-xl flex items-center justify-center shadow-xl shadow-emerald-900/30 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-400/40 border border-emerald-500/40 hover:border-emerald-400 group"
                  aria-label={social.label}
                >
                  {social.icon === "X" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  )}
                  {social.icon === "CA" && (
                    <span className="text-white text-xs font-bold">CA</span>
                  )}
                  
                  {/* Copied indicator */}
                  {social.icon === "CA" && showCopied && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap shadow-xl"
                    >
                      Copied!
                    </motion.div>
                  )}
                </motion.a>
              ))}
            </div>

            {/* Premium Wallet Selector */}
            <div className="relative" ref={walletDropdownRef}>
              <motion.button
                ref={walletButtonRef}
                onClick={handleWalletDropdownClick}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group flex items-center gap-3 bg-gradient-to-r from-emerald-900/60 to-teal-900/60 border border-emerald-400/50 hover:border-emerald-300/70 rounded-2xl px-4 py-3 transition-all duration-300 shadow-xl shadow-emerald-900/20 hover:shadow-2xl hover:shadow-emerald-500/30 backdrop-blur-xl"
                aria-label="Select wallet"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="text-left min-w-0 hidden sm:block">
                  <div className="text-sm font-semibold text-gray-100 group-hover:text-white transition-colors duration-200 truncate max-w-[100px]">
                    {selectedWalletId 
                      ? (() => {
                          const wallet = wallets.find(w => w.id === selectedWalletId);
                          if (!wallet) return 'Select';
                          return `${wallet.wallet_address.substring(0, 4)}...${wallet.wallet_address.substring(wallet.wallet_address.length - 4)}`;
                        })()
                      : 'Select'
                    }
                  </div>
                </div>
                <motion.svg 
                  animate={{ rotate: walletDropdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-4 h-4 text-emerald-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </motion.svg>
              </motion.button>

              {/* Premium Wallet Dropdown */}
              <AnimatePresence>
                {walletDropdownOpen && (
                  <motion.div
                    ref={walletDropdownRef}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-3 w-80 bg-gradient-to-br from-slate-900/98 via-emerald-950/95 to-teal-950/98 backdrop-blur-2xl rounded-2xl shadow-2xl border border-emerald-500/40 overflow-hidden z-50"
                  >
                    <div className="max-h-80 overflow-y-auto">
                      <div className="p-2">
                        {wallets.length === 0 ? (
                          <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                              <HiPlus className="w-8 h-8 text-emerald-400" />
                            </div>
                            <p className="text-gray-400 text-sm mb-4">No wallets added yet</p>
                            <motion.button
                              onClick={handleAddWallet}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg"
                            >
                              Add Your First Wallet
                            </motion.button>
                          </div>
                        ) : (
                          <>
                            {wallets.map((wallet, index) => (
                              <motion.button
                                key={wallet.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleWalletSelect(wallet.id);
                                }}
                                className={`w-full text-left p-4 text-sm transition-all duration-200 focus:outline-none group rounded-xl m-1 ${
                                  selectedWalletId === wallet.id
                                    ? 'bg-gradient-to-r from-emerald-600/30 to-teal-600/30 text-white border border-emerald-400/50'
                                    : 'text-gray-100 hover:bg-emerald-500/10 focus:bg-emerald-500/10 border border-transparent hover:border-emerald-400/30'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${selectedWalletId === wallet.id ? 'bg-emerald-400' : 'bg-gray-500 group-hover:bg-emerald-400/70'} transition-all duration-200`}></div>
                                    <div>
                                      <div className="font-semibold">
                                        {wallet.wallet_address.substring(0, 8)}...{wallet.wallet_address.substring(wallet.wallet_address.length - 6)}
                                      </div>
                                      {(wallet.label || wallet.nickname) && (
                                        <div className="text-xs text-gray-400 mt-1">
                                          {wallet.label || wallet.nickname}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {selectedWalletId === wallet.id && (
                                    <motion.svg
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="w-5 h-5 text-emerald-400"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </motion.svg>
                                  )}
                                </div>
                              </motion.button>
                            ))}
                            <div className="border-t border-emerald-500/30 p-3">
                              <motion.button
                                onClick={handleAddWallet}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 text-emerald-200 px-4 py-3 rounded-xl font-semibold transition-all duration-300 border border-emerald-400/30 hover:border-emerald-300/50"
                              >
                                + Add Another Wallet
                              </motion.button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Premium User Avatar */}
            <div className="relative">
              <motion.button
                ref={avatarRef}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative h-12 w-12 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-300 shadow-xl shadow-emerald-900/30 border border-emerald-500/40 hover:border-emerald-400"
                onClick={handleAvatarClick}
                aria-label="User menu"
              >
                <span className="relative z-10 text-sm drop-shadow-sm font-bold">
                  {user?.email ? user.email[0].toUpperCase() : 'U'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </motion.button>
              
              {/* Premium User Dropdown */}
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-3 w-64 bg-gradient-to-br from-slate-900/98 via-emerald-950/95 to-teal-950/98 backdrop-blur-2xl rounded-2xl shadow-2xl border border-emerald-500/40 overflow-hidden z-50"
                  >
                    <div className="p-4 bg-gradient-to-r from-emerald-600/10 to-teal-600/10 border-b border-emerald-500/30">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold shadow-lg">
                          {user?.email ? user.email[0].toUpperCase() : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-200 truncate">{user?.email}</div>
                          <div className="text-xs text-emerald-300/80">TradeStats Account</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-100 hover:bg-emerald-500/10 focus:bg-emerald-500/10 focus:outline-none transition-all duration-200 flex items-center gap-3 group rounded-xl"
                        onClick={handleAccountSettings}
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors duration-200 border border-emerald-400/30">
                          <HiCog className="h-4 w-4" />
                        </div>
                        <span className="font-medium">Settings</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 focus:bg-red-900/20 focus:outline-none transition-all duration-200 flex items-center gap-3 group rounded-xl"
                        onClick={handleSignOut}
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors duration-200 border border-red-400/30">
                          <HiLogout className="h-4 w-4" />
                        </div>
                        <span className="font-medium">Sign out</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group p-3 rounded-2xl hover:bg-emerald-600/20 text-gray-300 hover:text-white transition-all duration-200 xl:hidden focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-transparent hover:border-emerald-500/30"
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {mobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <HiX className="h-6 w-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <HiMenu className="h-6 w-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Premium Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              ref={mobileMenuRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="xl:hidden bg-gradient-to-b from-slate-900/98 via-emerald-950/95 to-teal-950/98 backdrop-blur-2xl border-t border-emerald-500/40"
            >
              <div className="px-6 py-6 space-y-3">
                {/* Add Token Button */}
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  onClick={handleAddTokenClick}
                  className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-400/50 text-emerald-200 hover:from-emerald-500/40 hover:to-teal-500/40 transition-all duration-300 shadow-xl"
                >
                  <HiPlus className="w-6 h-6" />
                  <span className="font-semibold text-lg">Add Token</span>
                </motion.button>

                {/* Navigation Items */}
                {navigationItems.map((item, index) => {
                  const isActive = currentPage === item.page;
                  const IconComponent = item.icon;
                  
                  return (
                    <motion.button
                      key={item.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (index + 2) * 0.05 }}
                      onClick={() => handleNavigationClick(item.page)}
                      className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-500/50 to-teal-500/50 text-white border border-emerald-300/60 shadow-xl'
                          : 'text-gray-300 hover:text-white hover:bg-emerald-500/20 border border-transparent hover:border-emerald-400/40'
                      }`}
                    >
                      <IconComponent className="w-6 h-6" />
                      <span className="font-medium text-lg">{item.name}</span>
                    </motion.button>
                  );
                })}

                {/* Social Links */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="pt-6 border-t border-emerald-500/30"
                >
                  <div className="flex items-center justify-center gap-6">
                    {[
                      { href: "https://x.com/Tradestatsxyz", icon: "X" },
                      { href: "#", icon: "CA", onClick: handleCopyCA }
                    ].map((social) => (
                      <motion.a
                        key={social.icon}
                        href={social.href}
                        onClick={social.onClick}
                        target={social.href !== "#" ? "_blank" : undefined}
                        rel={social.href !== "#" ? "noopener noreferrer" : undefined}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 hover:shadow-2xl"
                      >
                        {social.icon === "X" && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        )}
                        {social.icon === "CA" && (
                          <span className="text-white text-sm font-bold">CA</span>
                        )}
                      </motion.a>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Add Wallet Modal */}
      {showAddWalletModal && user && (
        <AddWalletModal
          userId={user.id}
          onClose={handleCloseAddWalletModal}
          onSuccess={handleWalletAdded}
        />
      )}

      {/* Notification Toast */}
      <NotificationToast
        message={notificationMessage}
        isVisible={notificationVisible}
        type="success"
        autoDismissMs={3000}
        onDismiss={() => setNotificationVisible(false)}
      />
    </>
  );
};

export default DashboardHeader; 