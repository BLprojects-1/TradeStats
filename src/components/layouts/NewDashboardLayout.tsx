import React, { ReactNode, useState, useRef, useEffect, createContext, useContext } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { TrackedWallet } from '../../utils/userProfile';
import { useWalletSelection } from '../../contexts/WalletSelectionContext';
import DashboardHeader from '../DashboardHeader';
import DashboardSidebar from '../DashboardSidebar';

interface NewDashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  wallets?: TrackedWallet[];
  selectedWalletId?: string | null;
  onWalletChange?: (walletId: string | null) => void;
}

// Create layout context for sidebar state
interface LayoutContextType {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  isMobile: boolean;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayoutContext = () => {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayoutContext must be used within a NewDashboardLayout');
  }
  return context;
};

const NewDashboardLayout = ({
  children,
  title,
  description = "Your Solana Trading Journal Dashboard",
  wallets: propWallets,
  selectedWalletId: propSelectedWalletId,
  onWalletChange
}: NewDashboardLayoutProps) => {
  const { user } = useAuth();
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Use the shared wallet selection context
  const { 
    wallets: contextWallets, 
    selectedWalletId: contextSelectedWalletId,
    setSelectedWalletId: contextSetSelectedWalletId
  } = useWalletSelection();

  // Use context values, falling back to props for backward compatibility
  const wallets = contextWallets || propWallets || [];
  const selectedWalletId = contextSelectedWalletId !== null ? contextSelectedWalletId : propSelectedWalletId;

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize(); // Set initial value
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    const handleRouteChange = () => {
      setIsMobileSidebarOpen(false);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <LayoutContext.Provider value={{ isSidebarCollapsed, isMobileSidebarOpen, isMobile }}>
      <div className="flex flex-col h-screen bg-black">
        <Head>
          <title>{title} | ryvu</title>
          <meta name="description" content={description} />
          <link rel="icon" href="/favicon.ico" />
          <style jsx>{`
            @keyframes slideDownFadeIn {
              0% {
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            
            @keyframes slideUpFadeOut {
              0% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
              100% {
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
              }
            }
          `}</style>
        </Head>

        <div className="flex flex-1 min-h-0">
          {/* Enhanced Sidebar */}
          <DashboardSidebar
            isSidebarCollapsed={isSidebarCollapsed}
            isMobileSidebarOpen={isMobileSidebarOpen}
            isMobile={isMobile}
            onToggleSidebar={toggleSidebar}
            onToggleMobileSidebar={toggleMobileSidebar}
          />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-black">
            {/* Enhanced Header */}
            <DashboardHeader
              title={title}
              isSidebarCollapsed={isSidebarCollapsed}
              isMobile={isMobile}
              onToggleMobileSidebar={toggleMobileSidebar}
            />

            {/* Content with proper spacing for the fixed header */}
            <div 
              className="container mx-auto px-3 sm:px-4 lg:px-6 pb-6"
              style={{ 
                paddingTop: isMobile ? '12.5rem' : '7.5rem'
              }}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
};

export default NewDashboardLayout; 