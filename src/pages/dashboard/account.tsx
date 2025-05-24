import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import { getUserProfile, UserProfile, updateUserProfile, deleteUserAccount, TrackedWallet } from '../../utils/userProfile';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import WalletList from '../../components/WalletList';
import AddWalletModal from '../../components/AddWalletModal';
import LoadingToast from '../../components/LoadingToast';
import { ProcessedTrade } from '../../services/tradeProcessor';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice } from '../../utils/formatters';

export default function Account() {
  const { user, loading, signOut } = useAuth();
  const { wallets } = useWalletSelection();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editName, setEditName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        // Only need to fetch the user profile since wallets are now managed by the context
        const userProfile = await getUserProfile(user.id);
        setProfile(userProfile);
        setDisplayName(userProfile?.display_name || '');
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load profile. Please try again.');
      }
    };
    if (user) {
      fetchData();
    }
  }, [user]);

  // Cooldown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cooldownTimeLeft > 0) {
      interval = setInterval(() => {
        setCooldownTimeLeft(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cooldownTimeLeft]);

  const handleSaveName = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(user.id, displayName);
      setEditName(false);
      setProfile((prev) => prev ? { ...prev, display_name: displayName } : prev);
    } catch (err) {
      setError('Failed to update name.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setError(null);
    try {
      await deleteUserAccount(user.id);
      signOut();
      router.push('/');
    } catch (err) {
      setError('Failed to delete account.');
    }
  };

  const handleAddWallet = () => {
    setShowAddWalletModal(true);
  };

  const handleCloseAddWalletModal = () => {
    setShowAddWalletModal(false);
  };

  const handleWalletAdded = (newWallet: TrackedWallet) => {
    setShowAddWalletModal(false);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    
    // Check cooldown
    const now = Date.now();
    const cooldownMs = 2 * 60 * 1000; // 2 minutes
    const timeSinceLastRefresh = now - lastRefreshTime;
    
    if (timeSinceLastRefresh < cooldownMs) {
      const timeLeft = Math.ceil((cooldownMs - timeSinceLastRefresh) / 1000);
      setCooldownTimeLeft(timeLeft);
      setRefreshMessage(`Please try again in ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`);
      setTimeout(() => setRefreshMessage(null), 3000);
      return;
    }
    
    setRefreshing(true);
    setRefreshMessage(null);
    setLastRefreshTime(now);
    
    try {
      // Simulate refresh - in a real scenario, you might refresh user data or wallets
      await new Promise(resolve => setTimeout(resolve, 1000));
      setRefreshMessage("You're up to date!");
      
      // Clear message after 5 seconds
      setTimeout(() => setRefreshMessage(null), 5000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setRefreshMessage('Failed to refresh data. Please try again.');
      setTimeout(() => setRefreshMessage(null), 5000);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-indigo-400 text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout 
      title="Account Settings"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Account Settings</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing || cooldownTimeLeft > 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Refreshing...</span>
                </>
              ) : cooldownTimeLeft > 0 ? (
                <>
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{Math.floor(cooldownTimeLeft / 60)}:{(cooldownTimeLeft % 60).toString().padStart(2, '0')}</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </>
              )}
            </button>
          </div>
          <p className="text-gray-500">Manage your account information and connected wallets</p>
          {refreshMessage && (
            <div className={`mt-3 p-3 rounded-md text-sm ${
              refreshMessage.includes('Failed') || refreshMessage.includes('unavailable') 
                ? 'bg-red-900/30 border border-red-500 text-red-200' 
                : 'bg-green-900/30 border border-green-500 text-green-200'
            }`}>
              {refreshMessage}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6">
            {error}
          </div>
        )}

        {/* Account Info */}
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Account Information</h2>
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
              {editName ? (
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <input
                    className="w-full sm:w-auto px-3 py-2 rounded bg-[#23232b] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    disabled={saving}
                  />
                  <div className="flex gap-2 mt-2 sm:mt-0">
                    <button
                      className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                      onClick={handleSaveName}
                      disabled={saving}
                    >
                      Save
                    </button>
                    <button
                      className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                      onClick={() => { setEditName(false); setDisplayName(profile?.display_name || ''); }}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <div className="text-white">{profile?.display_name || 'Not set'}</div>
                  <button
                    className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                    onClick={() => setEditName(true)}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
              <div className="text-white break-all">{user.email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Account Created</label>
              <div className="text-white">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}</div>
            </div>
          </div>
        </div>

        {/* Manage Wallets */}
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Manage Wallets</h2>
          <WalletList userId={user.id} onAddWallet={handleAddWallet} />
        </div>

        {/* Account Actions */}
        <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Account Actions</h2>
          <div className="flex flex-col gap-4">
            <button
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition font-semibold"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Account
            </button>
            <button
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition font-semibold"
              onClick={signOut}
            >
              Sign Out
            </button>
          </div>
          {/* Delete confirmation modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-[#23232b] rounded-lg shadow-lg p-5 sm:p-8 max-w-sm w-full border border-red-700">
                <h3 className="text-lg font-bold text-red-400 mb-4">Are you sure you want to delete your account?</h3>
                <p className="text-gray-300 mb-6">This action cannot be undone. All your data will be permanently deleted.</p>
                <div className="flex gap-4 justify-end">
                  <button
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition font-semibold"
                    onClick={handleDeleteAccount}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showAddWalletModal && (
        <AddWalletModal
          userId={user.id}
          onClose={handleCloseAddWalletModal}
          onSuccess={handleWalletAdded}
        />
      )}
    </DashboardLayout>
  );
}
