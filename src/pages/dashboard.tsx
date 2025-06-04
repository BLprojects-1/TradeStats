import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { getUserProfile, hasCompletedOnboarding, TrackedWallet } from '../utils/userProfile';
import NewDashboardLayout from '../components/layouts/NewDashboardLayout';
import { PerformanceChart } from '../components/PerformanceChart';
import { PerformanceStats } from '../components/PerformanceStats';

import { PerformanceService, PerformanceData } from '../services/performanceService';
import { formatTokenAmount, formatSmallPrice, formatPriceWithTwoDecimals } from '../utils/formatters';
import NotificationToast from '../components/NotificationToast';
import { useProcessedTradingData } from '../hooks/useProcessedTradingData';
import { TokenHolding } from '../utils/historicalTradeProcessing';
import ScanTradesModal from '../components/ScanTradesModal';
import TradeInfoModal from '../components/TradeInfoModal';
import WalletScanModal from '../components/WalletScanModal';
import { tradingHistoryService } from '../services/tradingHistoryService';
import { supabase } from '../utils/supabaseClient';
import { useDashboardNavigation } from '../contexts/DashboardNavigationContext';
import UnifiedDashboard from '../components/UnifiedDashboard';

interface OnboardingData {
  hasCompletedOnboarding: boolean;
  progress: number;
}

// Wrapper component to handle URL synchronization
const DashboardWrapper = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { getPageFromPath, navigateToPage } = useDashboardNavigation();

  // Sync URL with current page on initial load
  useEffect(() => {
    if (!loading && user && router.isReady) {
      const currentPage = getPageFromPath(router.pathname);
      navigateToPage(currentPage, false); // Don't update URL since we're reading from it
    }
  }, [user, loading, router.isReady, router.pathname, getPageFromPath, navigateToPage]);

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
          <p className="text-gray-400 text-lg">Loading TradeStats Dashboard...</p>
        </div>
      </div>
    );
  }

  return <UnifiedDashboard />;
};

export default function Dashboard() {
  return (
    <NewDashboardLayout title="Dashboard">
      <DashboardWrapper />
    </NewDashboardLayout>
  );
}
