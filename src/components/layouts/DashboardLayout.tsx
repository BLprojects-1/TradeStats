import React, { ReactNode, useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { TrackedWallet } from '../../utils/userProfile';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import NotificationToast from '../NotificationToast';
import AddTokenModal from '../AddTokenModal';
import { 
  HiChevronDoubleLeft, 
  HiChevronDoubleRight, 
  HiX,
  HiPlus,
  HiHome,
  HiClipboardList,
  HiTrendingUp,
  HiClock,
  HiStar,
  HiCheckCircle,
  HiUser
} from 'react-icons/hi';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  wallets?: TrackedWallet[];
  selectedWalletId?: string | null;
  onWalletChange?: (walletId: string | null) => void;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isAction?: boolean;
  isComingSoon?: boolean;
  onClick?: () => void;
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
  const [isMobile, setIsMobile] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [isAddTokenModalOpen, setIsAddTokenModalOpen] = useState(false);
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
  const handleWalletSelect = async (walletId: string | null) => {
    // Update the context first
    await contextSetSelectedWalletId(walletId);
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
    const contractAddress = 'EWnHE6JuF1nrih1xZNJBSd6977swuEquuyyrTuLQpump';
    navigator.clipboard.writeText(contractAddress);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleAddTokenClick = () => {
    setIsAddTokenModalOpen(true);
    // Close mobile sidebar if open
    setIsMobileSidebarOpen(false);
  };

  const handleAddToken = (contractAddress: string) => {
    // This is where the user will implement their token scanning logic
    console.log('Add token with CA:', contractAddress);
    // You can add your token scanning implementation here
  };

  const navigationItems: NavigationItem[] = [
    { 
      name: 'Add Token', 
      href: '#', 
      icon: HiPlus, 
      isAction: true, 
      onClick: handleAddTokenClick 
    },
    { name: 'Dashboard', href: '/dashboard', icon: HiHome },
    { name: 'Open Trades', href: '/dashboard/open-trades', icon: HiClipboardList },
    { name: 'Top Trades', href: '/dashboard/top-trades', icon: HiTrendingUp },
    { name: 'Trading History', href: '/dashboard/trading-history', icon: HiClock },
    { name: 'Trade Log', href: '/dashboard/trade-log', icon: HiStar },
    { name: 'Trade Checklist', href: '/dashboard/trade-checklist', icon: HiCheckCircle },
    { name: 'Account', href: '/dashboard/account', icon: HiUser }
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
  const handleWalletChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newWalletId = e.target.value || null;
    
    // Update the context
    await contextSetSelectedWalletId(newWalletId);
    
    // Also call the prop handler for backward compatibility
    if (onWalletChange) {
      onWalletChange(newWalletId);
    }
  };

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize(); // Set initial value
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-black">
      <Head>
        <title>{title} | ryvu</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.png" />
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
            ${isMobileSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0'} 
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
            {/* Enhanced Collapse Toggle Button */}
            <button
              onClick={toggleSidebar}
              className={`group relative p-2.5 rounded-xl hover:bg-gradient-to-r hover:from-indigo-500/20 hover:to-purple-500/20 
                         text-gray-400 hover:text-indigo-300 transition-all duration-300 ease-out ml-2 hidden md:block
                         hover:shadow-lg hover:shadow-indigo-500/10 border border-transparent hover:border-indigo-500/30
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 focus:ring-offset-[#1a1a1a]
                         ${isSidebarCollapsed ? 'bg-indigo-500/10 border-indigo-500/30' : ''}`}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <div className="relative overflow-hidden">
                {/* Collapse Icon */}
                <HiChevronDoubleLeft
                  className={`h-5 w-5 transform transition-all duration-300 ease-out group-hover:scale-110
                             ${isSidebarCollapsed ? 'opacity-0 -translate-x-2 rotate-180' : 'opacity-100 translate-x-0 rotate-0'}`}
                />
                {/* Expand Icon */}
                <HiChevronDoubleRight
                  className={`h-5 w-5 transform transition-all duration-300 ease-out group-hover:scale-110 absolute inset-0
                             ${isSidebarCollapsed ? 'opacity-100 translate-x-0 rotate-0' : 'opacity-0 translate-x-2 rotate-180'}`}
                />
              </div>
              
              {/* Animated Background Indicator */}
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 
                              transform transition-all duration-300 ease-out -z-10
                              ${isSidebarCollapsed ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} />
            </button>
            
            {/* Mobile Close Button */}
            <button
              onClick={toggleMobileSidebar}
              className="group p-2.5 rounded-xl hover:bg-gradient-to-r hover:from-red-500/20 hover:to-pink-500/20 
                         text-gray-400 hover:text-red-300 transition-all duration-300 ease-out ml-2 md:hidden
                         hover:shadow-lg hover:shadow-red-500/10 border border-transparent hover:border-red-500/30
                         focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 focus:ring-offset-[#1a1a1a]"
              aria-label="Close sidebar"
            >
              <HiX className="h-5 w-5 transform transition-all duration-300 ease-out group-hover:scale-110 group-hover:rotate-90" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-2 px-2">
              {navigationItems.map((item) => {
                const isActive = router.pathname === item.href && !item.isAction;
                const isActionItem = item.isAction;
                const IconComponent = item.icon;
                
                return (
                  <li key={item.name}>
                    {isActionItem ? (
                      // Action item (like Add Token) - button with special styling
                      <button
                        onClick={item.onClick}
                        className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-300 group
                                   text-purple-300 hover:bg-gradient-to-r hover:from-purple-900/20 hover:to-indigo-800/20 
                                   hover:text-purple-100 border border-transparent hover:border-purple-500/30
                                   hover:shadow-lg hover:shadow-purple-500/10 focus:outline-none focus:ring-2 
                                   focus:ring-purple-400 focus:ring-offset-1 focus:ring-offset-[#1a1a1a]`}
                      >
                        <div className="relative">
                          <IconComponent className="h-5 w-5 group-hover:scale-110 transition-transform duration-300 ease-out" />
                          {/* Small indicator dot to show it's an action */}
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full opacity-80 animate-pulse"></div>
                        </div>
                        {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium ml-3 truncate transition-all duration-300" style={{ 
                              width: isSidebarCollapsed ? '0' : 'auto',
                              opacity: isSidebarCollapsed ? '0' : '1',
                              visibility: isSidebarCollapsed ? 'hidden' : 'visible'
                            }}>{item.name}</span>
                            {item.isComingSoon && (
                              <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full transition-all duration-300" style={{
                                opacity: isSidebarCollapsed ? '0' : '1',
                                visibility: isSidebarCollapsed ? 'hidden' : 'visible'
                              }}>Coming Soon</span>
                            )}
                          </div>
                        )}
                        
                        {/* Tooltip for collapsed state */}
                        {isSidebarCollapsed && !isMobileSidebarOpen && (
                          <div className="absolute left-full ml-6 top-1/2 transform -translate-y-1/2 px-3 py-2 
                                         bg-gradient-to-br from-purple-600/95 to-indigo-600/95 backdrop-blur-xl 
                                         text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 
                                         transition-all duration-300 pointer-events-none whitespace-nowrap 
                                         border border-purple-500/40 shadow-2xl z-50">
                            {item.name}
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2 
                                           border-4 border-transparent border-r-[#1a1a2e]"></div>
                          </div>
                        )}
                      </button>
                    ) : (
                      // Regular navigation item - Link with enhanced styling
                      <div className="relative group">
                        <Link
                          href={item.href}
                          className={`flex items-center px-4 py-3 rounded-xl transition-all duration-300 
                                     relative overflow-hidden ${
                            isActive
                              ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 text-white border border-indigo-400/50 shadow-xl shadow-indigo-900/20'
                              : 'text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 border border-transparent hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10'
                          } focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 focus:ring-offset-[#1a1a1a]`}
                        >
                          {/* Active indicator */}
                          {isActive && (
                            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 
                                           bg-gradient-to-b from-indigo-400 to-purple-400 rounded-r-full 
                                           shadow-lg shadow-indigo-400/40"></div>
                          )}
                          
                          <IconComponent className={`h-5 w-5 flex-shrink-0 transition-all duration-300 ease-out
                                                     ${isActive ? 'text-indigo-200 scale-110' : 'text-gray-400 group-hover:text-indigo-300 group-hover:scale-110'}`} />
                          
                          {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                            <span className="ml-3 truncate font-medium transition-all duration-300" style={{ 
                              width: isSidebarCollapsed ? '0' : 'auto',
                              opacity: isSidebarCollapsed ? '0' : '1',
                              visibility: isSidebarCollapsed ? 'hidden' : 'visible',
                              whiteSpace: 'nowrap'
                            }}>{item.name}</span>
                          )}
                          
                          {/* Hover effect overlay */}
                          <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 
                                          opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
                                          ${isActive ? 'opacity-100' : ''}`}></div>
                        </Link>
                        
                        {/* Tooltip for collapsed state */}
                        {isSidebarCollapsed && !isMobileSidebarOpen && (
                          <div className="absolute left-full ml-6 top-1/2 transform -translate-y-1/2 px-3 py-2 
                                         bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl 
                                         text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 
                                         transition-all duration-300 pointer-events-none whitespace-nowrap 
                                         border border-indigo-500/40 shadow-2xl z-50">
                            {item.name}
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2 
                                           border-4 border-transparent border-r-[#1a1a2e]"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Social Links */}
          <div className="p-4 border-t border-gray-800">
            <div className={`flex items-center justify-center ${isSidebarCollapsed ? 'flex-col space-y-3' : 'space-x-3'} transition-all duration-300 ease-in-out`}>
              <a 
                href="https://x.com/Ryvujournal" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-lg ${isSidebarCollapsed ? 'hover:translate-x-1' : ''}`}
                aria-label="Follow us on X (Twitter)"
                style={{ transitionProperty: 'all' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white transition-transform duration-300">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a 
                href="https://t.me/+Jq_SuZsXYlI3NWNk" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-lg ${isSidebarCollapsed ? 'hover:translate-x-1' : ''}`}
                aria-label="Join our Telegram channel"
                style={{ transitionProperty: 'all' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white transition-transform duration-300">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
              <a 
                href="https://discord.gg/6q7UrFsy" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-lg ${isSidebarCollapsed ? 'hover:translate-x-1' : ''}`}
                aria-label="Join our Discord server"
                style={{ transitionProperty: 'all' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white transition-transform duration-300">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <button 
                onClick={handleCopyCA}
                className={`w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-lg relative group ${isSidebarCollapsed ? 'hover:translate-x-1' : ''}`}
                aria-label="Copy Contract Address"
                style={{ transitionProperty: 'all' }}
              >
                <span className="text-white text-sm font-medium">CA</span>
                {showCopied && (
                  <span className={`absolute ${isSidebarCollapsed ? 'left-full ml-2 -translate-x-0' : '-top-8 left-1/2 -translate-x-1/2'} bg-white text-indigo-900 px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-all duration-300`}>
                    Copied!
                  </span>
                )}
              </button>
            </div>
            
            {/* Disclaimer */}
            {(!isSidebarCollapsed || isMobileSidebarOpen) && (
              <div className="mt-4 text-center">
                <p className={`text-[11px] text-gray-500 leading-relaxed transition-all duration-300 px-2 ${
                  isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
                }`}>
                  Not financial advice.
                  <br />
                  Some data may be inaccurate.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-black">
          {/* Fixed header row inside content area */}
          <div className="relative">
            {/* Completely redesigned header */}
            <header 
              className={`fixed top-0 right-0 z-20 transition-all duration-300 ${
                isMobile ? 'left-0 w-full' : 'w-auto'
              }`}
              style={{ 
                left: isMobile ? '0' : (isSidebarCollapsed ? '5rem' : '16rem'),
                right: '0'
              }}
            >
              <div className="bg-[#1a1a1a] border-b border-gray-800 shadow-lg">
                <div className="flex items-center justify-between h-[72px] px-4 sm:px-6 lg:px-9">
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

                    <h1 className="text-lg sm:text-xl lg:text-3xl font-bold tracking-tight truncate">
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
            <div className="container mx-auto px-3 sm:px-4 lg:px-6 pt-48 sm:pt-32 md:pt-26 pb-6">
              {children}
            </div>
          </div>
        </main>
      </div>
      
      {/* Legacy Notification Toast - keeping for backward compatibility */}
      <NotificationToast
        message={notificationMessage}
        isVisible={notificationVisible}
        type="success"
        autoDismissMs={3000}
        onDismiss={() => setNotificationVisible(false)}
      />

      {/* Add Token Modal */}
      <AddTokenModal
        isOpen={isAddTokenModalOpen}
        onClose={() => setIsAddTokenModalOpen(false)}
        onAddToken={handleAddToken}
      />
    </div>
  );
};

export default DashboardLayout; 