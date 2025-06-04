import React from 'react';
import { motion } from 'framer-motion';

const OpenTradesContent: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full space-y-8"
    >
      <div className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-emerald-300 mb-4">Open Trades</h3>
        <p className="text-gray-400 text-lg mb-6">
          Your active trading positions and current holdings will be displayed here.
        </p>
        <p className="text-emerald-400 font-medium">
          Coming soon with smooth transitions! 🚀
        </p>
      </div>
    </motion.div>
  );
};

export default OpenTradesContent; 