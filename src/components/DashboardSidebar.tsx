import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';

interface NavigationItem {
  name: string;
  href: string;
  icon: string;
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
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      description: 'Overview & performance'
    },
    { 
      name: 'Open Trades', 
      href: '/dashboard/open-trades', 
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      description: 'Current positions'
    },
    { 
      name: 'Top Trades', 
      href: '/dashboard/top-trades', 
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      description: 'Best performing trades'
    },
    { 
      name: 'Trading History', 
      href: '/dashboard/trading-history', 
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      description: 'Complete trade history'
    },
    { 
      name: 'Trade Log', 
      href: '/dashboard/trade-log', 
      icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
      description: 'Starred trades'
    },
    { 
      name: 'Trade Checklist', 
      href: '/dashboard/trade-checklist', 
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      description: 'Trading criteria'
    },
    { 
      name: 'Account', 
      href: '/dashboard/account', 
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      description: 'Profile, Walle & settings'
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

      {/* Sidebar - Match dashboard branding */}
      <aside 
        ref={sidebarRef}
        className={`fixed md:relative h-full transition-all duration-300 ease-in-out z-40
          ${isSidebarCollapsed ? 'md:w-20' : 'md:w-72'} 
          ${isMobileSidebarOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full md:translate-x-0'} 
          flex flex-col`}
      >
        {/* Match dashboard background styling */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border-r border-indigo-500/40 shadow-xl shadow-indigo-900/10">
          </div>
        </div>
        
        {/* Content Layer */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo Section - With bottom border separator */}
          <div className={`relative overflow-hidden transition-all duration-300 border-b border-indigo-500/30 ${
            isSidebarCollapsed ? 'px-4 py-6' : 'px-6 py-6'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-1">
                {/* Logo with fixed positioning to prevent blur */}
                <div className="relative group flex-1">
                  <div className="transition-all duration-300 ease-out">
                    <Image 
                      src="/logo.png" 
                      alt="Ryvu Logo" 
                      width={isSidebarCollapsed ? 32 : 140} 
                      height={36}
                      className={`h-9 w-auto transition-all duration-300 ease-out ${
                        isSidebarCollapsed ? 'transform-gpu' : 'transform-gpu'
                      }`}
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
              </div>
              
              {/* Toggle Buttons */}
              <div className="flex items-center gap-2 ml-4">
                {/* Desktop Toggle */}
                <button
                  onClick={onToggleSidebar}
                  className="group p-3 rounded-xl bg-[#252525]/80 hover:bg-[#303030] text-gray-400 hover:text-white transition-all duration-300 hidden md:flex items-center justify-center border border-indigo-500/40 shadow-lg hover:scale-105"
                  aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 transition-all duration-300 group-hover:scale-110"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={isSidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"}
                    />
                  </svg>
                </button>
                
                {/* Mobile Close */}
                <button
                  onClick={onToggleMobileSidebar}
                  className="group p-3 rounded-xl bg-[#252525]/80 hover:bg-red-900/30 text-gray-400 hover:text-red-300 transition-all duration-300 md:hidden flex items-center justify-center border border-indigo-500/40 hover:border-red-400/50 shadow-lg hover:scale-105"
                  aria-label="Close sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 transition-all duration-300 group-hover:scale-110"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Right stroke - same as menu items */}
            <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-indigo-400/30 to-transparent"></div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
            {navigationItems.map((item, index) => {
              const isActive = router.pathname === item.href;
              return (
                <div key={item.name} className="relative group">
                  <Link
                    href={item.href}
                    className={`flex items-center px-4 py-4 rounded-2xl transition-all duration-300 relative overflow-hidden group/link
                      ${isActive
                        ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 text-white border border-indigo-400/50 shadow-xl shadow-indigo-900/20'
                        : 'text-gray-300 hover:text-white hover:bg-indigo-500/10 border border-transparent hover:border-indigo-400/40 hover:shadow-lg shadow-indigo-900/10'
                      }
                      ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}
                    `}
                  >
                    {/* Active Indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-2 h-10 bg-gradient-to-b from-indigo-400 to-purple-400 rounded-r-full shadow-lg shadow-indigo-400/40"></div>
                    )}
                    
                    {/* Icon Container */}
                    <div className={`relative transition-all duration-300 flex-shrink-0 ${isActive ? 'text-indigo-200' : 'text-gray-400 group-hover/link:text-indigo-300'}`}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 transition-all duration-300 group-hover/link:scale-110"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={isActive ? 2.5 : 2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={item.icon}
                        />
                      </svg>
                    </div>
                    
                    {/* Text Content - Prevent wrapping during transitions */}
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

                  {/* Tooltip for Collapsed State - Only show when collapsed */}
                  {isSidebarCollapsed && !isMobileSidebarOpen && (
                    <div className="absolute left-full ml-6 top-1/2 transform -translate-y-1/2 px-4 py-3 bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap border border-indigo-500/40 shadow-2xl z-50 backdrop-blur-xl">
                      <div className="font-bold">{item.name}</div>
                      <div className="text-xs text-gray-300 mt-1">{item.description}</div>
                      <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-8 border-transparent border-r-[#1a1a2e]"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer Section - With top border separator */}
          <div className="relative p-5 border-t border-indigo-500/30">
            {/* Social Links - Responsive layout with smooth transitions */}
            <div className={`flex items-center justify-center mb-4 transition-all duration-300 ${
              isSidebarCollapsed && !isMobileSidebarOpen 
                ? 'flex-col space-y-4' 
                : 'flex-row space-x-4'
            }`}>
              <a 
                href="https://x.com/Ryvujournal" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group w-11 h-11 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-indigo-400/30 border border-indigo-500/40 hover:border-indigo-400"
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
                className="group w-11 h-11 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-indigo-400/30 border border-indigo-500/40 hover:border-indigo-400"
                aria-label="Join our Discord server"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white group-hover:scale-110 transition-transform duration-200">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              
              <button 
                onClick={handleCopyCA}
                className="group relative w-11 h-11 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-indigo-400/30 border border-indigo-500/40 hover:border-indigo-400"
                aria-label="Copy Contract Address"
              >
                <span className="text-white text-sm font-bold group-hover:scale-110 transition-transform duration-200">CA</span>
              </button>
            </div>
            
            {/* Disclaimer - Improved visibility when expanded */}
            <div className={`text-center transition-all duration-300 overflow-hidden ${
              isSidebarCollapsed && !isMobileSidebarOpen 
                ? 'opacity-0 h-0' 
                : 'opacity-100 h-auto'
            }`}>
              <p className="text-xs text-gray-400 leading-relaxed px-3 font-medium">
                Not financial advice. Some data may be inaccurate.
              </p>
            </div>
            
            {/* Right stroke - same as menu items */}
            <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-indigo-400/30 to-transparent"></div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar; 