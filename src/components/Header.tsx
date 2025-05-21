import React, { useState } from 'react';

interface WalletDropdownWallet {
  id: string;
  wallet_address: string;
  label?: string;
}

interface HeaderProps {
  userEmail?: string;
  onSignOut?: () => void;
  wallets?: WalletDropdownWallet[];
  selectedWalletId?: string | null;
  onWalletChange?: (walletId: string | null) => void;
  pageTitle?: string;
}

const Header = ({ userEmail, onSignOut, wallets = [], selectedWalletId = null, onWalletChange, pageTitle }: HeaderProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);

  const handleAvatarClick = () => setDropdownOpen((open) => !open);
  const handleAvatarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setDropdownOpen((open) => !open);
    }
  };
  const handleSignOut = () => {
    setDropdownOpen(false);
    onSignOut && onSignOut();
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

  return (
    <nav className="w-full h-16 bg-[#18181b] border-b border-gray-800 flex items-center justify-between px-6 shadow-sm z-20">
      {/* Left: Logo, Name, Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Placeholder Logo */}
        <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg select-none" aria-label="Journi logo" tabIndex={0}>
          J
        </div>
        <span className="text-xl font-bold text-white tracking-wide select-none">Journi</span>
        {pageTitle && (
          <span className="ml-6 text-2xl font-semibold text-white truncate" title={pageTitle}>{pageTitle}</span>
        )}
      </div>
      {/* Right: Wallet Dropdown & User Avatar */}
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
            className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
            tabIndex={0}
            aria-label="User menu"
            onClick={handleAvatarClick}
            onKeyDown={handleAvatarKeyDown}
          >
            {userEmail ? userEmail[0].toUpperCase() : 'U'}
          </div>
          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-[#23232b] rounded-md shadow-lg py-2 z-30 border border-gray-700 animate-fade-in">
              <div className="px-4 py-2 text-sm text-gray-300 truncate">{userEmail}</div>
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 focus:bg-gray-800 focus:outline-none"
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
    </nav>
  );
};

export default Header; 