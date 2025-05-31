import React, { useRef, useState, useEffect } from 'react';
import NewDashboardLayout from '../../components/layouts/NewDashboardLayout';
import TradeChecklist from '../../components/TradeChecklist';
import TrafficInfoModal from '../../components/TrafficInfoModal';

const TradeChecklistPage = () => {
  const tradeChecklistRef = useRef<{ openModal: () => void }>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddRule = () => {
    setIsModalOpen(true);
    tradeChecklistRef.current?.openModal();
  };

  // Listen for modal close events (we can use a custom event or state management)
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isModalOpen]);

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-gray-100 overflow-hidden">
      {/* Background Elements - Reduced glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/10 blur-[75px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/5 blur-[60px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
        <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3 bg-indigo-500/3 blur-[50px] rounded-full"></div>
      </div>

      <NewDashboardLayout title="Trade Checklist">
        <div className="relative z-10 space-y-6 sm:space-y-8">
          {/* Enhanced Header Section */}
          <div className="relative">
            <div className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-900/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    Trade Checklist
                  </h1>
                  <p className="text-gray-300">Maintain discipline in your trading decisions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Trade Checklist Section */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-50 blur-md transition-all duration-700 rounded-3xl"></div>
            <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl shadow-xl shadow-indigo-900/10 transition-all duration-500 hover:border-indigo-500/40">
              <div className="p-6 border-b border-indigo-500/20">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/15">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Your Trading Criteria
                      </h2>
                      <p className="text-gray-400">Create personalized checklist items to validate your trading decisions</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAddRule}
                    className="group bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg shadow-indigo-900/15 transition-all duration-300 transform hover:scale-105"
                    aria-label="Add rule"
                    tabIndex={0}
                  >
                    <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add Rule</span>
                  </button>
                </div>
              </div>

              <div className="p-8">
                <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur-sm rounded-xl p-6 border border-indigo-500/20 mb-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-2">How It Works</h3>
                      <p className="text-gray-400 leading-relaxed">
                        Create your personalized checklist of criteria that a token must meet before you trade it. 
                        When you import a new token, you'll be able to go through this checklist to ensure it aligns 
                        with your trading strategy. This helps maintain consistency and discipline in your trading decisions.
                      </p>
                    </div>
                  </div>
                </div>

                <TradeChecklist ref={tradeChecklistRef} />
              </div>
            </div>
          </div>

          <TrafficInfoModal />
        </div>
      </NewDashboardLayout>
    </div>
  );
};

export default TradeChecklistPage; 