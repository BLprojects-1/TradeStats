import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardNavigation } from '../contexts/DashboardNavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { useWalletSelection } from '../contexts/WalletSelectionContext';

// Import page content components (we'll create these)
import DashboardContent from './pages/DashboardContent';
import OpenTradesContent from './pages/OpenTradesContent';
import TopTradesContent from './pages/TopTradesContent';
import TradingHistoryContent from './pages/TradingHistoryContent';
import TradeLogContent from './pages/TradeLogContent';
import ChecklistContent from './pages/ChecklistContent';
import AccountContent from './pages/AccountContent';

const UnifiedDashboard: React.FC = () => {
  const { currentPage, isTransitioning } = useDashboardNavigation();
  const { user } = useAuth();
  const { selectedWalletId } = useWalletSelection();

  // State for managing modals and actions
  const [isAddCriteriaModalOpen, setIsAddCriteriaModalOpen] = useState(false);

  // Instagram-style page transition variants
  const pageVariants = {
    initial: (direction: number) => ({
      opacity: 0,
      x: direction > 0 ? 100 : -100,
      scale: 0.96,
      rotateY: direction > 0 ? 15 : -15,
    }),
    in: {
      opacity: 1,
      x: 0,
      scale: 1,
      rotateY: 0,
    },
    out: (direction: number) => ({
      opacity: 0,
      x: direction < 0 ? 100 : -100,
      scale: 0.96,
      rotateY: direction < 0 ? 15 : -15,
    })
  };

  const pageTransition = {
    type: "tween",
    ease: [0.25, 0.46, 0.45, 0.94],
    duration: 0.6
  };

  // Track page order for direction calculation
  const pageOrder = [
    'dashboard',
    'open-trades', 
    'top-trades',
    'trading-history',
    'trade-log',
    'checklist',
    'account'
  ];

  const [previousPage, setPreviousPage] = useState(currentPage);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const currentIndex = pageOrder.indexOf(currentPage);
    const previousIndex = pageOrder.indexOf(previousPage);
    
    if (currentIndex !== previousIndex) {
      setDirection(currentIndex > previousIndex ? 1 : -1);
      setPreviousPage(currentPage);
    }
  }, [currentPage, previousPage, pageOrder]);

  // Render the appropriate page content
  const renderPageContent = () => {
    const props = {
      // Pass modal state and handlers to checklist content
      ...(currentPage === 'checklist' && {
        isAddCriteriaModalOpen,
        setIsAddCriteriaModalOpen
      })
    };

    switch (currentPage) {
      case 'dashboard':
        return <DashboardContent />;
      case 'open-trades':
        return <OpenTradesContent />;
      case 'top-trades':
        return <TopTradesContent />;
      case 'trading-history':
        return <TradingHistoryContent />;
      case 'trade-log':
        return <TradeLogContent />;
      case 'checklist':
        return <ChecklistContent {...props} />;
      case 'account':
        return <AccountContent />;
      default:
        return <DashboardContent />;
    }
  };

  // Get page title and description
  const getPageInfo = () => {
    const pageInfo = {
      'dashboard': {
        title: 'Dashboard',
        description: 'Advanced Portfolio Exchange Dashboard'
      },
      'open-trades': {
        title: 'Open Trades',
        description: 'Advanced Portfolio Exchange Dashboard'
      },
      'top-trades': {
        title: 'Top Trades',
        description: 'Advanced Portfolio Exchange Dashboard'
      },
      'trading-history': {
        title: 'Trading History',
        description: 'Advanced Portfolio Exchange Dashboard'
      },
      'trade-log': {
        title: 'Professional Trade Log',
        description: 'Advanced tracking of your trading decisions and performance'
      },
      'checklist': {
        title: 'Professional Trading Criteria',
        description: 'These criteria help ensure each new token meets your strategy before you trade.'
      },
      'account': {
        title: 'Account Settings',
        description: 'Advanced Portfolio Exchange Dashboard'
      }
    };
    return pageInfo[currentPage] || pageInfo['dashboard'];
  };

  // Render page-specific header actions
  const renderHeaderActions = () => {
    switch (currentPage) {
      case 'checklist':
        return (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            onClick={() => setIsAddCriteriaModalOpen(true)}
            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-emerald-900/15 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Add criteria"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Criteria</span>
          </motion.button>
        );
      case 'trade-log':
        return (
          <div className="flex space-x-3">
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-emerald-900/15 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Token</span>
            </motion.button>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-900/15 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh Data</span>
            </motion.button>
          </div>
        );
      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const pageInfo = getPageInfo();

  return (
    <div className="w-full h-full min-h-[calc(100vh-120px)] relative overflow-hidden">
      
      {/* Page Title Section with Actions */}
      <div className="mb-8 pb-6 border-b border-emerald-500/20">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <motion.h1 
              key={currentPage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent mb-3"
            >
              {pageInfo.title}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-gray-400 text-lg max-w-2xl"
            >
              {pageInfo.description}
            </motion.p>
          </div>
          
          {/* Page-specific header actions */}
          <div className="ml-6 flex-shrink-0">
            {renderHeaderActions()}
          </div>
        </div>
      </div>

      {/* Page Content with Smooth Transitions */}
      <div className="relative w-full h-full">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentPage}
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="in"
            exit="out"
            transition={pageTransition}
            className="w-full h-full"
            style={{
              perspective: '1000px',
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Content Container */}
            <div className="w-full h-full">
              {renderPageContent()}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Transition Loading Overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-emerald-950/30 to-teal-950/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <div className="text-center">
              <div className="w-12 h-12 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-emerald-300 font-medium">Transitioning...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UnifiedDashboard; 