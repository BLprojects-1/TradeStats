import React from 'react';
import { motion } from 'framer-motion';

const TradingHistoryContent: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full space-y-8"
    >
      <div className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-blue-300 mb-4">Trading History</h3>
        <p className="text-gray-400 text-lg mb-6">
          Complete history of all your trades and transactions will be available here.
        </p>
        <p className="text-blue-400 font-medium">
          Coming soon with smooth transitions! 🚀
        </p>
      </div>
    </motion.div>
  );
};

export default TradingHistoryContent; 