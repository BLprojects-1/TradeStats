import { useState, useEffect } from 'react';
import { formatDate, formatTime } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { ChecklistItem, ChecklistItemType } from './TradeChecklist';
import { supabase } from '../utils/supabaseClient';

interface AddedTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
}

export default function AddedTokenModal({ 
  isOpen, 
  onClose, 
  tokenAddress, 
  tokenSymbol, 
  tokenLogoURI
}: AddedTokenModalProps) {
  const { user } = useAuth();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistCompletions, setChecklistCompletions] = useState<{[itemId: string]: boolean}>({});
  const [checklistTimestamps, setChecklistTimestamps] = useState<{[itemId: string]: string}>({});
  const [showSwingNotes, setShowSwingNotes] = useState(true);
  const [overallNotes, setOverallNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOverallNotes, setShowOverallNotes] = useState(false);

  useEffect(() => {
    if (isOpen && tokenAddress) {
      loadChecklist();
      loadOverallNotes();
    }
  }, [isOpen, tokenAddress]);

  const loadChecklist = async () => {
    if (!user?.id) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const loadOverallNotes = async () => {
    if (!user?.id) return;

    try {
      // Load overall notes from local storage
      const overallNotesKey = `token_notes_${user.id}_${tokenAddress}`;
      const savedOverallNotes = localStorage.getItem(overallNotesKey);
      if (savedOverallNotes) {
        setOverallNotes(savedOverallNotes);
      }
    } catch (error) {
      console.error('Error loading overall notes:', error);
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

  const saveOverallNotes = async () => {
    if (!user?.id) return;

    try {
      const overallNotesKey = `token_notes_${user.id}_${tokenAddress}`;
      localStorage.setItem(overallNotesKey, overallNotes);
    } catch (error) {
      console.error('Error saving overall notes:', error);
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
              <h2 className="text-xl font-semibold text-white">Token Info</h2>
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
          ) : (
            <div className="space-y-6">
              {/* Trade Checklist */}
              <div className="bg-[#252525] p-4 rounded-lg">
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

              {/* Overall Token Notes */}
              <div className="bg-[#252525] p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">Overall Token Notes</h3>
                  <button
                    onClick={() => setShowOverallNotes(!showOverallNotes)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg 
                      className={`w-5 h-5 transform transition-transform ${showOverallNotes ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {showOverallNotes && (
                  <div className="mt-3">
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 