import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { tradingHistoryService } from '../services/tradingHistoryService';
import { ProcessedTrade } from '../services/tradeProcessor';

const TradingHistory: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialScan, setIsInitialScan] = useState(false);
  const [trades, setTrades] = useState<ProcessedTrade[]>([]);
  const [totalTrades, setTotalTrades] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [walletAddress, setWalletAddress] = useState('');
  const [userId, setUserId] = useState('');

  const fetchTradingHistory = async () => {
    try {
      setIsLoading(true);
      const { data: walletData } = await supabase
        .from('wallets')
        .select('initial_scan_complete')
        .eq('wallet_address', walletAddress)
        .single();

      setIsInitialScan(!walletData?.initial_scan_complete);
      
      const result = await tradingHistoryService.getTradingHistory(
        userId,
        walletAddress,
        pageSize,
        currentPage
      );
      
      setTrades(result.trades);
      setTotalTrades(result.totalCount);
    } catch (error) {
      console.error('Error fetching trading history:', error);
      console.error('Failed to fetch trading history. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {isInitialScan && (
        <div className="mb-4 p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">First-time scan in progress</h3>
              <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  We're scanning all of your historical transactions. This may take up to 2 minutes.
                  Future updates will be much faster.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {isLoading && (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground text-center">
            {isInitialScan 
              ? "First time scanning this wallet. This may take up to 2 minutes to register all historical transactions. This will be much faster next time."
              : "Loading trading history..."}
          </p>
        </div>
      )}
    </div>
  );
};

export default TradingHistory; 