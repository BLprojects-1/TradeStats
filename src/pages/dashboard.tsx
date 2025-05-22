import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { getUserProfile, hasCompletedOnboarding } from '../utils/userProfile';
import OnboardingForm from '../components/OnboardingForm';
import WalletList from '../components/WalletList';
import AddWalletModal from '../components/AddWalletModal';
import DashboardLayout from '../components/layouts/DashboardLayout';

export default function Dashboard() {
  const { user, loading, refreshSession } = useAuth();
  const { selectedWalletId, wallets } = useWalletSelection();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If not loading and no user, redirect to home page
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user?.id) {
        console.error('No user ID available for onboarding check');
        return;
      }
      
      try {
        setIsCheckingOnboarding(true);
        setError(null);
        
        // Check if user has completed onboarding
        const completed = await hasCompletedOnboarding(user.id);
        setShowOnboarding(!completed);
      } catch (err) {
        console.error('Error checking onboarding status:', err);
        setError('Failed to check onboarding status. Please refresh the page.');
      } finally {
        setIsCheckingOnboarding(false);
      }
    };
    
    if (user) {
      checkOnboardingStatus();
    }
  }, [user]);

  const handleOnboardingComplete = async () => {
    if (user) {
      try {
        await refreshSession();
        setShowOnboarding(false);
      } catch (err) {
        console.error('Error completing onboarding:', err);
        setError('Failed to complete onboarding. Please try again.');
      }
    }
  };

  const handleOpenAddWalletModal = () => {
    setShowAddWalletModal(true);
  };

  const handleCloseAddWalletModal = () => {
    setShowAddWalletModal(false);
  };

  const handleWalletAdded = async () => {
    // No need to fetch wallets here, as the context will handle this
    setShowAddWalletModal(false);
  };

  // Show loading state while checking authentication
  if (loading || isCheckingOnboarding) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-indigo-400 text-xl">Loading...</div>
      </div>
    );
  }

  // Only render dashboard if user is authenticated
  if (!user) {
    return null;
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return <OnboardingForm userId={user.id} onComplete={handleOnboardingComplete} />;
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold mb-2 text-white">Dashboard Overview</h1>
          <p className="text-gray-500">Welcome to your Solana trading dashboard</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 sm:mb-6">
            {error}
            <button 
              onClick={() => window.location.reload()}
              className="ml-2 underline"
            >
              Refresh
            </button>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Recent Activity</h2>
            {wallets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">You haven&apos;t connected any wallets yet. Add a wallet to see your activity.</p>
                <button
                  onClick={handleOpenAddWalletModal}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition font-semibold"
                >
                  Add Wallet
                </button>
              </div>
            ) : (
              <p className="text-gray-300">Your recent transactions will appear here.</p>
            )}
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Performance Overview</h2>
            {wallets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">Track your trading performance once you connect your wallets.</p>
              </div>
            ) : (
              <p className="text-gray-300">Your trading performance metrics will appear here.</p>
            )}
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-200 mb-4 sm:mb-6">Manage Wallets</h2>
            <WalletList userId={user.id} onAddWallet={handleOpenAddWalletModal} />
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
    </DashboardLayout>
  );
} 