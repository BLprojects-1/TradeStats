import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import { getUserProfile, UserProfile, updateUserProfile, deleteUserAccount, TrackedWallet } from '../../utils/userProfile';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import WalletList from '../../components/WalletList';
import AddWalletModal from '../../components/AddWalletModal';

export default function Account() {
  const { user, loading, signOut } = useAuth();
  const { wallets, setSelectedWalletId } = useWalletSelection();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editName, setEditName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);

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
    // WalletList will update through the context automatically
    setShowAddWalletModal(false);
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
          <h1 className="text-xl sm:text-2xl font-semibold mb-2 text-white">Account Settings</h1>
          <p className="text-gray-500">Manage your account information and connected wallets</p>
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
