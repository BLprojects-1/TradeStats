import React, { ReactNode, createContext, useContext, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { TrackedWallet } from '../../utils/userProfile';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { DashboardNavigationProvider } from '../../contexts/DashboardNavigationContext';
import DashboardHeader from '../DashboardHeader';
import AddTokenModal from '../AddTokenModal';
import { motion, AnimatePresence } from 'framer-motion';

interface NewDashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  wallets?: TrackedWallet[];
  selectedWalletId?: string | null;
  onWalletChange?: (walletId: string | null) => void;
}

// Create layout context for Add Token modal
interface LayoutContextType {
  isAddTokenModalOpen: boolean;
  openAddTokenModal: () => void;
  closeAddTokenModal: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

// Export the context for direct access if needed
export { LayoutContext };
export type { LayoutContextType };

// Hook to use the layout context
export const useLayoutContext = (): LayoutContextType | null => {
  const context = useContext(LayoutContext);
  return context || null;
};

// Custom hook for Add Token modal - Safe version
export const useAddTokenModal = () => {
  const context = useLayoutContext();
  
  // Return safe defaults when context is not available
  if (!context) {
    return {
      isAddTokenModalOpen: false,
      openAddTokenModal: () => {
        console.warn('useAddTokenModal called outside of NewDashboardLayout context');
      },
      closeAddTokenModal: () => {
        console.warn('useAddTokenModal called outside of NewDashboardLayout context');
      }
    };
  }
  
  const { isAddTokenModalOpen, openAddTokenModal, closeAddTokenModal } = context;
  return { isAddTokenModalOpen, openAddTokenModal, closeAddTokenModal };
};

const NewDashboardLayout = ({
  children,
  title,
  description = "Your Advanced Portfolio Exchange Dashboard"
}: NewDashboardLayoutProps) => {
  const router = useRouter();
  
  // Add Token modal state
  const [isAddTokenModalOpen, setIsAddTokenModalOpen] = useState(false);
  
  // Notification context for success/error messages
  const { showSuccess, showError } = useNotificationContext();

  // Add Token modal handlers
  const openAddTokenModal = () => {
    setIsAddTokenModalOpen(true);
  };

  const closeAddTokenModal = () => {
    setIsAddTokenModalOpen(false);
  };

  const handleAddTokenSuccess = (tokenAddress: string) => {
    console.log('Token added successfully:', tokenAddress);
    showSuccess('Token added successfully to your portfolio!');
    closeAddTokenModal();
  };

  // Page transition variants for smooth Instagram-like transitions
  const pageVariants = {
    initial: {
      opacity: 0,
      x: 60,
      scale: 0.96
    },
    in: {
      opacity: 1,
      x: 0,
      scale: 1
    },
    out: {
      opacity: 0,
      x: -60,
      scale: 0.96
    }
  };

  const pageTransition = {
    type: "tween",
    ease: [0.25, 0.46, 0.45, 0.94],
    duration: 0.5
  };

  // Determine initial page from URL for navigation context
  const getInitialPage = () => {
    const path = router.pathname;
    const pathMap: Record<string, any> = {
      '/dashboard': 'dashboard',
      '/dashboard/open-trades': 'open-trades',
      '/dashboard/top-trades': 'top-trades',
      '/dashboard/trading-history': 'trading-history',
      '/dashboard/trade-log': 'trade-log',
      '/checklist': 'checklist',
      '/dashboard/account': 'account'
    };
    return pathMap[path] || 'dashboard';
  };

  return (
    <DashboardNavigationProvider initialPage={getInitialPage()}>
      <LayoutContext.Provider value={{ 
        isAddTokenModalOpen, 
        openAddTokenModal, 
        closeAddTokenModal 
      }}>
        <>
          <Head>
            <title>{title} | TradeStats</title>
            <meta name="description" content={description} />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.png" />
          </Head>

          <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950" style={{ zoom: 1.1 }}>
            
            {/* Enhanced Professional Header */}
            <DashboardHeader
              title={title}
              isSidebarCollapsed={false}
              isMobile={false}
              onToggleMobileSidebar={() => {}}
            />

            {/* Main Content with Smooth Page Transitions */}
            <main className="pt-20 min-h-screen">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={router.pathname}
                  initial="initial"
                  animate="in"
                  exit="out"
                  variants={pageVariants}
                  transition={pageTransition}
                  className="w-full"
                >
                  <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Professional Content Container */}
                    <div className="bg-gradient-to-br from-slate-900/90 via-emerald-950/70 to-teal-950/90 backdrop-blur-2xl rounded-3xl border border-emerald-500/30 shadow-2xl shadow-emerald-900/20 min-h-[calc(100vh-120px)] overflow-hidden">
                      
                      {/* Content with Enhanced Styling */}
                      <div className="relative p-6 lg:p-8 h-full">
                        
                        {/* Main Content */}
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4, duration: 0.5 }}
                          className="h-full"
                        >
                          {children}
                        </motion.div>

                        {/* Background Decorative Elements */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
                          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Add Token Modal */}
            <AddTokenModal
              isOpen={isAddTokenModalOpen}
              onClose={closeAddTokenModal}
              onAddToken={handleAddTokenSuccess}
            />

            {/* Enhanced Background Elements */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.1, 0.15, 0.1]
                }}
                transition={{ 
                  duration: 8, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"
              />
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ 
                  duration: 10, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  delay: 2
                }}
                className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl"
              />
              <motion.div 
                animate={{ 
                  scale: [1, 1.15, 1],
                  opacity: [0.05, 0.1, 0.05]
                }}
                transition={{ 
                  duration: 12, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  delay: 4
                }}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"
              />
            </div>
          </div>
        </>
      </LayoutContext.Provider>
    </DashboardNavigationProvider>
  );
};

export default NewDashboardLayout; 