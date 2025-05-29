import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export type ChecklistItemType = 'yes' | 'no' | 'between' | 'more_than' | 'less_than' | 'text';

export interface ChecklistItem {
  id: string;
  name: string;
  type: ChecklistItemType;
  value?: string | number;
  minValue?: number;
  maxValue?: number;
  textValue?: string;
  completed: boolean;
  description?: string;
}

const TradeChecklist: React.FC = () => {
  const { user } = useAuth();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<ChecklistItemType>('yes');
  const [newItemValue, setNewItemValue] = useState<string | number>('');
  const [newItemMinValue, setNewItemMinValue] = useState<number | ''>('');
  const [newItemMaxValue, setNewItemMaxValue] = useState<number | ''>('');
  const [newItemTextValue, setNewItemTextValue] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadChecklist();
    }
  }, [user?.id]);

  const loadChecklist = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('trade_checklist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading checklist:', error);
        setChecklistItems([]);
        return;
      }

      // Transform Supabase data to match our interface
      const transformedItems: ChecklistItem[] = data.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type as ChecklistItemType,
        value: item.value,
        minValue: item.min_value,
        maxValue: item.max_value,
        textValue: item.text_values && item.text_values.length > 0 ? item.text_values[0] : undefined,
        completed: false,
        description: item.description,
      }));

      setChecklistItems(transformedItems);
    } catch (error) {
      console.error('Error loading checklist:', error);
      setChecklistItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewItemName('');
    setNewItemType('yes');
    setNewItemValue('');
    setNewItemMinValue('');
    setNewItemMaxValue('');
    setNewItemTextValue('');
    setNewItemDescription('');
    setEditingItemId(null);
  };

  const addOrEditChecklistItem = async () => {
    if (!newItemName.trim() || !user?.id) return;

    const itemData = {
      name: newItemName.trim(),
      type: newItemType,
      value: newItemType === 'more_than' || newItemType === 'less_than' ? newItemValue : null,
      min_value: newItemType === 'between' ? (newItemMinValue === '' ? null : newItemMinValue) : null,
      max_value: newItemType === 'between' ? (newItemMaxValue === '' ? null : newItemMaxValue) : null,
      text_values: newItemType === 'text' && newItemTextValue ? [newItemTextValue] : null,
      description: newItemDescription.trim() || null,
    };

    try {
      if (editingItemId) {
        // Update existing item
        const { error } = await supabase
          .from('trade_checklist_items')
          .update({
            ...itemData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingItemId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating checklist item:', error);
          return;
        }
      } else {
        // Add new item
        const { error } = await supabase
          .from('trade_checklist_items')
          .insert({
            ...itemData,
            user_id: user.id,
          });

        if (error) {
          console.error('Error adding checklist item:', error);
          return;
        }
      }

      // Reload the checklist
      await loadChecklist();
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving checklist item:', error);
    }
  };

  const deleteItem = async (id: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('trade_checklist_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting checklist item:', error);
        return;
      }

      // Update local state
      const updatedItems = checklistItems.filter(item => item.id !== id);
      setChecklistItems(updatedItems);
    } catch (error) {
      console.error('Error deleting checklist item:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-row justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-white">Trade Checklist</h1>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
            aria-label="Add checklist item"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { resetForm(); setIsModalOpen(true); } }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add Item</span>
          </button>
        </div>
        <p className="text-gray-500">Create your personalized checklist of criteria that a token must meet before you trade it. When you import a new token, you'll be able to go through this checklist to ensure it aligns with your trading strategy. This helps maintain consistency and discipline in your trading decisions.</p>
      </div>

      {/* Empty State */}
      {checklistItems.length === 0 ? (
        <div 
          onClick={() => setIsModalOpen(true)}
          className="flex flex-col items-center justify-center p-8 bg-[#252525] rounded-lg cursor-pointer hover:bg-[#2a2a2a] transition-colors border border-gray-700 shadow-md"
        >
          <svg className="w-12 h-12 text-indigo-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <p className="text-gray-400 mt-2">Click to create your first checklist item</p>
        </div>
      ) : (
        <div className="space-y-4">
          {checklistItems.map((item) => (
            <div
              key={item.id}
              className="relative bg-[#252525] p-6 rounded-xl border border-gray-700 shadow-md hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-start justify-between pb-1 mb-0">
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-semibold text-white tracking-tight">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setNewItemName(item.name);
                      setNewItemType(item.type);
                      setNewItemValue(item.value || '');
                      setNewItemMinValue(item.minValue || '');
                      setNewItemMaxValue(item.maxValue || '');
                      setNewItemTextValue(item.textValue || '');
                      setNewItemDescription(item.description || '');
                      setEditingItemId(item.id);
                      setIsModalOpen(true);
                    }}
                    className="p-2 rounded-full hover:bg-indigo-900/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Edit checklist item"
                    tabIndex={0}
                  >
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-2 rounded-full hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Delete checklist item"
                    tabIndex={0}
                  >
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Description display */}
              <div className="mb-1 pl-0">
                {item.description && item.description.trim() !== '' ? (
                  <span className="text-gray-300 text-sm">{item.description}</span>
                ) : (
                  <span className="text-gray-500 italic text-sm">No description added</span>
                )}
              </div>
              {/* Full-width divider */}
              <div className="w-full border-b border-gray-700 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Min Value</label>
                      <input
                        type="number"
                        value={item.minValue || ''}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md pointer-events-none select-none cursor-default"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Max Value</label>
                      <input
                        type="number"
                        value={item.maxValue || ''}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md pointer-events-none select-none cursor-default"
                      />
                    </div>
                  </>
                )}

                {(item.type === 'more_than' || item.type === 'less_than') && (
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-400 mb-1">Value</label>
                    <input
                      type="number"
                      value={item.value || ''}
                      readOnly
                      tabIndex={-1}
                      aria-readonly="true"
                      className="w-full px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md pointer-events-none select-none cursor-default"
                    />
                  </div>
                )}

                {item.type === 'text' && (
                  <div className="col-span-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={item.textValue || ''}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="flex-1 px-3 py-2 bg-[#1a1a1a] text-white border border-gray-700 rounded-md pointer-events-none select-none cursor-default"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rule Examples Section */}
      <section className="mt-14">
        <div className="w-full border-t border-gray-800 mb-8" />
        <h2 className="text-2xl font-bold text-white mb-2">Rule Examples</h2>
        <p className="text-gray-400 mb-6">Here are some example rules you might add to your checklist.</p>
        <ul className="grid gap-6 md:grid-cols-2">
          {/* Dex Paid? */}
          <li className="bg-[#252525] border border-gray-700 rounded-xl p-6 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-white">Dex Paid?</span>
              <span className="px-3 py-1 rounded-full bg-green-900 text-green-400 text-sm font-semibold shadow border border-green-700">Yes</span>
            </div>
            <div className="text-gray-400 text-sm mb-1">Is the Dex paid?</div>
          </li>
          {/* Dev Sold */}
          <li className="bg-[#252525] border border-gray-700 rounded-xl p-6 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-white">Dev Sold</span>
              <span className="px-3 py-1 rounded-full bg-green-900 text-green-400 text-sm font-semibold shadow border border-green-700">Yes</span>
            </div>
            <div className="text-gray-400 text-sm mb-1">Did the dev sell?</div>
          </li>
          {/* 5m Volume */}
          <li className="bg-[#252525] border border-gray-700 rounded-xl p-6 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-white">5m Volume</span>
              <span className="px-3 py-1 rounded-full bg-indigo-900 text-indigo-400 text-sm font-semibold shadow border border-indigo-700">More than</span>
            </div>
            <div className="text-gray-400 text-sm mb-1">Is the 5 minute volume more than $100,000?</div>
            <div className="text-gray-500 text-xs">Value: 100,000</div>
          </li>
          {/* Holders */}
          <li className="bg-[#252525] border border-gray-700 rounded-xl p-6 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-white">Holders</span>
              <span className="px-3 py-1 rounded-full bg-indigo-900 text-indigo-400 text-sm font-semibold shadow border border-indigo-700">More than</span>
            </div>
            <div className="text-gray-400 text-sm mb-1">Are there more than 1,000 holders?</div>
            <div className="text-gray-500 text-xs">Value: 1,000</div>
          </li>
          {/* Market Cap */}
          <li className="bg-[#252525] border border-gray-700 rounded-xl p-6 shadow-md flex flex-col justify-between md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-white">Market Cap</span>
              <span className="px-3 py-1 rounded-full bg-purple-900 text-purple-300 text-sm font-semibold shadow border border-purple-700">Between</span>
            </div>
            <div className="text-gray-400 text-sm mb-1">Is the market cap between $50,000 and $100,000</div>
            <div className="text-gray-500 text-xs">Between: 50,000 – 100,000</div>
          </li>
        </ul>
      </section>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-[#252525] rounded-xl p-8 w-full max-w-2xl border border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-white">Add Checklist Item</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Item Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Enter item name"
                  className="w-full px-4 py-3 bg-[#1a1a1a] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg transition-colors"
                />
              </div>
              {/* Description box */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={newItemDescription}
                  onChange={e => setNewItemDescription(e.target.value)}
                  placeholder="Enter a description (optional)"
                  className="w-full px-4 py-3 bg-[#1a1a1a] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg transition-colors min-h-[80px] resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Check Type</label>
                <select
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value as ChecklistItemType)}
                  className="w-full px-4 py-3 bg-[#1a1a1a] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg transition-colors"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="between">Between</option>
                  <option value="more_than">More Than</option>
                  <option value="less_than">Less Than</option>
                  <option value="text">Text</option>
                </select>
              </div>

              {newItemType === 'between' && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Min Value</label>
                    <input
                      type="number"
                      value={newItemMinValue}
                      onChange={(e) => setNewItemMinValue(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-4 py-3 bg-[#1a1a1a] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Max Value</label>
                    <input
                      type="number"
                      value={newItemMaxValue}
                      onChange={(e) => setNewItemMaxValue(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-4 py-3 bg-[#1a1a1a] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg transition-colors"
                    />
                  </div>
                </div>
              )}

              {(newItemType === 'more_than' || newItemType === 'less_than') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Value</label>
                  <input
                    type="number"
                    value={newItemValue}
                    onChange={(e) => setNewItemValue(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full px-4 py-3 bg-[#1a1a1a] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg transition-colors"
                  />
                </div>
              )}

              {newItemType === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Text Value</label>
                  <input
                    type="text"
                    value={newItemTextValue}
                    onChange={(e) => setNewItemTextValue(e.target.value)}
                    placeholder="Enter text value"
                    className="w-full px-4 py-3 bg-[#1a1a1a] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg transition-colors"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-700">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-6 py-3 text-gray-400 hover:text-white text-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addOrEditChecklistItem}
                  disabled={!newItemName.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors"
                >
                  {editingItemId ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeChecklist; 