import { useState, useEffect } from 'react';
import { ProcessedTrade } from '../services/tradeProcessor';
import { tradingHistoryService } from '../services/tradingHistoryService';
import { formatTokenAmount, formatSmallPrice, formatDate, formatTime } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

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
  notes: string;
  createdAt: number;
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
  const [showSwingNotes, setShowSwingNotes] = useState(false);
  const [newSwingNote, setNewSwingNote] = useState({
    type: 'planned' as 'planned' | 'executed',
    sellPrice: '',
    buyPrice: '',
    amount: '',
    notes: ''
  });
  const [individualNotes, setIndividualNotes] = useState<{ [signature: string]: string }>({});
  const [overallNotes, setOverallNotes] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [swingPlan, setSwingPlan] = useState(initialSwingPlan);

  useEffect(() => {
    if (isOpen && tokenAddress) {
      loadTradeDetail();
      if (mode === 'open-trades') {
        loadSwingNotes();
      }
      if (mode === 'trade-log') {
        loadTradeNotes();
      }
    }
  }, [isOpen, tokenAddress, mode]);

  // Update swing plan when initialSwingPlan prop changes
  useEffect(() => {
    setSwingPlan(initialSwingPlan);
  }, [initialSwingPlan]);

  const handleSwingPlanChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPlan = e.target.value;
    setSwingPlan(newPlan);
    onSwingPlanChange?.(newPlan);
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

      const trades = result.trades;
      
      // Calculate detailed metrics
      const buys = trades.filter((t: ProcessedTrade) => t.type === 'BUY');
      const sells = trades.filter((t: ProcessedTrade) => t.type === 'SELL');
      
      const totalBought = buys.reduce((sum: number, trade: ProcessedTrade) => sum + (trade.amount || 0), 0);
      const totalSold = sells.reduce((sum: number, trade: ProcessedTrade) => sum + (trade.amount || 0), 0);
      const remaining = totalBought - totalSold;
      
      const totalBuyValue = buys.reduce((sum: number, trade: ProcessedTrade) => sum + (trade.valueUSD || 0), 0);
      const totalSellValue = sells.reduce((sum: number, trade: ProcessedTrade) => sum + (trade.valueUSD || 0), 0);
      
      // Get current price for unrealized P/L calculation
      const currentPrice = trades.length > 0 ? (trades[0].priceUSD || 0) : 0;
      const currentValue = remaining * currentPrice;
      
      const realizedPL = totalSellValue - (totalBuyValue * (totalSold / totalBought));
      const unrealizedPL = currentValue - (totalBuyValue * (remaining / totalBought));

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
    if (!user?.id || !tradeDetail) return;

    try {
      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, walletAddress);
      
      // Load individual trade notes
      const notes: { [signature: string]: string } = {};
      for (const trade of tradeDetail.trades) {
        if (trade.notes) {
          notes[trade.signature] = trade.notes;
        }
      }
      setIndividualNotes(notes);

      // Load overall token notes
      const overallNotesKey = `token_notes_${user.id}_${tokenAddress}`;
      const savedOverallNotes = localStorage.getItem(overallNotesKey);
      if (savedOverallNotes) {
        setOverallNotes(savedOverallNotes);
      }

    } catch (error) {
      console.error('Error loading trade notes:', error);
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
      createdAt: Date.now()
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
      notes: ''
    });
  };

  const saveIndividualNote = async (signature: string, notes: string) => {
    if (!user?.id) return;

    setSavingNote(true);
    try {
      const { walletId } = await tradingHistoryService.ensureWalletExists(user.id, walletAddress);
      await tradingHistoryService.updateTradeNotes(walletId, signature, notes, '');
      
      setIndividualNotes(prev => ({
        ...prev,
        [signature]: notes
      }));
      setEditingNote(null);
    } catch (error) {
      console.error('Error saving individual note:', error);
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

  const calculateTokensGained = () => {
    if (!newSwingNote.sellPrice || !newSwingNote.buyPrice || !newSwingNote.amount) return 0;
    
    const sellValue = parseFloat(newSwingNote.sellPrice) * parseFloat(newSwingNote.amount);
    const tokensGained = sellValue / parseFloat(newSwingNote.buyPrice);
    return tokensGained - parseFloat(newSwingNote.amount);
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
                  <p className="text-sm text-gray-400">{formatSmallPrice(tradeDetail.totalBuyValue)}</p>
                </div>
                <div className="bg-[#252525] p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Total Sold</h3>
                  <p className="text-lg font-semibold text-white">{formatTokenAmount(tradeDetail.totalSold)}</p>
                  <p className="text-sm text-gray-400">{formatSmallPrice(tradeDetail.totalSellValue)}</p>
                </div>
                <div className="bg-[#252525] p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Remaining</h3>
                  <p className="text-lg font-semibold text-white">{formatTokenAmount(tradeDetail.remaining)}</p>
                  <p className="text-sm text-gray-400">{formatSmallPrice(tradeDetail.remaining * tradeDetail.currentPrice)}</p>
                </div>
                <div className="bg-[#252525] p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    {mode === 'open-trades' ? 'Unrealized P/L' : 'Total P/L'}
                  </h3>
                  <p className={`text-lg font-semibold ${(tradeDetail.unrealizedPL + tradeDetail.realizedPL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatSmallPrice(tradeDetail.unrealizedPL + tradeDetail.realizedPL)}
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
                <h3 className="text-lg font-semibold text-indigo-200 mb-2">Swing Plan</h3>
                <textarea
                  value={swingPlan}
                  onChange={handleSwingPlanChange}
                  placeholder="Enter your swing trading plan here (e.g., buy at $X, sell at $Y)..."
                  className="w-full h-24 bg-[#1a1a1a] text-white rounded-md p-2 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  aria-label="Swing trading plan"
                />
              </div>

              {/* Transactions List */}
              <div className="bg-[#252525] p-4 rounded-lg">
                <h3 className="text-lg font-medium text-white mb-4">All Transactions</h3>
                <div className="space-y-3">
                  {tradeDetail.trades.map((trade) => (
                    <div key={trade.signature} className="bg-[#1a1a1a] p-4 rounded-lg">
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
                            @ {formatSmallPrice(trade.priceUSD || 0)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-medium">{formatSmallPrice(trade.valueUSD || 0)}</div>
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
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveIndividualNote(trade.signature, individualNotes[trade.signature] || '')}
                                  disabled={savingNote}
                                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-3 py-1 rounded text-sm"
                                >
                                  Save
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
              </div>

              {/* Swing Notes Section for Open Trades */}
              {mode === 'open-trades' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setShowSwingNotes(!showSwingNotes)}
                    className="w-full bg-[#252525] p-4 rounded-lg text-left hover:bg-[#2a2a2a] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-white">Position Management Notes</h3>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transform transition-transform ${showSwingNotes ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {showSwingNotes && (
                    <div className="bg-[#252525] p-4 rounded-lg space-y-6">
                      {/* Add New Note */}
                      <div className="space-y-4">
                        <h4 className="text-md font-medium text-white">Add Position Note</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Type</label>
                            <select
                              value={newSwingNote.type}
                              onChange={(e) => setNewSwingNote(prev => ({ ...prev, type: e.target.value as 'planned' | 'executed' }))}
                              className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="planned">Planned Trade</option>
                              <option value="executed">Executed Trade</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Amount</label>
                            <input
                              type="number"
                              value={newSwingNote.amount}
                              onChange={(e) => setNewSwingNote(prev => ({ ...prev, amount: e.target.value }))}
                              placeholder="Token amount"
                              className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Sell Price</label>
                            <input
                              type="number"
                              value={newSwingNote.sellPrice}
                              onChange={(e) => setNewSwingNote(prev => ({ ...prev, sellPrice: e.target.value }))}
                              placeholder="USD price"
                              step="0.000001"
                              className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Buy Back Price</label>
                            <input
                              type="number"
                              value={newSwingNote.buyPrice}
                              onChange={(e) => setNewSwingNote(prev => ({ ...prev, buyPrice: e.target.value }))}
                              placeholder="USD price"
                              step="0.000001"
                              className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        
                        {/* Token Gain Calculator */}
                        {newSwingNote.sellPrice && newSwingNote.buyPrice && newSwingNote.amount && (
                          <div className="bg-[#1a1a1a] p-3 rounded-md">
                            <div className="text-sm text-gray-400">Potential Tokens Gained:</div>
                            <div className="text-lg font-semibold text-green-400">
                              +{formatTokenAmount(calculateTokensGained())} {tokenSymbol}
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Notes</label>
                          <textarea
                            value={newSwingNote.notes}
                            onChange={(e) => setNewSwingNote(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Strategy notes, reasoning, etc..."
                            className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                          />
                        </div>

                        <button
                          onClick={saveSwingNote}
                          disabled={!newSwingNote.notes.trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md"
                        >
                          Save Note
                        </button>
                      </div>

                      {/* Existing Notes */}
                      {swingNotes.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-md font-medium text-white">Previous Notes</h4>
                          {swingNotes.map((note) => (
                            <div key={note.id} className="bg-[#1a1a1a] p-3 rounded-md">
                              <div className="flex items-center justify-between mb-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  note.type === 'planned' ? 'bg-blue-900 text-blue-200' : 'bg-green-900 text-green-200'
                                }`}>
                                  {note.type === 'planned' ? 'Planned' : 'Executed'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {formatDate(note.createdAt)} {formatTime(note.createdAt)}
                                </span>
                              </div>
                              {(note.sellPrice || note.buyPrice || note.amount) && (
                                <div className="text-sm text-gray-300 mb-2">
                                  {note.amount && `${formatTokenAmount(note.amount)} ${tokenSymbol}`}
                                  {note.sellPrice && ` @ $${note.sellPrice}`}
                                  {note.buyPrice && ` → $${note.buyPrice}`}
                                </div>
                              )}
                              <div className="text-sm text-white">{note.notes}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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