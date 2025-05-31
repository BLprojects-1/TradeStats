import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { 
  HiChevronDoubleLeft, 
  HiChevronDoubleRight, 
  HiX,
  HiHome,
  HiClipboardList,
  HiTrendingUp,
  HiClock,
  HiStar,
  HiCheckCircle,
  HiUser
} from 'react-icons/hi';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface DashboardSidebarProps {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  isMobile: boolean;
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  isSidebarCollapsed,
  isMobileSidebarOpen,
  isMobile,
  onToggleSidebar,
  onToggleMobileSidebar
}) => {
  const router = useRouter();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const navigationItems: NavigationItem[] = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: HiHome,
      description: 'Overview & performance'
    },
    { 
      name: 'Open Trades', 
      href: '/dashboard/open-trades', 
      icon: HiClipboardList,
      description: 'Current positions'
    },
    { 
      name: 'Top Trades', 
      href: '/dashboard/top-trades', 
      icon: HiTrendingUp,
      description: 'Best performing trades'
    },
    { 
      name: 'Trading History', 
      href: '/dashboard/trading-history', 
      icon: HiClock,
      description: 'Complete trade history'
    },
    { 
      name: 'Trade Log', 
      href: '/dashboard/trade-log', 
      icon: HiStar,
      description: 'Starred trades'
    },
    { 
      name: 'Trade Checklist', 
      href: '/dashboard/trade-checklist', 
      icon: HiCheckCircle,
      description: 'Trading criteria'
    },
    { 
      name: 'Account', 
      href: '/dashboard/account', 
      icon: HiUser,
      description: 'Profile, Wallet & settings'
    }
  ];

  // Close mobile sidebar on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onToggleMobileSidebar();
      }
    };

    if (isMobileSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileSidebarOpen, onToggleMobileSidebar]);

  // Close mobile sidebar on route change
  useEffect(() => {
    const handleRouteChange = () => {
      if (isMobileSidebarOpen) {
        onToggleMobileSidebar();
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events, isMobileSidebarOpen, onToggleMobileSidebar]);

  const handleCopyCA = () => {
    // When we have the actual address, uncomment this
    // navigator.clipboard.writeText(contractAddress);
  };

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm transition-opacity duration-300" 
          onClick={onToggleMobileSidebar} 
        />
      )}

      {/* Sidebar - Professional Design */}
      <aside 
        ref={sidebarRef}
        className={`fixed md:relative h-full transition-all duration-300 ease-in-out z-40
          ${isSidebarCollapsed ? 'md:w-20' : 'md:w-72'} 
          ${isMobileSidebarOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full md:translate-x-0'} 
          flex flex-col`}
      >
        {/* Background Layer */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border-r border-indigo-500/40 shadow-xl shadow-indigo-900/10">
          </div>
        </div>
        
        {/* Content Layer */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo Section */}
          <div className={`relative overflow-hidden transition-all duration-300 border-b border-indigo-500/30 ${
            isSidebarCollapsed ? 'px-3 py-6' : 'px-6 py-6'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-1">
                {/* Logo - Hide in collapsed state */}
                {!isSidebarCollapsed && (
                  <div className="relative group flex-1">
                    <div className="transition-all duration-300 ease-out">
                      <Image 
                        src="/logo.png" 
                        alt="Ryvu Logo" 
                        width={140} 
                        height={36}
                        className="h-9 w-auto transition-all duration-300 ease-out transform-gpu"
                        priority
                        style={{ 
                          imageRendering: 'crisp-edges',
                          backfaceVisibility: 'hidden',
                          transform: 'translate3d(0, 0, 0)',
                          willChange: 'transform'
                        }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Collapsed State Logo Alternative - Centered Icon */}
                {isSidebarCollapsed && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg border border-indigo-400/50">
                      <span className="text-white font-bold text-sm">R</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Toggle Buttons */}
              <div className="flex items-center gap-2 ml-4">
                {/* Desktop Toggle */}
                <button
                  onClick={onToggleSidebar}
                  className={`group relative w-10 h-10 rounded-xl hover:bg-gradient-to-r hover:from-indigo-500/20 hover:to-purple-500/20 
                             text-gray-400 hover:text-indigo-300 transition-all duration-300 ease-out hidden md:flex items-center justify-center
                             hover:shadow-lg hover:shadow-indigo-500/10 border border-transparent hover:border-indigo-500/30
                             focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 focus:ring-offset-[#1a1a2e]
                             ${isSidebarCollapsed ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-500/20' : ''}`}
                  aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <div className="relative overflow-hidden">
                    <HiChevronDoubleLeft
                      className={`h-5 w-5 transform transition-all duration-300 ease-out group-hover:scale-110
                                 ${isSidebarCollapsed ? 'opacity-0 -translate-x-2 rotate-180' : 'opacity-100 translate-x-0 rotate-0'}`}
                    />
                    <HiChevronDoubleRight
                      className={`h-5 w-5 transform transition-all duration-300 ease-out group-hover:scale-110 absolute inset-0
                                 ${isSidebarCollapsed ? 'opacity-100 translate-x-0 rotate-0' : 'opacity-0 translate-x-2 rotate-180'}`}
                    />
                  </div>
                </button>
                
                {/* Mobile Close */}
                <button
                  onClick={onToggleMobileSidebar}
                  className="group w-10 h-10 rounded-xl hover:bg-gradient-to-r hover:from-red-500/20 hover:to-pink-500/20 
                             text-gray-400 hover:text-red-300 transition-all duration-300 ease-out md:hidden flex items-center justify-center
                             hover:shadow-lg hover:shadow-red-500/10 border border-transparent hover:border-red-500/30
                             focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 focus:ring-offset-[#1a1a2e]"
                  aria-label="Close sidebar"
                >
                  <HiX className="h-5 w-5 transform transition-all duration-300 ease-out group-hover:scale-110 group-hover:rotate-90" />
                </button>
              </div>
            </div>
          </div>

          {/* Navigation - Professional Design */}
          <nav className={`flex-1 overflow-y-auto transition-all duration-300 ${
            isSidebarCollapsed ? 'py-4 px-2' : 'py-6 px-4'
          }`}>
            <div className={`space-y-2 ${isSidebarCollapsed ? 'space-y-3' : ''}`}>
              {navigationItems.map((item, index) => {
                const isActive = router.pathname === item.href;
                const IconComponent = item.icon;
                
                return (
                  <div key={item.name} className="relative group">
                    <Link
                      href={item.href}
                      className={`flex items-center transition-all duration-300 relative overflow-hidden group/link
                        ${isSidebarCollapsed 
                          ? 'w-14 h-14 rounded-2xl justify-center mx-auto flex-shrink-0' 
                          : 'px-4 py-4 rounded-2xl justify-start'
                        }
                        ${isActive
                          ? isSidebarCollapsed 
                            ? 'bg-gradient-to-br from-indigo-600/60 to-purple-600/60 text-white border-2 border-indigo-400/80 shadow-2xl shadow-indigo-500/50'
                            : 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 text-white border border-indigo-400/50 shadow-xl shadow-indigo-900/20'
                          : isSidebarCollapsed
                            ? 'text-gray-300 hover:text-white hover:bg-gradient-to-br hover:from-indigo-500/20 hover:to-purple-500/20 border-2 border-transparent hover:border-indigo-400/60 hover:shadow-xl hover:shadow-indigo-500/30'
                            : 'text-gray-300 hover:text-white hover:bg-indigo-500/10 border border-transparent hover:border-indigo-400/40 hover:shadow-lg shadow-indigo-900/10'
                        }
                        focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#1a1a2e]
                      `}
                    >
                      {/* Active Indicator for Expanded State */}
                      {isActive && !isSidebarCollapsed && (
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1.5 h-10 bg-gradient-to-b from-indigo-400 to-purple-400 rounded-r-full shadow-lg shadow-indigo-400/40"></div>
                      )}
                      
                      {/* Icon Container - Perfect Symmetry */}
                      <div className={`relative transition-all duration-300 flex-shrink-0 flex items-center justify-center
                        ${isSidebarCollapsed ? 'w-full h-full' : 'w-6 h-6'}
                        ${isActive 
                          ? 'text-white' 
                          : 'text-gray-400 group-hover/link:text-indigo-300'
                        }`}>
                        {/* Enhanced Active Glow for Collapsed State */}
                        {isActive && isSidebarCollapsed && (
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/30 to-purple-400/30 rounded-xl blur-lg"></div>
                        )}
                        {/* Standard Active Glow for Expanded State */}
                        {isActive && !isSidebarCollapsed && (
                          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-lg blur-sm"></div>
                        )}
                        
                        <IconComponent className={`transition-all duration-300 ease-out relative z-10 flex-shrink-0
                                                   ${isSidebarCollapsed ? 'w-7 h-7' : 'w-6 h-6'}
                                                   ${isActive 
                                                     ? isSidebarCollapsed 
                                                       ? 'scale-105 drop-shadow-2xl filter brightness-110' 
                                                       : 'scale-110 drop-shadow-lg' 
                                                     : 'group-hover/link:scale-110'
                                                   }`} />
                      </div>
                      
                      {/* Text Content - Smooth Transitions */}
                      <div className={`ml-4 flex-1 min-w-0 transition-all duration-300 overflow-hidden ${
                        isSidebarCollapsed && !isMobileSidebarOpen 
                          ? 'opacity-0 w-0 ml-0' 
                          : 'opacity-100 w-auto'
                      }`}>
                        <div className={`font-bold text-sm tracking-wide transition-all duration-300 whitespace-nowrap ${
                          isActive ? 'text-white' : 'text-gray-200 group-hover/link:text-white'
                        }`}>
                          {item.name}
                        </div>
                        <div className={`text-xs mt-1 transition-all duration-300 whitespace-nowrap ${
                          isActive ? 'text-indigo-100/90' : 'text-gray-500 group-hover/link:text-gray-400'
                        }`}>
                          {item.description}
                        </div>
                      </div>
                    </Link>

                    {/* Professional Tooltip for Collapsed State */}
                    {isSidebarCollapsed && !isMobileSidebarOpen && (
                      <div className="absolute left-full ml-4 top-1/2 transform -translate-y-1/2 px-4 py-3 
                                     bg-gradient-to-br from-[#1a1a2e]/98 to-[#1a1a28]/98 backdrop-blur-xl 
                                     text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 
                                     transition-all duration-300 pointer-events-none whitespace-nowrap 
                                     border border-indigo-500/50 shadow-2xl shadow-indigo-500/25 z-50
                                     transform-gpu scale-95 group-hover:scale-100">
                        <div className={`font-bold ${isActive ? 'text-indigo-200' : 'text-white'}`}>{item.name}</div>
                        <div className="text-xs text-gray-300 mt-1">{item.description}</div>
                        {/* Professional Arrow */}
                        <div className="absolute right-full top-1/2 transform -translate-y-1/2 
                                       border-[6px] border-transparent border-r-[#1a1a2e] 
                                       drop-shadow-lg"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Footer Section */}
          <div className="relative border-t border-indigo-500/30">
            {/* Social Links - Perfect Alignment */}
            <div className={`flex items-center justify-center transition-all duration-300 ${
              isSidebarCollapsed ? 'flex-col space-y-3 py-6' : 'flex-row space-x-4 py-5'
            }`}>
              <a 
                href="https://x.com/Ryvujournal" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`group bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-indigo-400/30 border border-indigo-500/40 hover:border-indigo-400
                  ${isSidebarCollapsed ? 'w-12 h-12' : 'w-11 h-11'}`}
                aria-label="Follow us on X (Twitter)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white group-hover:scale-110 transition-transform duration-200">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              
              <a 
                href="https://discord.gg/6q7UrFsy" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`group bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-indigo-400/30 border border-indigo-500/40 hover:border-indigo-400
                  ${isSidebarCollapsed ? 'w-12 h-12' : 'w-11 h-11'}`}
                aria-label="Join our Discord server"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white group-hover:scale-110 transition-transform duration-200">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              
              <button 
                onClick={handleCopyCA}
                className={`group relative bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-indigo-400/30 border border-indigo-500/40 hover:border-indigo-400
                  ${isSidebarCollapsed ? 'w-12 h-12' : 'w-11 h-11'}`}
                aria-label="Copy Contract Address"
              >
                <span className="text-white text-sm font-bold group-hover:scale-110 transition-transform duration-200">CA</span>
              </button>
            </div>
            
            {/* Disclaimer - Smooth Visibility */}
            <div className={`text-center transition-all duration-300 overflow-hidden ${
              isSidebarCollapsed && !isMobileSidebarOpen 
                ? 'opacity-0 h-0 pb-0' 
                : 'opacity-100 h-auto pb-5'
            }`}>
              <p className="text-xs text-gray-400 leading-relaxed px-3 font-medium">
                Not financial advice. Some data may be inaccurate.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar; 