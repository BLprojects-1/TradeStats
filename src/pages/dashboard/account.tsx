import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import { getUserProfile, UserProfile, updateUserProfile, deleteUserAccount, TrackedWallet } from '../../utils/userProfile';
import NewDashboardLayout from '../../components/layouts/NewDashboardLayout';
import WalletList from '../../components/WalletList';
import AddWalletModal from '../../components/AddWalletModal';
import { ProcessedTrade } from '../../services/tradeProcessor';
import { tradingHistoryService } from '../../services/tradingHistoryService';
import ApiErrorBanner from '../../components/ApiErrorBanner';
import { formatTokenAmount, formatSmallPrice } from '../../utils/formatters';
import { supabase } from '../../utils/supabaseClient';
import NotificationStack from '../../components/NotificationStack';
import { useNotificationStack } from '../../hooks/useNotificationStack';
import WalletScanModal from '../../components/WalletScanModal';
import { useNotificationContext } from '../../contexts/NotificationContext';

export default function Account() {
  const { user, loading, signOut } = useAuth();
  const { wallets, selectedWalletId, setSelectedWalletId } = useWalletSelection();
  const router = useRouter();
  const { notifications, addNotification, removeNotification } = useNotificationStack();
  const { showSuccess, showError } = useNotificationContext();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showAddWalletModal, setShowAddWalletModal] = useState<boolean>(false);
  const [showWalletScanModal, setShowWalletScanModal] = useState<boolean>(false);
  const [scanningWallet, setScanningWallet] = useState<string>('');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
      return;
    }

    if (user) {
      fetchData();
    }
  }, [user, loading, router]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDeleting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDeleting]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const profile = await getUserProfile(user.id);
      setUserProfile(profile);
      setDisplayName(profile?.display_name || user.email || '');
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      addNotification('Failed to load user profile', 'error');
    }
  };

  const handleSaveName = async () => {
    if (!user || !userProfile) return;

    try {
      const updatedProfile = await updateUserProfile(user.id, displayName);
      setUserProfile(updatedProfile);
      setIsEditing(false);
      addNotification('Display name updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update display name:', error);
      addNotification('Failed to update display name', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUserAccount(user.id);
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Failed to delete account:', error);
      addNotification('Failed to delete account', 'error');
      setIsDeleting(false);
    }
  };

  const handleAddWallet = () => {
    setShowAddWalletModal(true);
  };

  const handleCloseAddWalletModal = () => {
    setShowAddWalletModal(false);
  };

  const handleWalletAdded = async (newWallet: TrackedWallet) => {
    setShowAddWalletModal(false);
    addNotification('Wallet added successfully!', 'success');
  };

  const handleScanWallet = (address: string) => {
    setWalletAddress(address);
    setShowWalletScanModal(true);
  };

  const handleScanComplete = () => {
    setShowWalletScanModal(false);
    // Refresh any necessary data
  };

  const handleWalletScanSuccess = (result: { newTradesCount: number; message: string }) => {
    setShowWalletScanModal(false);
    showSuccess(result.message);
    // Refresh any necessary data after successful scan
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        </div>
        <div className="text-center z-10">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <NewDashboardLayout 
        title="Account Settings" 
        description="Manage your account settings and trading preferences"
      >
        <div className="space-y-8">
          {/* Account Information Section */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-600/40 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <svg className="w-6 h-6 mr-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Account Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={user.email || ''}
                  disabled
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-75"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={!isEditing}
                    className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-75"
                    placeholder="Enter display name"
                  />
                  {isEditing ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveName}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setDisplayName(userProfile?.display_name || user.email || '');
                        }}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-600">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Member since:</span>
                  <div className="text-white font-medium">
                    {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Last updated:</span>
                  <div className="text-white font-medium">
                    {userProfile?.updated_at ? new Date(userProfile.updated_at).toLocaleDateString() : 'Never'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Account ID:</span>
                  <div className="text-white font-medium font-mono text-xs">
                    {user.id.slice(0, 8)}...{user.id.slice(-8)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Wallets Section */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-600/40 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <svg className="w-6 h-6 mr-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Connected Wallets ({wallets.length})
              </h2>
              <div className="flex space-x-3">
                <button
                  onClick={handleAddWallet}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Wallet</span>
                </button>
              </div>
            </div>
            
            {apiError && <ApiErrorBanner message={apiError} onRetry={() => {}} errorType="general" />}
            
            <WalletList
              userId={user.id}
              onAddWallet={handleAddWallet}
            />
          </div>

          {/* Danger Zone */}
          <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 backdrop-blur-xl rounded-2xl p-6 border border-red-500/40 shadow-xl">
            <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Danger Zone
            </h2>
            <p className="text-red-200 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{isDeleting ? 'Deleting Account...' : 'Delete Account'}</span>
            </button>
          </div>
        </div>

        {/* Modals */}
        {showAddWalletModal && user && (
          <AddWalletModal
            userId={user.id}
            onClose={handleCloseAddWalletModal}
            onSuccess={handleWalletAdded}
          />
        )}

        {showWalletScanModal && (
          <WalletScanModal
            isOpen={showWalletScanModal}
            onClose={() => setShowWalletScanModal(false)}
            onSuccess={handleWalletScanSuccess}
            walletAddress={walletAddress}
            userId={user.id}
          />
        )}

        <NotificationStack 
          notifications={notifications}
          onDismiss={removeNotification}
        />
      </NewDashboardLayout>
    </div>
  );
}
