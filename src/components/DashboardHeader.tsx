import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { TrackedWallet } from '../utils/userProfile';
import NotificationToast from './NotificationToast';
import AddWalletModal from './AddWalletModal';

interface DashboardHeaderProps {
  title: string;
  isSidebarCollapsed: boolean;
  isMobile: boolean;
  onToggleMobileSidebar: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  isSidebarCollapsed,
  isMobile,
  onToggleMobileSidebar
}) => {
  const { user, signOut } = useAuth();
  const { wallets, selectedWalletId, setSelectedWalletId } = useWalletSelection();
  const router = useRouter();

  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState<boolean>(false);
  const [notificationVisible, setNotificationVisible] = useState<boolean>(false);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [showAddWalletModal, setShowAddWalletModal] = useState<boolean>(false);
  const [showNoWalletsModal, setShowNoWalletsModal] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const walletButtonRef = useRef<HTMLButtonElement>(null);

  // Check if user has no wallets and show modal
  useEffect(() => {
    if (user && wallets.length === 0 && !showAddWalletModal && !showNoWalletsModal) {
      // Small delay to ensure the component is fully mounted
      const timer = setTimeout(() => {
        setShowNoWalletsModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, wallets.length, showAddWalletModal, showNoWalletsModal]);

  const handleAvatarClick = () => setDropdownOpen((open) => !open);
  const handleAvatarKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAvatarClick();
    }
  };

  const handleSignOut = () => {
    signOut();
    setDropdownOpen(false);
  };

  const handleAccountSettings = () => {
    router.push('/dashboard/account');
    setDropdownOpen(false);
  };

  const handleWalletDropdownClick = () => setWalletDropdownOpen((open) => !open);
  const handleWalletDropdownKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleWalletDropdownClick();
    }
  };

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

  const handleAddWallet = () => {
    setShowNoWalletsModal(false);
    setShowAddWalletModal(true);
  };

  const handleCloseAddWalletModal = () => {
    setShowAddWalletModal(false);
  };

  const handleWalletAdded = async (newWallet: TrackedWallet) => {
    setShowAddWalletModal(false);
    setNotificationMessage('Wallet added successfully!');
    setNotificationVisible(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

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

  return (
    <>
      <header 
        className={`fixed top-0 right-0 z-20 transition-all duration-300 ${
          isMobile ? 'left-0 w-full' : 'w-auto'
        }`}
        style={{ 
          left: isMobile ? '0' : (isSidebarCollapsed ? '5rem' : '18rem'),
          right: '0'
        }}
      >
        {/* Match dashboard branding with consistent background */}
        <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border-b border-indigo-500/40 shadow-xl shadow-indigo-900/10">
          {/* Main Content */}
          <div className="relative z-10 flex items-center justify-between h-[94px] px-6 lg:px-8">
            {/* Left Section - Mobile Menu + Title */}
            <div className="flex items-center gap-4">
              {/* Native Mobile Menu Button */}
              <button
                onClick={onToggleMobileSidebar}
                className="group p-2 rounded-lg hover:bg-black/20 text-gray-300 hover:text-white transition-colors duration-200 md:hidden focus:outline-none focus:ring-2 focus:ring-gray-500/50 active:scale-95 active:bg-black/30"
                aria-label="Open menu"
              >
                <svg
                  className="h-6 w-6 transition-transform duration-150"
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

              {/* Page Title - Match dashboard typography */}
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  {title}
                </h1>
              </div>
            </div>
            
            {/* Right Section - Wallet Selector + User Menu */}
            <div className="flex items-center gap-4 lg:gap-6">
              {/* Wallet Dropdown - Desktop */}
              <div className="relative hidden sm:block min-w-[200px] lg:min-w-[280px]">
                <button
                  ref={walletButtonRef}
                  onClick={handleWalletDropdownClick}
                  onKeyDown={handleWalletDropdownKeyDown}
                  className="group flex items-center justify-between w-full bg-gradient-to-br from-[#252525]/80 to-[#1a1a1a]/80 backdrop-blur-sm border border-indigo-500/40 hover:border-indigo-500/60 rounded-xl px-4 py-3 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 hover:transform hover:scale-[1.02] shadow-lg shadow-indigo-900/10"
                  aria-label="Select wallet"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Wallet Icon */}
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-semibold text-gray-100 group-hover:text-white transition-colors duration-200 truncate">
                        {selectedWalletId 
                          ? (() => {
                              const wallet = wallets.find(w => w.id === selectedWalletId);
                              if (!wallet) return 'Select wallet';
                              return `${wallet.wallet_address.substring(0, 6)}...${wallet.wallet_address.substring(wallet.wallet_address.length - 4)}`;
                            })()
                          : 'Select wallet'
                        }
                      </div>
                      {selectedWalletId && (() => {
                        const wallet = wallets.find(w => w.id === selectedWalletId);
                        return wallet && (wallet.label || wallet.nickname) ? (
                          <div className="text-xs text-indigo-300/80 mt-0.5 truncate">
                            {wallet.label || wallet.nickname}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  
                  <div className="pointer-events-none transform transition-transform duration-300 group-hover:scale-110 ml-2">
                    <svg className={`w-5 h-5 text-indigo-400 group-hover:text-indigo-300 transition-all duration-300 ${walletDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </button>

                {/* Wallet Dropdown Menu - Match branding */}
                {walletDropdownOpen && (
                  <div ref={walletDropdownRef} className="absolute left-0 mt-3 w-full bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/40 overflow-hidden z-50 transform transition-all duration-300 ease-out origin-top">
                    <div className="relative z-10 max-h-80 overflow-y-auto">
                      <div className="py-2">
                        {!selectedWalletId && (
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleWalletSelect(null);
                            }}
                            className="w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-indigo-500/10 focus:bg-indigo-500/10 focus:outline-none transition-all duration-200"
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
                            className={`w-full text-left px-5 py-4 text-sm transition-all duration-200 focus:outline-none group ${
                              selectedWalletId === wallet.id
                                ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 text-white border-l-4 border-indigo-400'
                                : 'text-gray-100 hover:bg-indigo-500/10 focus:bg-indigo-500/10 hover:border-l-4 hover:border-indigo-400/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${selectedWalletId === wallet.id ? 'bg-indigo-400 shadow-lg shadow-indigo-400/50' : 'bg-gray-500 group-hover:bg-indigo-400/70'} transition-all duration-200`}></div>
                                <div>
                                  <div className="font-semibold">
                                    {wallet.wallet_address.substring(0, 6)}...{wallet.wallet_address.substring(wallet.wallet_address.length - 4)}
                                  </div>
                                  {(wallet.label || wallet.nickname) && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      {wallet.label || wallet.nickname}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {selectedWalletId === wallet.id && (
                                <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
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
              
              {/* User Avatar - Match branding */}
              <div className="relative">
                <button
                  ref={avatarRef}
                  className="group relative h-12 w-12 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#1a1a2e] transition-all duration-300 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-900/20 border border-indigo-500/40 hover:border-indigo-400 hover:scale-105"
                  onClick={handleAvatarClick}
                  onKeyDown={handleAvatarKeyDown}
                  aria-label="User menu"
                  tabIndex={0}
                >
                  <span className="relative z-10 text-lg drop-shadow-sm">
                    {user?.email ? user.email[0].toUpperCase() : 'U'}
                  </span>
                </button>
                
                {/* Avatar Dropdown - Match branding */}
                {dropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute right-0 mt-3 w-72 bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/40 overflow-hidden z-50 transform transition-all duration-300 ease-out origin-top-right"
                  >
                    <div className="relative z-10">
                      {/* User Info Section */}
                      <div className="px-6 py-5 bg-gradient-to-r from-[#252525]/80 to-[#1a1a1a]/80 border-b border-indigo-500/30">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                            {user?.email ? user.email[0].toUpperCase() : 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-200 truncate">{user?.email}</div>
                            <div className="text-xs text-indigo-300/80 mt-1">Account Settings</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Menu Items */}
                      <div className="py-2">
                        <button
                          className="w-full text-left px-6 py-4 text-sm text-gray-100 hover:bg-indigo-500/10 focus:bg-indigo-500/10 focus:outline-none transition-all duration-200 flex items-center gap-4 group"
                          onClick={handleAccountSettings}
                          tabIndex={0}
                        >
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors duration-200 border border-indigo-400/30">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-semibold">Account Settings</div>
                            <div className="text-xs text-indigo-300/60 mt-0.5">Manage your account</div>
                          </div>
                        </button>
                        <button
                          className="w-full text-left px-6 py-4 text-sm text-red-400 hover:bg-red-900/20 focus:bg-red-900/20 focus:outline-none transition-all duration-200 flex items-center gap-4 group"
                          onClick={handleSignOut}
                          tabIndex={0}
                        >
                          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors duration-200 border border-red-400/30">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-semibold">Sign out</div>
                            <div className="text-xs text-red-300/60 mt-0.5">End your session</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Mobile Wallet Selector - Enhanced for native look */}
          <div className="bg-gradient-to-r from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border-t border-indigo-500/30 px-4 py-3 sm:hidden shadow-lg">
            <div className="relative">
              <button
                ref={walletButtonRef}
                onClick={handleWalletDropdownClick}
                onKeyDown={handleWalletDropdownKeyDown}
                className="group flex items-center justify-between w-full bg-[#2a2a3a]/80 backdrop-blur-sm border border-gray-600/40 hover:border-gray-500/60 rounded-xl px-4 py-3 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400/50 shadow-lg active:scale-98"
                aria-label="Select wallet"
                tabIndex={0}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#4a4a5a]/60 flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors duration-200 truncate">
                      {selectedWalletId 
                        ? (() => {
                            const wallet = wallets.find(w => w.id === selectedWalletId);
                            if (!wallet) return 'Select wallet';
                            return `${wallet.wallet_address.substring(0, 8)}...${wallet.wallet_address.substring(wallet.wallet_address.length - 6)}`;
                          })()
                        : 'Select wallet'
                      }
                    </div>
                    {selectedWalletId && (() => {
                      const wallet = wallets.find(w => w.id === selectedWalletId);
                      return wallet && (wallet.label || wallet.nickname) ? (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">
                          {wallet.label || wallet.nickname}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                
                <div className="pointer-events-none transform transition-transform duration-300 group-hover:scale-110 ml-2">
                  <svg className={`w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-all duration-300 ${walletDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </button>

              {/* Mobile Wallet Dropdown Menu - Enhanced */}
              {walletDropdownOpen && (
                <div ref={walletDropdownRef} className="absolute left-0 mt-3 w-full bg-[#2a2a3a]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-600/40 overflow-hidden z-50 transform transition-all duration-300 ease-out origin-top">
                  <div className="relative z-10 max-h-80 overflow-y-auto">
                    <div className="py-2">
                      {!selectedWalletId && (
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleWalletSelect(null);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700/20 focus:bg-gray-700/20 focus:outline-none transition-all duration-200 active:bg-gray-700/30"
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
                          className={`w-full text-left px-4 py-3 text-sm transition-all duration-200 focus:outline-none group active:scale-98 ${
                            selectedWalletId === wallet.id
                              ? 'bg-blue-600/20 text-white border-l-3 border-blue-400'
                              : 'text-gray-200 hover:bg-gray-700/20 focus:bg-gray-700/20 hover:border-l-3 hover:border-gray-500/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${selectedWalletId === wallet.id ? 'bg-blue-400 shadow-sm' : 'bg-gray-500 group-hover:bg-gray-400'} transition-all duration-200`}></div>
                              <div>
                                <div className="font-medium text-sm">
                                  {wallet.wallet_address.substring(0, 8)}...{wallet.wallet_address.substring(wallet.wallet_address.length - 6)}
                                </div>
                                {(wallet.label || wallet.nickname) && (
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {wallet.label || wallet.nickname}
                                  </div>
                                )}
                              </div>
                            </div>
                            {selectedWalletId === wallet.id && (
                              <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
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
        </div>
      </header>

      {/* No Wallets Modal */}
      {showNoWalletsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl shadow-2xl shadow-indigo-900/20 max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-indigo-500/20">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Welcome to Journi!</h2>
              </div>
              <button
                onClick={() => setShowNoWalletsModal(false)}
                className="p-3 rounded-xl bg-slate-800/50 border border-indigo-500/30 hover:bg-slate-700/50 hover:border-indigo-500/50 text-gray-400 hover:text-gray-200 transition-all duration-300 group"
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                  <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 animate-pulse"></div>
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-3">
                  Add Your First Wallet
                </h3>
                <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                  To get started with Journi, you'll need to add a Solana wallet address. We'll analyze your trading history and help you track your performance.
                </p>
                <div className="flex items-center justify-center space-x-2 text-xs text-gray-400 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 rounded-xl p-3 border border-indigo-500/20 mb-6">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Your wallet data is secure and read-only</span>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleAddWallet}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-indigo-900/20"
                  >
                    Add Wallet Address
                  </button>
                  <button
                    onClick={() => setShowNoWalletsModal(false)}
                    className="w-full px-6 py-3 text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors"
                  >
                    I'll do this later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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