import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import { getUserProfile, UserProfile, updateUserProfile, deleteUserAccount, TrackedWallet } from '../../utils/userProfile';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import WalletList from '../../components/WalletList';
import AddWalletModal from '../../components/AddWalletModal';
import { ProcessedTrade } from '../../services/tradeProcessor';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice } from '../../utils/formatters';
import { supabase } from '../../utils/supabaseClient';
import ScanTradesModal from '../../components/ScanTradesModal';
import TrafficInfoModal from '../../components/TrafficInfoModal';
import NotificationStack from '../../components/NotificationStack';
import { useNotificationStack } from '../../hooks/useNotificationStack';

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
  const [scanningWallet, setScanningWallet] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedWalletForScan, setSelectedWalletForScan] = useState<TrackedWallet | null>(null);

  // Use the notification stack hook
  const { notifications, addNotification, removeNotification } = useNotificationStack();

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

  const handleWalletAdded = async (newWallet: TrackedWallet) => {
    try {
      console.log('Wallet added successfully:', newWallet);
      setShowAddWalletModal(false);
      setSelectedWalletForScan(newWallet);
      setShowScanModal(true);
    } catch (err) {
      console.error('Error adding wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to add wallet');
    }
  };

  const handleScanComplete = () => {
    addNotification('Trading history analysis completed!', 'success', 5000);
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
      addNotification(`Please try again in ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`, 'info', 3000);
      return;
    }
    
    setRefreshing(true);
    setLastRefreshTime(now);
    
    // Add loading notification
    const loadingId = addNotification('Refreshing account data...', 'loading', 0);
    
    try {
      // Simulate refresh - in a real scenario, you might refresh user data or wallets
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Remove loading notification and add success
      removeNotification(loadingId);
      addNotification("You're up to date!", 'success', 5000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      // Remove loading notification and add error
      removeNotification(loadingId);
      addNotification('Failed to refresh data. Please try again.', 'error', 5000);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="animate-pulse text-indigo-400 text-xl mb-4">Loading your account...</div>
          <div className="w-32 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-gray-100 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3 bg-indigo-500/3 blur-[50px] rounded-full"></div>
      </div>

      <DashboardLayout title="Account Settings">
        <div className="relative z-10 space-y-4 sm:space-y-6">
          {/* Enhanced Header Section */}
          <div className="relative">
            <div className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    Account Settings
                  </h1>
                  <p className="text-gray-300">Manage your account settings and preferences</p>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing || cooldownTimeLeft > 0}
                  className="group/btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2 shadow-lg shadow-indigo-900/15 transition-all duration-300 transform hover:scale-105 disabled:scale-100"
                >
                  {refreshing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Refreshing...</span>
                    </>
                  ) : cooldownTimeLeft > 0 ? (
                    <>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{Math.floor(cooldownTimeLeft / 60)}:{(cooldownTimeLeft % 60).toString().padStart(2, '0')}</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 group-hover/btn:rotate-180 transition-transform duration-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Refresh</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-gradient-to-r from-red-900/30 to-red-800/30 backdrop-blur-sm border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl shadow-lg shadow-red-900/10">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div className="space-y-8">
            {/* Enhanced Account Info */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-indigo-500/40">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/15">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Account Information
                  </h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Display Name</label>
                    {editName ? (
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <input
                          className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#252525]/80 text-gray-200 border border-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          disabled={saving}
                        />
                        <div className="flex gap-3 mt-2 sm:mt-0">
                          <button
                            className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-indigo-900/15"
                            onClick={handleSaveName}
                            disabled={saving}
                          >
                            Save
                          </button>
                          <button
                            className="px-4 py-3 bg-[#252525]/80 text-gray-200 rounded-xl hover:bg-[#303030] transition-all duration-300"
                            onClick={() => { setEditName(false); setDisplayName(profile?.display_name || ''); }}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="text-gray-100 font-medium text-lg">{profile?.display_name || 'Not set'}</div>
                        <button
                          className="px-3 py-2 text-sm bg-[#252525]/80 text-gray-300 rounded-xl hover:bg-[#303030] hover:text-white transition-all duration-300"
                          onClick={() => setEditName(true)}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
                    <div className="text-gray-100 font-medium text-lg break-all">{user.email}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Account Created</label>
                    <div className="text-gray-100 font-medium text-lg">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Manage Wallets */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-cyan-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-purple-500/40">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/15">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    Manage Wallets
                  </h2>
                </div>
                <WalletList userId={user.id} onAddWallet={handleAddWallet} />
              </div>
            </div>

            {/* Enhanced Account Actions */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 opacity-0 group-hover:opacity-50 blur transition-all duration-500 rounded-2xl"></div>
              <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-red-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/5 transition-all duration-500 hover:border-red-500/40">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/15">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                    Account Actions
                  </h2>
                </div>
                <div className="flex flex-col gap-4">
                  <button
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl hover:from-red-500 hover:to-red-400 transition-all duration-300 font-semibold transform hover:scale-105 shadow-lg shadow-red-900/15"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Account
                  </button>
                  <button
                    className="px-6 py-3 bg-[#252525]/80 text-gray-200 rounded-xl hover:bg-[#303030] transition-all duration-300 font-semibold"
                    onClick={signOut}
                  >
                    Sign Out
                  </button>
                </div>
                {/* Enhanced Delete confirmation modal */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-500 opacity-50 blur rounded-2xl"></div>
                      <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-red-900/20 p-8 max-w-sm w-full border border-red-500/30">
                        <h3 className="text-xl font-bold text-red-400 mb-4">Are you sure you want to delete your account?</h3>
                        <p className="text-gray-300 mb-6">This action cannot be undone. All your data will be permanently deleted.</p>
                        <div className="flex gap-4 justify-end">
                          <button
                            className="px-4 py-2 bg-[#252525]/80 text-gray-200 rounded-xl hover:bg-[#303030] transition-all duration-300"
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl hover:from-red-500 hover:to-red-400 transition-all duration-300 font-semibold transform hover:scale-105 shadow-lg shadow-red-900/15"
                            onClick={handleDeleteAccount}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {showAddWalletModal && (
          <AddWalletModal
            userId={user.id}
            onClose={handleCloseAddWalletModal}
            onSuccess={handleWalletAdded}
          />
        )}
        {showScanModal && selectedWalletForScan && (
          <ScanTradesModal
            wallet={selectedWalletForScan}
            onClose={() => {
              setShowScanModal(false);
              setSelectedWalletForScan(null);
            }}
            onScanComplete={handleScanComplete}
          />
        )}
        <NotificationStack 
          notifications={notifications}
          onDismiss={removeNotification}
        />
        <TrafficInfoModal />
      </DashboardLayout>
    </div>
  );
}
