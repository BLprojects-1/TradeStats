/**
 * Supabase Cache Service
 * 
 * This service provides caching for Supabase data to ensure that data is loaded once
 * per session and cached, so it doesn't need to be reloaded when navigating between pages.
 */

import { historicalPriceService } from './historicalPriceService';
import { processToOpenTrades, processToTopTrades, processToTradeLog, processToTradingHistory } from '../utils/historicalTradeProcessing';

// Types
interface AnalysisResult {
  recentTrades: any[];
  historicalTrades: Map<string, any[]>;
  totalTrades: number;
  totalVolume: number;
  uniqueTokens: Set<string>;
}

interface ProcessedData {
  openTrades: any[];
  topTrades: any[];
  tradeLog: any[];
  tradingHistory: any[];
}

interface CachedData {
  walletAddress: string;
  rawData: AnalysisResult | null;
  processedData: ProcessedData | null;
  timestamp: number;
}

class SupabaseCacheService {
  private cache: Map<string, CachedData> = new Map();
  private CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private currentlyLoading: Set<string> = new Set();
  private loadPromises: Map<string, Promise<AnalysisResult>> = new Map();

  /**
   * Get data for a wallet, either from cache or by loading from Supabase
   * @param walletAddress The wallet address to get data for
   * @param forceRefresh Whether to force a refresh of the data
   * @returns The analysis result for the wallet
   */
  async getWalletData(walletAddress: string, forceRefresh: boolean = false): Promise<AnalysisResult> {
    // Check if we already have a promise for this wallet
    if (this.loadPromises.has(walletAddress) && !forceRefresh) {
      return this.loadPromises.get(walletAddress)!;
    }

    // Check if we have cached data for this wallet
    const cachedData = this.cache.get(walletAddress);
    if (cachedData && cachedData.rawData && !forceRefresh && (Date.now() - cachedData.timestamp) < this.CACHE_DURATION) {
      console.log(`Using cached data for wallet ${walletAddress}`);
      return cachedData.rawData;
    }

    // If we're already loading data for this wallet, wait for it to complete
    if (this.currentlyLoading.has(walletAddress) && !forceRefresh) {
      console.log(`Already loading data for wallet ${walletAddress}, waiting...`);
      return this.loadPromises.get(walletAddress)!;
    }

    // Load data from Supabase
    console.log(`Loading data for wallet ${walletAddress}`);
    this.currentlyLoading.add(walletAddress);

    const loadPromise = historicalPriceService.analyzeWalletTrades(walletAddress)
      .then(result => {
        // Cache the result
        this.cache.set(walletAddress, {
          walletAddress,
          rawData: result,
          processedData: this.processData(result),
          timestamp: Date.now()
        });
        this.currentlyLoading.delete(walletAddress);
        this.loadPromises.delete(walletAddress);
        return result;
      })
      .catch(error => {
        console.error(`Error loading data for wallet ${walletAddress}:`, error);
        this.currentlyLoading.delete(walletAddress);
        this.loadPromises.delete(walletAddress);
        throw error;
      });

    this.loadPromises.set(walletAddress, loadPromise);
    return loadPromise;
  }

  /**
   * Get processed data for a wallet, either from cache or by processing raw data
   * @param walletAddress The wallet address to get data for
   * @param forceRefresh Whether to force a refresh of the data
   * @returns The processed data for the wallet
   */
  async getProcessedData(walletAddress: string, forceRefresh: boolean = false): Promise<ProcessedData> {
    // Get raw data first
    const rawData = await this.getWalletData(walletAddress, forceRefresh);
    
    // Check if we have cached processed data
    const cachedData = this.cache.get(walletAddress);
    if (cachedData && cachedData.processedData && !forceRefresh) {
      console.log(`Using cached processed data for wallet ${walletAddress}`);
      return cachedData.processedData;
    }

    // Process the data
    console.log(`Processing data for wallet ${walletAddress}`);
    const processedData = this.processData(rawData);

    // Update the cache
    this.cache.set(walletAddress, {
      walletAddress,
      rawData,
      processedData,
      timestamp: Date.now()
    });

    return processedData;
  }

  /**
   * Process raw data into different formats for different pages
   * @param rawData The raw data to process
   * @returns The processed data
   */
  private processData(rawData: AnalysisResult): ProcessedData {
    return {
      openTrades: processToOpenTrades(rawData),
      topTrades: processToTopTrades(rawData),
      tradeLog: processToTradeLog(rawData),
      tradingHistory: processToTradingHistory(rawData)
    };
  }

  /**
   * Clear the cache for a specific wallet
   * @param walletAddress The wallet address to clear the cache for
   */
  clearCache(walletAddress: string): void {
    this.cache.delete(walletAddress);
    console.log(`Cleared cache for wallet ${walletAddress}`);
  }

  /**
   * Clear the entire cache
   */
  clearAllCache(): void {
    this.cache.clear();
    console.log('Cleared all cache');
  }

  /**
   * Check if we have cached data for a wallet
   * @param walletAddress The wallet address to check
   * @returns Whether we have cached data for the wallet
   */
  hasCachedData(walletAddress: string): boolean {
    const cachedData = this.cache.get(walletAddress);
    return !!(cachedData && cachedData.rawData && (Date.now() - cachedData.timestamp) < this.CACHE_DURATION);
  }

  /**
   * Check if we're currently loading data for a wallet
   * @param walletAddress The wallet address to check
   * @returns Whether we're currently loading data for the wallet
   */
  isLoading(walletAddress: string): boolean {
    return this.currentlyLoading.has(walletAddress);
  }
}

// Export a singleton instance
export const supabaseCacheService = new SupabaseCacheService();