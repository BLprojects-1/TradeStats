import { useState, useEffect } from 'react';
import { ProcessedTrade } from '../services/tradeProcessor';
import { tradingHistoryService } from '../services/tradingHistoryService';
import { formatTokenAmount, formatSmallPrice, formatDate, formatTime, formatPriceWithTwoDecimals } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { jupiterApiService } from '../services/jupiterApiService';
import { ChecklistItem, ChecklistItemType } from './TradeChecklist';
import { supabase } from '../utils/supabaseClient';

interface TradeInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
  walletAddress: string;
  mode: 'top-trades' | 'open-trades' | 'trade-log';
  initialTrade?: ProcessedTrade; // For trade-log mode
  initialSwingPlan?: string;
  onSwingPlanChange?: (plan: string) => void;
}

interface SwingNote {
  id: string;
  type: 'planned' | 'executed';
  sellPrice?: number;
  buyPrice?: number;
  amount?: number;
  sellPercentage?: number;
  targetProfit?: number;
  stopLoss?: number;
  notes: string;
  createdAt: number;
  status?: 'pending' | 'completed' | 'cancelled';
}

interface TokenTradeDetail {
  totalBought: number;
  totalSold: number;
  remaining: number;
  totalBuyValue: number;
  totalSellValue: number;
  unrealizedPL: number;
  realizedPL: number;
  currentPrice: number;
  trades: ProcessedTrade[];
  averageEntryPrice?: number;
  breakEvenPrice?: number;
}

