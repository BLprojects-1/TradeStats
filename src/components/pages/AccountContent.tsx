import React from 'react';
import { motion } from 'framer-motion';

const AccountContent: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full space-y-8"
    >
      <div className="bg-gradient-to-br from-slate-800/50 to-emerald-950/30 rounded-2xl border border-emerald-500/20 p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-purple-300 mb-4">Account Settings</h3>
        <p className="text-gray-400 text-lg mb-6">
          Manage your account preferences, notifications, and profile settings here.
        </p>
        <p className="text-purple-400 font-medium">
          Coming soon with smooth transitions! 🚀
        </p>
      </div>
    </motion.div>
  );
};

export default AccountContent; 