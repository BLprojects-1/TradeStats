import { useState } from 'react';
import { createUserProfile, addTrackedWallet, TrackedWallet } from '../utils/userProfile';
import { getAuthDebugInfo } from '../utils/debugSupabase';
import { supabase } from '../utils/supabaseClient';
import Head from 'next/head';
import Footer from '../components/Footer';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import ScanTradesModal from './ScanTradesModal';

interface WalletInput {
  address: string;
  label: string;
}

interface OnboardingFormProps {
  userId: string;
  onComplete: () => void;
}

// Add a type definition for the debug info
interface AuthDebugInfo {
  authenticated?: boolean;
  sessionError?: string;
  userError?: string;
  userId?: string;
  role?: string;
  email?: string;
  emailConfirmed?: string;
  dbDebugResult?: any[];
  hasReadPermission?: boolean;
  tokenExpiry?: string | null;
  error?: string;
}

const OnboardingForm = ({ userId, onComplete }: OnboardingFormProps) => {
  const { reloadWallets } = useWalletSelection();
  const [displayName, setDisplayName] = useState('');
  const [wallets, setWallets] = useState<WalletInput[]>([{ address: '', label: 'My Wallet' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugAuthInfo, setDebugAuthInfo] = useState<AuthDebugInfo | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedWalletForScan, setSelectedWalletForScan] = useState<TrackedWallet | null>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleWalletAddressChange = (index: number, value: string) => {
    const updatedWallets = [...wallets];
    updatedWallets[index].address = value;
    setWallets(updatedWallets);
  };

  const handleWalletLabelChange = (index: number, value: string) => {
    const updatedWallets = [...wallets];
    updatedWallets[index].label = value;
    setWallets(updatedWallets);
  };

  const addWalletField = () => {
    if (wallets.length >= 3) {
      setError('Maximum of 3 wallets allowed');
      return;
    }
    setWallets([...wallets, { address: '', label: `Wallet ${wallets.length + 1}` }]);
  };

  const removeWalletField = (index: number) => {
    if (wallets.length === 1) {
      return; // Keep at least one wallet field
    }
    const updatedWallets = [...wallets];
    updatedWallets.splice(index, 1);
    setWallets(updatedWallets);
  };

  const validateWalletAddress = (address: string): boolean => {
    // Basic Solana wallet address validation (44 characters starting with a base58 character)
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
    return solanaAddressRegex.test(address);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDebugInfo(null);

    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (wallets.length > 3) {
      setError('Maximum of 3 wallets allowed');
      return;
    }
    const validWallets = wallets.filter(wallet => wallet.address && validateWalletAddress(wallet.address));
    if (validWallets.length === 0) {
      setError('Please add at least one valid Solana wallet address');
      return;
    }
    try {
      setIsSubmitting(true);
      const profile = await createUserProfile(userId, displayName);
      if (!profile) throw new Error('Failed to create user profile');
      // Add first wallet and show scan modal immediately
      const firstWallet = validWallets[0];
      const addedWallet = await addTrackedWallet(userId, firstWallet.address, firstWallet.label);
      if (!addedWallet) throw new Error('Failed to add wallet');
      setSelectedWalletForScan(addedWallet);
      setShowScanModal(true);
      setIsSubmitting(false);
      // Add remaining wallets and reload in the background
      (async () => {
        if (validWallets.length > 1) {
          const rest = validWallets.slice(1);
          for (const wallet of rest) {
            try { await addTrackedWallet(userId, wallet.address, wallet.label); } catch {}
          }
        }
        await reloadWallets();
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  const handleScanComplete = () => {
    setShowScanModal(false);
    setSelectedWalletForScan(null);
    onComplete();
  };

  const handleDebugAuth = async () => {
    setDebugInfo("Running auth diagnostics...");
    try {
      const authInfo = await getAuthDebugInfo();
      setDebugAuthInfo(authInfo);
      setDebugInfo(JSON.stringify(authInfo, null, 2));
    } catch (err) {
      setDebugInfo(`Error in diagnostics: ${err}`);
    }
  };

  const inspectJWT = async () => {
    try {
      setDebugInfo("Examining JWT token...");

      // Get session
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        setDebugInfo("No active session token found. Please log in again.");
        return;
      }

      // Parse the JWT (do not do this in production with sensitive tokens)
      const parts = token.split('.');
      if (parts.length !== 3) {
        setDebugInfo("Invalid JWT format");
        return;
      }

      try {
        // Base64 decode and parse the payload
        const payload = JSON.parse(atob(parts[1]));

        // Check critical fields
        const tokenInfo = {
          subject: payload.sub,
          role: payload.role,
          expires: new Date(payload.exp * 1000).toISOString(),
          issuer: payload.iss,
          email: payload.email,
          isExpired: Date.now() > payload.exp * 1000,
          tokenHeader: parts[0].substring(0, 10) + '...',
        };

        setDebugInfo(JSON.stringify(tokenInfo, null, 2));
      } catch (e) {
        setDebugInfo(`Error parsing token: ${e}`);
      }
    } catch (err) {
      setDebugInfo(`JWT inspection error: ${err}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Head>
        <title>Setup | ryvu</title>
        <meta name="description" content="Set up your Solana Trading Journal" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-gradient-to-r from-[#0c0c0f] to-[#1a1a1a] shadow-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/logo.png" alt="ryvu Logo" className="h-8 w-auto" />
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl bg-[#1a1a1a] rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-indigo-400 mb-6 text-center">Set up your trading journal</h1>

          {error && (
            <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {debugInfo && (
            <div className="bg-blue-900/30 border border-blue-500 text-blue-200 px-4 py-3 rounded mb-6 text-xs font-mono whitespace-pre-wrap">
              Debug Info: {debugInfo}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-8">
              <label htmlFor="displayName" className="block text-xl font-medium text-indigo-200 mb-4">
                What should we call you?
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={handleNameChange}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-[#212121] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="mb-8">
              <label className="block text-xl font-medium text-indigo-200 mb-4">
                Add your Solana wallet addresses
              </label>
              <p className="text-gray-400 mb-4">Track your trading activity by adding your wallet addresses below.</p>

              {wallets.map((wallet, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-3 mb-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={wallet.label}
                      onChange={(e) => handleWalletLabelChange(index, e.target.value)}
                      placeholder="Wallet Label"
                      className="w-full px-4 py-3 bg-[#212121] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex-[2]">
                    <div className="flex">
                      <input
                        type="text"
                        value={wallet.address}
                        onChange={(e) => handleWalletAddressChange(index, e.target.value)}
                        placeholder="Solana Wallet Address"
                        className="flex-1 w-full px-4 py-3 bg-[#212121] text-white border border-gray-700 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeWalletField(index)}
                        className="px-4 py-3 bg-[#2a2a2a] text-gray-400 border border-gray-700 rounded-r-lg hover:bg-[#333] focus:outline-none"
                        aria-label="Remove wallet"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addWalletField}
                className="mt-2 px-4 py-2 bg-[#2a2a2a] text-indigo-300 rounded-md hover:bg-[#333] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                + Add Another Wallet
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Setting up...' : 'Complete Setup'}
              </button>
            </div>

            {error && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="text-indigo-400 text-sm underline"
                >
                  {showDebugPanel ? 'Hide Debug Tools' : 'Show Debug Tools'}
                </button>
              </div>
            )}

            {showDebugPanel && (
              <div className="mt-4 p-4 bg-gray-900 rounded-md">
                <h3 className="text-indigo-300 text-sm font-medium mb-2">Troubleshooting Tools</h3>
                <button
                  type="button"
                  onClick={handleDebugAuth}
                  className="px-3 py-1 bg-indigo-800 text-white text-xs rounded mr-2"
                >
                  Run Auth Diagnostics
                </button>
                <button
                  type="button"
                  onClick={inspectJWT}
                  className="px-3 py-1 bg-purple-800 text-white text-xs rounded mr-2"
                >
                  Inspect JWT Token
                </button>
                <a 
                  href="https://github.com/yourusername/journi/blob/main/supabase/TROUBLESHOOTING.md" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-blue-800 text-white text-xs rounded"
                >
                  View Troubleshooting Guide
                </a>
              </div>
            )}
          </form>
        </div>
      </main>

      <Footer />
      {showScanModal && selectedWalletForScan && (
        <ScanTradesModal
          wallet={selectedWalletForScan}
          onClose={() => {
            setShowScanModal(false);
            setSelectedWalletForScan(null);
            onComplete();
          }}
          onScanComplete={() => {
            setShowScanModal(false);
            setSelectedWalletForScan(null);
            onComplete();
          }}
        />
      )}
    </div>
  );
};

export default OnboardingForm; 
