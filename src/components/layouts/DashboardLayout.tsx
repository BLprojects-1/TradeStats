import React, { ReactNode } from 'react';
import Head from 'next/head';
import DashboardHeader from '../DashboardHeader';
import { TrackedWallet } from '../../utils/userProfile';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  wallets?: TrackedWallet[];
  selectedWalletId?: string | null;
  onWalletChange?: (walletId: string | null) => void;
}

const DashboardLayout = ({
  children,
  title,
  description = "Your Advanced Portfolio Exchange Dashboard"
}: DashboardLayoutProps) => {
  const router = useRouter();

  // Page transition variants for smooth Instagram-like swiping
  const pageVariants = {
    initial: {
      opacity: 0,
      x: 50,
      scale: 0.98
    },
    in: {
      opacity: 1,
      x: 0,
      scale: 1
    },
    out: {
      opacity: 0,
      x: -50,
      scale: 0.98
    }
  };

  const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.4
  };

  return (
    <>
      <Head>
        <title>{title} | TradeStats</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
        
        {/* Professional Header Navigation */}
        <DashboardHeader 
          title={title}
          isSidebarCollapsed={false}
          isMobile={false}
          onToggleMobileSidebar={() => {}}
        />

        {/* Main Content Area with Smooth Transitions */}
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
                <div className="bg-gradient-to-br from-slate-900/80 via-emerald-950/60 to-teal-950/80 backdrop-blur-xl rounded-3xl border border-emerald-500/30 shadow-2xl shadow-emerald-900/20 min-h-[calc(100vh-120px)] p-6 lg:p-8">
                  {children}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Background Elements */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"></div>
        </div>
      </div>
    </>
  );
};

export default DashboardLayout; 