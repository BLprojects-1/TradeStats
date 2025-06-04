import React from 'react';

interface AddWalletButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const AddWalletButton: React.FC<AddWalletButtonProps> = ({ 
  onClick, 
  disabled = false, 
  className = '' 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 
                 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-600 
                 text-white font-semibold px-6 py-3 rounded-2xl 
                 transition-all duration-300 transform hover:scale-105 
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-400/30
                 border border-emerald-400/30 hover:border-emerald-300/50
                 ${className}`}
      aria-label="Add new wallet to TradeStats"
    >
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-emerald-400/20 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Content */}
      <div className="relative flex items-center space-x-3">
        {/* Plus icon with rotation animation */}
        <div className="w-5 h-5 relative">
          <svg 
            className="w-5 h-5 transform group-hover:rotate-180 transition-transform duration-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2.5} 
              d="M12 4v16m8-8H4" 
            />
          </svg>
          {/* Glow effect */}
          <div className="absolute inset-0 bg-amber-400/60 blur-sm opacity-0 group-hover:opacity-100 
                          transition-opacity duration-300 rounded-full"></div>
        </div>
        
        {/* Text */}
        <span className="relative font-bold tracking-wide">
          Add Wallet
          {/* Underline effect */}
          <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-amber-400 
                          group-hover:w-full transition-all duration-300"></div>
        </span>
      </div>
      
      {/* Shine effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-0 -left-full h-full w-6 bg-gradient-to-r 
                        from-transparent via-white/20 to-transparent 
                        group-hover:left-full transform transition-transform duration-1000 
                        skew-x-12"></div>
      </div>
    </button>
  );
};

export default AddWalletButton;
