import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardNavigation } from '../contexts/DashboardNavigationContext';
import NewDashboardLayout from '../components/layouts/NewDashboardLayout';
import UnifiedDashboard from '../components/UnifiedDashboard';

// Component that will be wrapped by the layout and provider
const ChecklistContent = () => {
  const { navigateToPage } = useDashboardNavigation();

  // Navigate to checklist page in unified dashboard on mount
  useEffect(() => {
    navigateToPage('checklist', false); // Don't update URL since we're already on /checklist
  }, [navigateToPage]);

  return <UnifiedDashboard />;
};

const ChecklistPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Loading Trade Checklist...</p>
        </div>
      </div>
    );
  }

  return (
    <NewDashboardLayout title="Trade Checklist">
      <ChecklistContent />
    </NewDashboardLayout>
  );
};

export default ChecklistPage; 