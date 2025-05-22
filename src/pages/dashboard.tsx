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
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error}
          <button 
            onClick={() => window.location.reload()}
            className="ml-2 underline"
          >
            Refresh
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-indigo-200">Recent Activity</h2>
          {wallets.length === 0 ? (
            <p className="text-gray-300">You haven't connected any wallets yet. Add a wallet to see your activity.</p>
          ) : (
            <p className="text-gray-300">Your recent transactions will appear here.</p>
          )}
        </div>
        
        <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4 text-indigo-200">Performance Overview</h2>
          {wallets.length === 0 ? (
            <p className="text-gray-300">Track your trading performance once you connect your wallets.</p>
          ) : (
            <p className="text-gray-300">Your trading performance metrics will appear here.</p>
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