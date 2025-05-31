import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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

export interface TradeChecklistRef {
  openModal: () => void;
}

const TradeChecklist = forwardRef<TradeChecklistRef>((props, ref) => {
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
  const [addingRuleIndex, setAddingRuleIndex] = useState<number | null>(null);

  useImperativeHandle(ref, () => ({
    openModal: () => {
      resetForm();
      setIsModalOpen(true);
    }
  }));

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

  // Define example rules
  const exampleRules = [
    {
      name: "Dex Paid?",
      description: "Is the Dex paid?",
      type: "yes" as ChecklistItemType,
    },
    {
      name: "Dev Sold",
      description: "Did the dev sell?",
      type: "yes" as ChecklistItemType,
    },
    {
      name: "5m Volume",
      description: "Is the 5 minute volume more than $100,000?",
      type: "more_than" as ChecklistItemType,
      value: 100000,
    },
    {
      name: "Holders",
      description: "Are there more than 1,000 holders?",
      type: "more_than" as ChecklistItemType,
      value: 1000,
    },
    {
      name: "Market Cap",
      description: "Is the market cap between $50,000 and $100,000?",
      type: "between" as ChecklistItemType,
      min_value: 50000,
      max_value: 100000,
    },
  ];

  const addExampleRule = async (exampleRule: typeof exampleRules[0], ruleIndex: number) => {
    if (!user?.id) return;

    // Check if rule already exists
    const existingRule = checklistItems.find(item => item.name === exampleRule.name);
    if (existingRule) {
      console.log('Rule already exists');
      return;
    }

    setAddingRuleIndex(ruleIndex);

    const itemData = {
      name: exampleRule.name,
      type: exampleRule.type,
      description: exampleRule.description || null,
      value: exampleRule.value || null,
      min_value: exampleRule.min_value || null,
      max_value: exampleRule.max_value || null,
      text_values: null,
      user_id: user.id,
    };

    try {
      const { error } = await supabase
        .from('trade_checklist_items')
        .insert(itemData);

      if (error) {
        console.error('Error adding example rule:', error);
        return;
      }

      // Reload the checklist
      await loadChecklist();
    } catch (error) {
      console.error('Error adding example rule:', error);
    } finally {
      setAddingRuleIndex(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Empty State */}
      {checklistItems.length === 0 ? (
        <div 
          onClick={() => setIsModalOpen(true)}
          className="group relative bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur-sm rounded-xl p-12 border border-indigo-500/20 cursor-pointer transition-all duration-300 hover:bg-slate-800/50 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-900/10"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
          <div className="relative flex flex-col items-center justify-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg className="w-10 h-10 text-indigo-400 group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-100 mb-2">Create Your First Rule</h3>
              <p className="text-gray-400">Click here to create your first checklist item and start building your trading discipline</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {checklistItems.map((item) => (
            <div
              key={item.id}
              className="group relative bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur-sm rounded-xl p-6 border border-indigo-500/20 transition-all duration-300 hover:bg-slate-800/50 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-900/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
              <div className="relative flex items-start justify-between pb-4 mb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                    <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-100 tracking-tight">
                      {item.name}
                    </h3>
                    <div className="mt-2">
                      {item.description && item.description.trim() !== '' ? (
                        <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
                      ) : (
                        <p className="text-gray-500 italic text-sm">No description added</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
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
                    className="p-3 rounded-xl bg-slate-800/50 border border-indigo-500/30 hover:bg-indigo-600/20 hover:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 group/edit"
                    aria-label="Edit checklist item"
                    tabIndex={0}
                  >
                    <svg className="w-5 h-5 text-gray-400 group-hover/edit:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-3 rounded-xl bg-slate-800/50 border border-red-500/30 hover:bg-red-600/20 hover:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-300 group/delete"
                    aria-label="Delete checklist item"
                    tabIndex={0}
                  >
                    <svg className="w-5 h-5 text-gray-400 group-hover/delete:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Elegant divider */}
              <div className="w-full border-t border-indigo-500/20 mb-6" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(item.type === 'yes' || item.type === 'no') && (
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400 font-medium">Type:</span>
                    <span className={
                      item.type === 'yes'
                        ? 'inline-block px-4 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/25 text-emerald-400 text-sm font-semibold'
                        : 'inline-block px-4 py-2 rounded-xl bg-rose-950/40 border border-rose-500/25 text-rose-400 text-sm font-semibold'
                    }>
                      {item.type === 'yes' ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}

                {item.type === 'between' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-3">Min Value</label>
                      <input
                        type="number"
                        value={item.minValue || ''}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/20 rounded-xl pointer-events-none select-none cursor-default focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-3">Max Value</label>
                      <input
                        type="number"
                        value={item.maxValue || ''}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/20 rounded-xl pointer-events-none select-none cursor-default focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {(item.type === 'more_than' || item.type === 'less_than') && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-3">Value</label>
                    <input
                      type="number"
                      value={item.value || ''}
                      readOnly
                      tabIndex={-1}
                      aria-readonly="true"
                      className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/20 rounded-xl pointer-events-none select-none cursor-default focus:outline-none"
                    />
                  </div>
                )}

                {item.type === 'text' && (
                  <div className="col-span-2">
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={item.textValue || ''}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="flex-1 px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/20 rounded-xl pointer-events-none select-none cursor-default focus:outline-none"
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
      <section className="mt-16">
        <div className="w-full border-t border-indigo-500/20 mb-10" />
        <div className="bg-slate-900/40 backdrop-blur-sm rounded-xl p-8 border border-indigo-500/25">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Rule Examples
              </h2>
              <p className="text-gray-400 mt-1">Inspiration for your trading criteria</p>
            </div>
          </div>
          <p className="text-gray-400 leading-relaxed mb-8">Here are some example rules you might add to your checklist to maintain trading discipline.</p>
          
          <div className="grid gap-6 md:grid-cols-2">
            {exampleRules.map((rule, index) => (
              <div
                key={index}
                className={`group bg-white/2 border border-indigo-500/25 rounded-xl p-6 transition-all duration-300 hover:bg-indigo-500/10 hover:border-transparent hover:shadow-lg hover:shadow-indigo-900/20 ${
                  rule.name === 'Market Cap' ? 'md:col-span-2' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold text-gray-100">{rule.name}</span>
                  <div className="flex items-center space-x-3">
                    <span className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                      rule.type === 'yes' 
                        ? 'bg-emerald-950/40 border border-emerald-500/25 text-emerald-400'
                        : rule.type === 'more_than'
                        ? 'bg-indigo-950/40 border border-indigo-500/25 text-indigo-400'
                        : rule.type === 'between'
                        ? 'bg-violet-950/40 border border-violet-500/25 text-violet-400'
                        : 'bg-slate-950/40 border border-slate-500/25 text-slate-400'
                    }`}>
                      {rule.type === 'yes' ? 'Yes' : 
                       rule.type === 'more_than' ? 'More than' :
                       rule.type === 'between' ? 'Between' : rule.type}
                    </span>
                    <button
                      onClick={() => addExampleRule(rule, index)}
                      disabled={checklistItems.some(item => item.name === rule.name) || addingRuleIndex === index}
                      className="p-3 rounded-xl bg-slate-800/50 border border-indigo-500/30 hover:bg-indigo-600/20 hover:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={checklistItems.some(item => item.name === rule.name) ? "Rule already added" : addingRuleIndex === index ? "Adding rule..." : "Add example rule"}
                      title={checklistItems.some(item => item.name === rule.name) ? "Rule already added" : addingRuleIndex === index ? "Adding rule..." : "Add this rule to your checklist"}
                    >
                      {addingRuleIndex === index ? (
                        <div className="relative">
                          <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 w-5 h-5 border-2 border-transparent border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                        </div>
                      ) : checklistItems.some(item => item.name === rule.name) ? (
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-gray-400 text-sm leading-relaxed mb-2">{rule.description}</div>
                {rule.value && (
                  <div className="text-gray-500 text-xs font-medium">Value: {rule.value.toLocaleString()}</div>
                )}
                {rule.min_value && rule.max_value && (
                  <div className="text-gray-500 text-xs font-medium">Between: {rule.min_value.toLocaleString()} – {rule.max_value.toLocaleString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-8 w-full max-w-2xl border border-indigo-500/30 shadow-2xl shadow-indigo-900/50">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  {editingItemId ? 'Edit Checklist Item' : 'Add Checklist Item'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="p-3 rounded-xl bg-slate-800/50 border border-indigo-500/30 hover:bg-slate-700/50 hover:border-indigo-500/50 text-gray-400 hover:text-gray-200 transition-all duration-300"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">Item Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Enter item name"
                  className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">Description</label>
                <textarea
                  value={newItemDescription}
                  onChange={e => setNewItemDescription(e.target.value)}
                  placeholder="Enter a description (optional)"
                  className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all duration-300 min-h-[80px] resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">Check Type</label>
                <select
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value as ChecklistItemType)}
                  className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all duration-300"
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
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Min Value</label>
                    <input
                      type="number"
                      value={newItemMinValue}
                      onChange={(e) => setNewItemMinValue(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Max Value</label>
                    <input
                      type="number"
                      value={newItemMaxValue}
                      onChange={(e) => setNewItemMaxValue(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all duration-300"
                    />
                  </div>
                </div>
              )}

              {(newItemType === 'more_than' || newItemType === 'less_than') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Value</label>
                  <input
                    type="number"
                    value={newItemValue}
                    onChange={(e) => setNewItemValue(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all duration-300"
                  />
                </div>
              )}

              {newItemType === 'text' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Text Value</label>
                  <input
                    type="text"
                    value={newItemTextValue}
                    onChange={(e) => setNewItemTextValue(e.target.value)}
                    placeholder="Enter text value"
                    className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm text-gray-100 border border-indigo-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all duration-300"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-indigo-700">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-6 py-3 text-gray-400 hover:text-gray-200 text-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addOrEditChecklistItem}
                  disabled={!newItemName.trim()}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg shadow-indigo-900/20"
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
});

TradeChecklist.displayName = 'TradeChecklist';

export default TradeChecklist; 