export default function TradeInfoModal({ 
  isOpen, 
  onClose, 
  tokenAddress, 
  tokenSymbol, 
  tokenLogoURI, 
  walletAddress, 
  mode,
  initialTrade,
  initialSwingPlan = '',
  onSwingPlanChange
}: TradeInfoModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tradeDetail, setTradeDetail] = useState<TokenTradeDetail | null>(null);
  const [swingNotes, setSwingNotes] = useState<SwingNote[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistCompletions, setChecklistCompletions] = useState<{[itemId: string]: boolean}>({});
  const [checklistTimestamps, setChecklistTimestamps] = useState<{[itemId: string]: string}>({});
  const [showSwingNotes, setShowSwingNotes] = useState(false);
  const [newSwingNote, setNewSwingNote] = useState({
    type: 'planned' as 'planned' | 'executed',
    sellPrice: '',
    buyPrice: '',
    amount: '',
    sellPercentage: '',
    targetProfit: '',
    stopLoss: '',
    notes: '',
    status: 'pending' as 'pending' | 'completed' | 'cancelled'
  });
  const [individualNotes, setIndividualNotes] = useState<{ [signature: string]: string }>({});
  const [overallNotes, setOverallNotes] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [individualNoteSaved, setIndividualNoteSaved] = useState<string | null>(null);
  const [swingPlan, setSwingPlan] = useState(initialSwingPlan);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'value' | 'size'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [savingTradeNotes, setSavingTradeNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [loadingTradeNotes, setLoadingTradeNotes] = useState(false);

  useEffect(() => {
    if (isOpen && tokenAddress) {
      loadTradeDetail();
      loadSwingNotes();
      loadChecklist();
    }
  }, [isOpen, tokenAddress]);

  // Separate useEffect to load trade notes after tradeDetail is available
  useEffect(() => {
    console.log('useEffect for loadTradeNotes triggered with:', {
      isOpen,
      tokenAddress,
      tradeDetailExists: !!tradeDetail,
      mode
    });
    if (isOpen && tokenAddress && tradeDetail && (mode === 'trade-log' || mode === 'open-trades')) {
      console.log('Conditions met, calling loadTradeNotes');
      loadTradeNotes();
    } else {
      console.log('Conditions not met for loadTradeNotes:', {
        isOpen,
        tokenAddressExists: !!tokenAddress,
        tradeDetailExists: !!tradeDetail,
        isTradeLogOrOpenTradesMode: (mode === 'trade-log' || mode === 'open-trades')
      });
    }
  }, [isOpen, tokenAddress, tradeDetail, mode]);

  // Update swing plan when initialSwingPlan prop changes
  useEffect(() => {
    console.log('useEffect for initialSwingPlan triggered with:', initialSwingPlan);
    console.log('Current swingPlan state before update:', swingPlan);
    setSwingPlan(initialSwingPlan);
    console.log('Setting swingPlan state to:', initialSwingPlan);
  }, [initialSwingPlan]);

  const handleSwingPlanChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPlan = e.target.value;
    console.log('handleSwingPlanChange called with new value:', newPlan);
    setSwingPlan(newPlan);
    console.log('Setting swingPlan state to:', newPlan);
    if (onSwingPlanChange) {
      console.log('Calling onSwingPlanChange with new plan');
      onSwingPlanChange(newPlan);
    } else {
      console.log('onSwingPlanChange callback not provided');
    }
  };

  /**
   * Deduplicate trades based on signature
   * @param trades The trades to deduplicate
   * @returns An array of unique trades
   */
  const deduplicateTrades = (trades: ProcessedTrade[]): ProcessedTrade[] => {
    console.log('🔄 Starting deduplication process for trade info modal...');

    // Use a Map to keep only the first occurrence of each signature
    const uniqueTradesMap = new Map();
    let tradesWithSignature = 0;
    let tradesWithoutSignature = 0;

    for (const trade of trades) {
      // Check if signature exists and is not null/empty
      if (trade.signature && trade.signature !== null && trade.signature !== '') {
        tradesWithSignature++;
        if (!uniqueTradesMap.has(trade.signature)) {
          uniqueTradesMap.set(trade.signature, trade);
        }
      } else {
        tradesWithoutSignature++;
        // For trades without signature, create a unique key using other fields
        const uniqueKey = `${trade.tokenAddress}_${trade.timestamp}_${trade.type}_${trade.amount}_${trade.valueUSD}`;
        if (!uniqueTradesMap.has(uniqueKey)) {
          uniqueTradesMap.set(uniqueKey, trade);
        }
      }
    }

    console.log('📊 Trade info modal deduplication stats:');
    console.log('  - Original trades count:', trades.length);
    console.log('  - Trades with signature:', tradesWithSignature);
    console.log('  - Trades without signature:', tradesWithoutSignature);
    console.log('  - Unique trades after deduplication:', uniqueTradesMap.size);

    return Array.from(uniqueTradesMap.values());
  };

  const loadTradeDetail = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Get all trades for this specific token
      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, walletAddress);

      // Get all-time trades for this token to ensure accuracy
      const result = await tradingHistoryService.getAllTokenTrades(
        user.id,
        walletAddress,
        tokenAddress
      );

      // Deduplicate trades to ensure we don't count the same trade multiple times
      const trades = deduplicateTrades(result.trades);

      // Calculate detailed metrics
      const buys = trades.filter((t: ProcessedTrade) => t.type === 'BUY');
      const sells = trades.filter((t: ProcessedTrade) => t.type === 'SELL');

      // Ensure we're using absolute values for token amounts
      const totalBought = buys.reduce((sum: number, trade: ProcessedTrade) => sum + Math.abs(trade.amount || 0), 0);
      const totalSold = sells.reduce((sum: number, trade: ProcessedTrade) => sum + Math.abs(trade.amount || 0), 0);
      const remaining = totalBought - totalSold;

      // Ensure we're using absolute values for USD values
      const totalBuyValue = buys.reduce((sum: number, trade: ProcessedTrade) => sum + Math.abs(trade.valueUSD || 0), 0);
      const totalSellValue = sells.reduce((sum: number, trade: ProcessedTrade) => sum + Math.abs(trade.valueUSD || 0), 0);

      // Get current price for unrealized P/L calculation
      const currentPrice = trades.length > 0 ? Math.abs(trades[0].priceUSD || 0) : 0;
      const currentValue = remaining * currentPrice;

      // Calculate cost basis for sold tokens
      const soldCostBasis = totalBought > 0 ? totalBuyValue * (totalSold / totalBought) : 0;

      // Calculate realized P/L (from sold tokens)
      const realizedPL = totalSellValue - soldCostBasis;

      // Calculate remaining cost basis
      const remainingCostBasis = totalBuyValue - soldCostBasis;

      // Calculate unrealized P/L (from remaining tokens)
      const unrealizedPL = currentValue - remainingCostBasis;

      setTradeDetail({
        totalBought,
        totalSold,
        remaining,
        totalBuyValue,
        totalSellValue,
        unrealizedPL,
        realizedPL,
        currentPrice,
        trades: trades.sort((a, b) => b.timestamp - a.timestamp)
      });

    } catch (error) {
      console.error('Error loading trade detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSwingNotes = async () => {
    if (!user?.id) return;

    try {
      // Load swing notes from local storage or database
      const notesKey = `swing_notes_${user.id}_${tokenAddress}`;
      const savedNotes = localStorage.getItem(notesKey);
      if (savedNotes) {
        setSwingNotes(JSON.parse(savedNotes));
      }
    } catch (error) {
      console.error('Error loading swing notes:', error);
    }
  };

  const loadTradeNotes = async () => {
    console.log('loadTradeNotes called with user:', user?.id, 'tradeDetail:', !!tradeDetail, 'tokenAddress:', tokenAddress);
    if (!user?.id || !tradeDetail) return;

    setLoadingTradeNotes(true);
    try {
      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, walletAddress);
      console.log('Wallet ID retrieved:', walletId);

      // Get all trades for this token from Supabase to ensure we have the latest notes
      console.log('Loading trade notes from Supabase for token:', tokenAddress);
      const result = await tradingHistoryService.getAllTokenTrades(
        user.id,
        walletAddress,
        tokenAddress
      );
      console.log('Loaded', result.trades.length, 'trades from Supabase');

      // Find the first trade with notes
      const tradesWithNotes = result.trades.filter(trade => trade.notes && trade.notes.trim() !== '');
      console.log('Found', tradesWithNotes.length, 'trades with notes');

      // Only use the first trade with notes for both individual notes and swing plan
      if (tradesWithNotes.length > 0) {
        const firstTradeWithNotes = tradesWithNotes[0];
        console.log('Using first trade with notes:', {
          signature: firstTradeWithNotes.signature,
          note: firstTradeWithNotes.notes
        });

        // Set individual notes with just this one trade
        const notes: { [signature: string]: string } = {
          [firstTradeWithNotes.signature]: firstTradeWithNotes.notes || ''
        };
        console.log('Setting individualNotes state with just the first trade with notes:', notes);
        setIndividualNotes(notes);
      } else {
        console.log('No trades with notes found');
        setIndividualNotes({});
      }

      // Log all trades with notes for debugging
      tradesWithNotes.forEach((trade, index) => {
        console.log(`Trade ${index} with note:`, {
          signature: trade.signature,
          note: trade.notes
        });
      });

      if (tradesWithNotes.length > 0) {
        const noteFromSupabase = tradesWithNotes[0].notes;
        console.log('Using note from Supabase for swing plan:', noteFromSupabase);
        console.log('Current swingPlan state before update:', swingPlan);

        // Force update the swingPlan state
        setSwingPlan(noteFromSupabase || '');
        console.log('Setting swingPlan state to:', noteFromSupabase);

        // Call the callback if provided to update the parent component
        if (onSwingPlanChange) {
          console.log('Calling onSwingPlanChange with note from Supabase');
          onSwingPlanChange(noteFromSupabase || '');
        } else {
          console.log('onSwingPlanChange callback not provided');
        }
      } else {
        console.log('No trades with notes found in Supabase, falling back to local storage');
        // Fallback to local storage if no notes found in Supabase
        // Load overall token notes
        const overallNotesKey = `token_notes_${user.id}_${tokenAddress}`;
        const savedOverallNotes = localStorage.getItem(overallNotesKey);
        if (savedOverallNotes) {
          setOverallNotes(savedOverallNotes);
        }

        // Load swing plan
        const swingPlanKey = `swing_plan_${user.id}_${tokenAddress}`;
        const savedSwingPlan = localStorage.getItem(swingPlanKey);
        if (savedSwingPlan) {
          setSwingPlan(savedSwingPlan);
          // Call the callback if provided to update the parent component
          if (onSwingPlanChange) {
            onSwingPlanChange(savedSwingPlan);
          }
        }
      }

    } catch (error) {
      console.error('Error loading trade notes:', error);
    } finally {
      setLoadingTradeNotes(false);
    }
  };

  const loadChecklist = async () => {
    if (!user?.id) return;
    try {
      // Load checklist items (templates)
      const { data: itemsData, error: itemsError } = await supabase
        .from('trade_checklist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('Error loading checklist items:', itemsError);
        setChecklistItems([]);
        return;
      }

      // Transform Supabase data to match our interface
      const transformedItems: ChecklistItem[] = itemsData.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type as ChecklistItemType,
        value: item.value,
        minValue: item.min_value,
        maxValue: item.max_value,
        textValue: item.text_values && item.text_values.length > 0 ? item.text_values[0] : undefined,
        completed: false, // This will be set from completions
        description: item.description,
      }));

      setChecklistItems(transformedItems);

      // Load completion states for this specific token
      const { data: completionsData, error: completionsError } = await supabase
        .from('trade_checklist_completions')
        .select('checklist_item_id, completed, completed_at')
        .eq('user_id', user.id)
        .eq('token_address', tokenAddress);

      if (completionsError) {
        console.error('Error loading checklist completions:', completionsError);
        setChecklistCompletions({});
        setChecklistTimestamps({});
        return;
      }

      // Create completion state map and timestamp map
      const completionMap: {[itemId: string]: boolean} = {};
      const timestampMap: {[itemId: string]: string} = {};
      completionsData.forEach(completion => {
        completionMap[completion.checklist_item_id] = completion.completed;
        if (completion.completed_at) {
          timestampMap[completion.checklist_item_id] = completion.completed_at;
        }
      });

      setChecklistCompletions(completionMap);
      setChecklistTimestamps(timestampMap);
    } catch (error) {
      console.error('Error loading checklist:', error);
      setChecklistItems([]);
      setChecklistCompletions({});
      setChecklistTimestamps({});
    }
  };

  const toggleItemCompletion = async (id: string) => {
    if (!user?.id) return;

    const currentCompleted = checklistCompletions[id] || false;
    const newCompleted = !currentCompleted;
    const completedAt = newCompleted ? new Date().toISOString() : null;

    try {
      // Upsert completion record
      const { error } = await supabase
        .from('trade_checklist_completions')
        .upsert({
          user_id: user.id,
          checklist_item_id: id,
          token_address: tokenAddress,
          completed: newCompleted,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,checklist_item_id,token_address'
        });

      if (error) {
        console.error('Error updating checklist completion:', error);
        return;
      }

      // Update local state
      setChecklistCompletions(prev => ({
        ...prev,
        [id]: newCompleted
      }));

      // Update timestamp state
      setChecklistTimestamps(prev => {
        if (newCompleted && completedAt) {
          return { ...prev, [id]: completedAt };
        } else {
          const { [id]: removed, ...rest } = prev;
          return rest;
        }
      });
    } catch (error) {
      console.error('Error updating checklist completion:', error);
    }
  };

  const updateItemValue = async (id: string, value: any, field: 'value' | 'minValue' | 'maxValue' | 'textValue') => {
    if (!user?.id) return;

    try {
      // Map React field names to database column names
      const dbField = field === 'minValue' ? 'min_value' 
                    : field === 'maxValue' ? 'max_value'
                    : field === 'textValue' ? 'text_values'
                    : field;

      // For text values, we need to store as array
      const dbValue = field === 'textValue' ? (value ? [value] : null) : value;

      const { error } = await supabase
        .from('trade_checklist_items')
        .update({
          [dbField]: dbValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating checklist item:', error);
        return;
      }

      // Update local state
      const updatedItems = checklistItems.map(item => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      });
      setChecklistItems(updatedItems);
    } catch (error) {
      console.error('Error updating checklist item:', error);
    }
  };

  const saveSwingNote = async () => {
    if (!user?.id || !newSwingNote.notes.trim()) return;

    const note: SwingNote = {
      id: Date.now().toString(),
      type: newSwingNote.type,
      sellPrice: newSwingNote.sellPrice ? parseFloat(newSwingNote.sellPrice) : undefined,
      buyPrice: newSwingNote.buyPrice ? parseFloat(newSwingNote.buyPrice) : undefined,
      amount: newSwingNote.amount ? parseFloat(newSwingNote.amount) : undefined,
      notes: newSwingNote.notes,
      createdAt: Date.now(),
      status: newSwingNote.status
    };

    const updatedNotes = [...swingNotes, note];
    setSwingNotes(updatedNotes);

    // Save to local storage
    const notesKey = `swing_notes_${user.id}_${tokenAddress}`;
    localStorage.setItem(notesKey, JSON.stringify(updatedNotes));

    // Reset form
    setNewSwingNote({
      type: 'planned',
      sellPrice: '',
      buyPrice: '',
      amount: '',
      sellPercentage: '',
      targetProfit: '',
      stopLoss: '',
      notes: '',
      status: 'pending'
    });
  };

  const saveIndividualNote = async (signature: string, notes: string) => {
    if (!user?.id) return;

    setSavingNote(true);
    setIndividualNoteSaved(null);
    try {
      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, walletAddress);
      await tradingHistoryService.updateTradeNotes(walletId, signature, notes, '', tokenAddress);
      console.log('Successfully saved individual note for trade signature:', signature, 'for token:', tokenAddress);

      setIndividualNotes(prev => ({
        ...prev,
        [signature]: notes
      }));
      setEditingNote(null);

      // Show success message
      setIndividualNoteSaved(signature);

      // Reset success message after 3 seconds
      setTimeout(() => {
        setIndividualNoteSaved(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving individual note for signature:', signature, 'for token:', tokenAddress, error);
    } finally {
      setSavingNote(false);
    }
  };

  const saveOverallNotes = async () => {
    if (!user?.id) return;

    try {
      const overallNotesKey = `token_notes_${user.id}_${tokenAddress}`;
      localStorage.setItem(overallNotesKey, overallNotes);
    } catch (error) {
      console.error('Error saving overall notes:', error);
    }
  };

  const saveTradeNotes = async () => {
    if (!user?.id || !tradeDetail) return;

    setSavingTradeNotes(true);
    setNotesSaved(false);
    try {
      console.log('Saving trade notes for', tradeDetail.trades.length, 'trades with swingPlan:', swingPlan);
      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, walletAddress);

      // Save notes for all trades of this token
      for (const trade of tradeDetail.trades) {
        // Log more details about the trade to help with debugging
        console.log('Processing trade:', {
          signature: trade.signature,
          tokenSymbol: trade.tokenSymbol,
          timestamp: new Date(trade.timestamp).toISOString(),
          type: trade.type
        });

        try {
          await tradingHistoryService.updateTradeNotes(walletId, trade.signature, swingPlan, '', tokenAddress);
          console.log('Successfully saved note for trade signature:', trade.signature, 'for token:', tokenAddress);
        } catch (noteError) {
          console.error('Error saving note for trade signature:', trade.signature, 'for token:', tokenAddress, noteError);
          // Continue with other trades even if one fails
        }
      }

      // Also update local storage for backward compatibility
      const swingPlanKey = `swing_plan_${user.id}_${tokenAddress}`;
      localStorage.setItem(swingPlanKey, swingPlan);
      console.log('Trade notes saved successfully to local storage with key:', swingPlanKey);

      // Call the callback if provided
      if (onSwingPlanChange) {
        console.log('Calling onSwingPlanChange callback with swingPlan:', swingPlan);
        onSwingPlanChange(swingPlan);
      }

      // Show success message
      setNotesSaved(true);

      // Reset success message after 3 seconds
      setTimeout(() => {
        setNotesSaved(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving trade notes:', error);
    } finally {
      setSavingTradeNotes(false);
    }
  };

  const calculateTokensGained = () => {
    if (!newSwingNote.sellPrice || !newSwingNote.buyPrice || !newSwingNote.amount) return 0;

    const sellValue = parseFloat(newSwingNote.sellPrice) * parseFloat(newSwingNote.amount);
    const tokensGained = sellValue / parseFloat(newSwingNote.buyPrice);
    return tokensGained - parseFloat(newSwingNote.amount);
  };

  const calculateProfitPercentage = () => {
    if (!newSwingNote.sellPrice || !newSwingNote.buyPrice) return 0;
    return ((parseFloat(newSwingNote.sellPrice) - parseFloat(newSwingNote.buyPrice)) / parseFloat(newSwingNote.buyPrice)) * 100;
  };

  const calculateSellAmount = () => {
    if (!newSwingNote.sellPercentage || !tradeDetail?.remaining) return 0;
    return (parseFloat(newSwingNote.sellPercentage) / 100) * tradeDetail.remaining;
  };

  const sortTrades = (trades: ProcessedTrade[]) => {
    return [...trades].sort((a, b) => {
      let valueA: number;
      let valueB: number;

      switch (sortBy) {
        case 'time':
          valueA = a.timestamp;
          valueB = b.timestamp;
          break;
        case 'value':
          valueA = Math.abs(a.valueUSD || 0);
          valueB = Math.abs(b.valueUSD || 0);
          break;
        case 'size':
          valueA = Math.abs(a.amount || 0);
          valueB = Math.abs(b.amount || 0);
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
  };

  const handleSort = (newSortBy: 'time' | 'value' | 'size') => {
    if (sortBy === newSortBy) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc for value/size, desc for time (newest first)
      setSortBy(newSortBy);
      setSortOrder(newSortBy === 'time' ? 'desc' : 'desc');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            {tokenLogoURI && (
              <img src={tokenLogoURI} alt={tokenSymbol} className="w-8 h-8 rounded-full" />
            )}
            <div>
              <h2 className="text-xl font-semibold text-white">Trade Info</h2>
              <p className="text-gray-400">{tokenSymbol}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : tradeDetail ? (
            <div className="space-y-6">
              {/* Trade Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#252525] p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Total Bought</h3>
                  <p className="text-lg font-semibold text-white">{formatTokenAmount(tradeDetail.totalBought)}</p>
                  <p className="text-sm text-gray-400">{formatPriceWithTwoDecimals(tradeDetail.totalBuyValue)}</p>
                </div>
                <div className="bg-[#252525] p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Total Sold</h3>
                  <p className="text-lg font-semibold text-white">{formatTokenAmount(tradeDetail.totalSold)}</p>
                  <p className="text-sm text-gray-400">{formatPriceWithTwoDecimals(tradeDetail.totalSellValue)}</p>
                </div>
                <div className="bg-[#252525] p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Remaining</h3>
                  <p className="text-lg font-semibold text-white">{formatTokenAmount(tradeDetail.remaining)}</p>
                  <p className="text-sm text-gray-400">{formatPriceWithTwoDecimals(tradeDetail.remaining * tradeDetail.currentPrice)}</p>
                </div>
                <div className="bg-[#252525] p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    {mode === 'open-trades' ? 'Unrealized P/L' : 'Total P/L'}
                  </h3>
                  <p className={`text-lg font-semibold ${(tradeDetail.unrealizedPL + tradeDetail.realizedPL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPriceWithTwoDecimals(tradeDetail.unrealizedPL + tradeDetail.realizedPL)}
                  </p>
                </div>
              </div>

              {/* Trade Log Mode - Overall Notes */}
              {mode === 'trade-log' && (
                <div className="bg-[#252525] p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-white mb-3">Overall Token Notes</h3>
                  <textarea
                    value={overallNotes}
                    onChange={(e) => setOverallNotes(e.target.value)}
                    onBlur={saveOverallNotes}
                    placeholder="Add notes about this token in general..."
                    className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>
              )}

              {/* Add Swing Plan section before the trade list */}
              <div className="bg-[#252525] rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-indigo-200">Trade Notes</h3>
                  <div className="flex items-center">
                    {notesSaved && (
                      <span className="text-green-400 mr-3 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved!
                      </span>
                    )}
                    <button
                      onClick={saveTradeNotes}
                      disabled={savingTradeNotes}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-3 py-1 rounded text-sm flex items-center"
                    >
                      {savingTradeNotes ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </div>
                {/* Debug info removed: console.log('Rendering textarea with swingPlan:', swingPlan) */}
                {loadingTradeNotes ? (
                  <div className="flex items-center justify-center h-24 bg-[#1a1a1a] rounded-md border border-gray-700">
                    <svg className="animate-spin h-6 w-6 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : (
                  <textarea
                    value={swingPlan}
                    onChange={handleSwingPlanChange}
                    placeholder="Enter your swing trading plan here (e.g., buy at $X, sell at $Y)..."
                    className="w-full h-24 bg-[#1a1a1a] text-white rounded-md p-2 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    aria-label="Swing trading plan"
                  />
                )}
              </div>

              {/* Position Management Notes - Available for all modes */}
              <div className="bg-[#252525] p-4 rounded-lg mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">Trade Checklist</h3>
                  <button
                    onClick={() => setShowSwingNotes(!showSwingNotes)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg 
                      className={`w-5 h-5 transform transition-transform ${showSwingNotes ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {showSwingNotes && (
                  <div className="mt-4 space-y-6">
                    {/* Checklist Items */}
                    <div className="space-y-4">
                      {checklistItems.length === 0 ? (
                        <div className="bg-[#1a1a1a] p-6 rounded-lg text-center">
                          <div className="flex flex-col items-center space-y-3">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                              <h4 className="text-lg font-medium text-white mb-1">No Checklist Items</h4>
                              <p className="text-gray-400 text-sm mb-4">You haven't created any checklist items yet. Create your personalized trading criteria to maintain consistency in your trading decisions.</p>
                              <button
                                onClick={() => {
                                  onClose();
                                  // Navigate to trade checklist page
                                  window.location.href = '/trade-checklist';
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              >
                                Create Checklist Items
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        checklistItems.map((item) => (
                          <div key={item.id} className="bg-[#1a1a1a] p-4 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={checklistCompletions[item.id] || false}
                                  onChange={() => toggleItemCompletion(item.id)}
                                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                                <span className={`text-lg font-medium ${(checklistCompletions[item.id] || false) ? 'text-gray-500 line-through' : 'text-white'}`}>
                                  {item.name}
                                </span>
                                {/* Show completion timestamp */}
                                {checklistCompletions[item.id] && checklistTimestamps[item.id] && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Completed {formatDate(new Date(checklistTimestamps[item.id]).getTime())} at {formatTime(new Date(checklistTimestamps[item.id]).getTime())}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 ml-8">
                              {(item.type === 'yes' || item.type === 'no') && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-gray-400">Type:</span>
                                  <span className={
                                    item.type === 'yes'
                                      ? 'inline-block px-3 py-1 rounded-full bg-green-900 text-green-400 text-sm font-semibold'
                                      : 'inline-block px-3 py-1 rounded-full bg-red-900 text-red-400 text-sm font-semibold'
                                  }>
                                    {item.type === 'yes' ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )}

                              {item.type === 'between' && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm text-gray-400 mb-1">Min Value</label>
                                    <input
                                      type="number"
                                      value={item.minValue || ''}
                                      onChange={(e) => updateItemValue(item.id, parseFloat(e.target.value) || '', 'minValue')}
                                      className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm text-gray-400 mb-1">Max Value</label>
                                    <input
                                      type="number"
                                      value={item.maxValue || ''}
                                      onChange={(e) => updateItemValue(item.id, parseFloat(e.target.value) || '', 'maxValue')}
                                      className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                </div>
                              )}

                              {(item.type === 'more_than' || item.type === 'less_than') && (
                                <div>
                                  <label className="block text-sm text-gray-400 mb-1">Value</label>
                                  <input
                                    type="number"
                                    value={item.value || ''}
                                    onChange={(e) => updateItemValue(item.id, parseFloat(e.target.value) || '', 'value')}
                                    className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              )}

                              {item.type === 'text' && (
                                <div>
                                  <label className="block text-sm text-gray-400 mb-1">Text Value</label>
                                  <input
                                    type="text"
                                    value={item.textValue || ''}
                                    onChange={(e) => updateItemValue(item.id, e.target.value, 'textValue')}
                                    className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions List */}
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">All Transactions</h3>
                  {/* Sorting Controls */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">Sort by:</span>
                    <button
                      onClick={() => handleSort('time')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        sortBy === 'time'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Time {sortBy === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => handleSort('value')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        sortBy === 'value'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Value {sortBy === 'value' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => handleSort('size')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        sortBy === 'size'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {(showAllTransactions ? sortTrades(tradeDetail.trades) : sortTrades(tradeDetail.trades).slice(0, 10)).map((trade, index) => (
                    <div key={trade.signature || `trade-${index}`} className="bg-[#1a1a1a] p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            trade.type === 'BUY' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                          }`}>
                            {trade.type}
                          </span>
                          <span className="text-white font-medium">
                            {formatTokenAmount(trade.amount || 0)} {tokenSymbol}
                          </span>
                          <span className="text-gray-400">
                            @ {formatPriceWithTwoDecimals(trade.priceUSD || 0)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-medium">{formatPriceWithTwoDecimals(trade.valueUSD || 0)}</div>
                          <div className="text-xs text-gray-400">
                            {formatDate(trade.timestamp)} {formatTime(trade.timestamp)}
                          </div>
                        </div>
                      </div>

                      {/* Individual Notes for Trade Log Mode */}
                      {mode === 'trade-log' && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          {editingNote === trade.signature ? (
                            <div className="space-y-2">
                              <textarea
                                value={individualNotes[trade.signature] || ''}
                                onChange={(e) => setIndividualNotes(prev => ({
                                  ...prev,
                                  [trade.signature]: e.target.value
                                }))}
                                placeholder="Add notes for this specific transaction..."
                                className="w-full px-3 py-2 bg-[#23232b] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                rows={2}
                              />
                              <div className="flex gap-2 items-center">
                                {individualNoteSaved === trade.signature && (
                                  <span className="text-green-400 mr-2 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Saved!
                                  </span>
                                )}
                                <button
                                  onClick={() => saveIndividualNote(trade.signature, individualNotes[trade.signature] || '')}
                                  disabled={savingNote}
                                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-3 py-1 rounded text-sm"
                                >
                                  {savingNote && editingNote === trade.signature ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingNote(null)}
                                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => setEditingNote(trade.signature)}
                              className="cursor-pointer text-sm text-gray-400 hover:text-gray-300 transition-colors"
                            >
                              {individualNotes[trade.signature] || 'Click to add notes for this transaction...'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {tradeDetail.trades.length > 10 && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => setShowAllTransactions(!showAllTransactions)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      {showAllTransactions ? 'Show Less' : `See All (${tradeDetail.trades.length})`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              Failed to load trade details
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
