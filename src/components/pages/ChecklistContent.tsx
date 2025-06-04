import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabaseClient';

// Types for trade criteria
export type CriteriaType = 'yes' | 'no' | 'more_than' | 'less_than' | 'between';

export interface TradeCriteria {
  id: string;
  title: string;
  question: string;
  type: CriteriaType;
  value?: number;
  minValue?: number;
  maxValue?: number;
  explanation?: string;
  createdAt: string;
}

interface AddCriteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (criteria: Omit<TradeCriteria, 'id' | 'createdAt'>) => void;
  editingCriteria?: TradeCriteria | null;
}

interface ChecklistContentProps {
  isAddCriteriaModalOpen?: boolean;
  setIsAddCriteriaModalOpen?: (open: boolean) => void;
}

const AddCriteriaModal: React.FC<AddCriteriaModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingCriteria 
}) => {
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<CriteriaType>('yes');
  const [value, setValue] = useState<number | ''>('');
  const [minValue, setMinValue] = useState<number | ''>('');
  const [maxValue, setMaxValue] = useState<number | ''>('');
  const [explanation, setExplanation] = useState('');
  const [validationError, setValidationError] = useState('');

  // Reset form when modal opens/closes or editing criteria changes
  useEffect(() => {
    if (isOpen) {
      if (editingCriteria) {
        setTitle(editingCriteria.title);
        setQuestion(editingCriteria.question);
        setType(editingCriteria.type);
        setValue(editingCriteria.value || '');
        setMinValue(editingCriteria.minValue || '');
        setMaxValue(editingCriteria.maxValue || '');
        setExplanation(editingCriteria.explanation || '');
      } else {
        resetForm();
      }
    }
  }, [isOpen, editingCriteria]);

  const resetForm = () => {
    setTitle('');
    setQuestion('');
    setType('yes');
    setValue('');
    setMinValue('');
    setMaxValue('');
    setExplanation('');
    setValidationError('');
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      setValidationError('Rule name is required');
      return false;
    }
    if (!question.trim()) {
      setValidationError('Question/prompt is required');
      return false;
    }
    if (type === 'between') {
      if (minValue === '' || maxValue === '') {
        setValidationError('Both min and max values are required for "Between" condition');
        return false;
      }
      if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue >= maxValue) {
        setValidationError('Min value must be less than max value');
        return false;
      }
    }
    if ((type === 'more_than' || type === 'less_than') && value === '') {
      setValidationError('Value is required for this condition type');
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const criteriaData: Omit<TradeCriteria, 'id' | 'createdAt'> = {
      title: title.trim(),
      question: question.trim(),
      type,
      explanation: explanation.trim() || undefined,
    };

    if (type === 'between') {
      criteriaData.minValue = typeof minValue === 'number' ? minValue : parseFloat(String(minValue));
      criteriaData.maxValue = typeof maxValue === 'number' ? maxValue : parseFloat(String(maxValue));
    } else if (type === 'more_than' || type === 'less_than') {
      criteriaData.value = typeof value === 'number' ? value : parseFloat(String(value));
    }

    onSave(criteriaData);
    onClose();
    resetForm();
  };

  const handleEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen, handleEscapeKey]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-2xl m-4">      
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-emerald-500/40 rounded-2xl shadow-xl shadow-emerald-900/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/15">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">
              {editingCriteria ? 'Edit Criteria' : 'Add Criteria'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Rule Name */}
          <div>
            <label htmlFor="rule-name" className="block text-sm font-medium text-gray-300 mb-2">
              Rule Name *
            </label>
            <input
              id="rule-name"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 5-Minute Volume"
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
              required
            />
          </div>

          {/* Question/Prompt */}
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-300 mb-2">
              Question/Prompt *
            </label>
            <input
              id="question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Does this token trade at least $100k in the last 5 minutes?"
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
              required
            />
          </div>

          {/* Condition Type */}
          <div>
            <label htmlFor="condition-type" className="block text-sm font-medium text-gray-300 mb-2">
              Condition Type *
            </label>
            <select
              id="condition-type"
              value={type}
              onChange={(e) => setType(e.target.value as CriteriaType)}
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="more_than">More Than</option>
              <option value="less_than">Less Than</option>
              <option value="between">Between</option>
            </select>
          </div>

          {/* Conditional Value Fields */}
          {type === 'between' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="min-value" className="block text-sm font-medium text-gray-300 mb-2">
                  Min Value *
                </label>
                <input
                  id="min-value"
                  type="number"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="50000"
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
                  required
                />
              </div>
              <div>
                <label htmlFor="max-value" className="block text-sm font-medium text-gray-300 mb-2">
                  Max Value *
                </label>
                <input
                  id="max-value"
                  type="number"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="100000"
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
                  required
                />
              </div>
            </div>
          )}

          {(type === 'more_than' || type === 'less_than') && (
            <div>
              <label htmlFor="value" className="block text-sm font-medium text-gray-300 mb-2">
                Value *
              </label>
              <input
                id="value"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="100000"
                className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
                required
              />
            </div>
          )}

          {/* Explanation */}
          <div>
            <label htmlFor="explanation" className="block text-sm font-medium text-gray-300 mb-2">
              Explanation (optional)
            </label>
            <textarea
              id="explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Why is this criteria important for your trading strategy?"
              rows={3}
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors resize-none"
            />
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-300 text-sm">{validationError}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {editingCriteria ? 'Update Criteria' : 'Add Criteria'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

interface CriterionCardProps {
  criteria: TradeCriteria;
  onEdit: (criteria: TradeCriteria) => void;
  onDelete: (id: string) => void;
}

const CriterionCard: React.FC<CriterionCardProps> = ({ criteria, onEdit, onDelete }) => {
  
  const formatConditionDisplay = (criteria: TradeCriteria): string => {
    switch (criteria.type) {
      case 'yes':
        return 'Yes';
      case 'no':
        return 'No';
      case 'more_than':
        return `More than ${criteria.value?.toLocaleString()}`;
      case 'less_than':
        return `Less than ${criteria.value?.toLocaleString()}`;
      case 'between':
        return `Between ${criteria.minValue?.toLocaleString()} - ${criteria.maxValue?.toLocaleString()}`;
      default:
        return '';
    }
  };

  const getInputElement = () => {
    switch (criteria.type) {
      case 'yes':
        return (
          <div className="flex space-x-3">
            <button className="w-full bg-green-900/30 border border-green-500/50 text-green-300 py-2 px-4 rounded-lg font-medium">
              Yes
            </button>
          </div>
        );
      case 'no':
        return (
          <div className="flex space-x-3">
            <button className="w-full bg-red-900/30 border border-red-500/50 text-red-300 py-2 px-4 rounded-lg font-medium">
              No
            </button>
          </div>
        );
      case 'more_than':
      case 'less_than':
        return (
          <div className="flex items-center space-x-3">
            <span className="text-gray-400">Value:</span>
            <div className="flex-1 bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2">
              <span className="text-white font-mono">{criteria.value?.toLocaleString()}</span>
            </div>
          </div>
        );
      case 'between':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-gray-400 text-sm">Min:</span>
              <div className="bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2">
                <span className="text-white font-mono">{criteria.minValue?.toLocaleString()}</span>
              </div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Max:</span>
              <div className="bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2">
                <span className="text-white font-mono">{criteria.maxValue?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-6 border border-emerald-500/20 transition-all duration-300 hover:border-emerald-500/40"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">{criteria.title}</h3>
          <p className="text-gray-300 mb-3">{criteria.question}</p>
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-emerald-400 text-sm font-medium">
              {formatConditionDisplay(criteria)}
            </span>
            {criteria.explanation && (
              <div className="group relative">
                <svg className="w-4 h-4 text-emerald-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-emerald-500/30 max-w-xs">
                  {criteria.explanation}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex space-x-2 ml-4">
          <button
            onClick={() => onEdit(criteria)}
            className="p-2 bg-blue-900/30 border border-blue-500/50 text-blue-300 rounded-lg hover:bg-blue-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Edit criteria"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(criteria.id)}
            className="p-2 bg-red-900/30 border border-red-500/50 text-red-300 rounded-lg hover:bg-red-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Delete criteria"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        {getInputElement()}
      </div>
    </motion.div>
  );
};

const ChecklistContent: React.FC<ChecklistContentProps> = ({ 
  isAddCriteriaModalOpen = false, 
  setIsAddCriteriaModalOpen 
}) => {
  const { user } = useAuth();
  const [criteria, setCriteria] = useState<TradeCriteria[]>([]);
  const [editingCriteria, setEditingCriteria] = useState<TradeCriteria | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use internal modal state if external state is not provided
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isModalOpen = setIsAddCriteriaModalOpen ? isAddCriteriaModalOpen : internalModalOpen;
  const setIsModalOpen = setIsAddCriteriaModalOpen || setInternalModalOpen;

  // Example rules that users can add to their checklist
  const exampleRules: Omit<TradeCriteria, 'id' | 'createdAt'>[] = [
    {
      title: "Dex Paid",
      question: "Is the Dex paid?",
      type: "yes",
      explanation: "Ensures the token has proper Dex listing fees paid for liquidity"
    },
    {
      title: "Dev Sold",
      question: "Did the dev sell their tokens?",
      type: "no",
      explanation: "Helps identify potential rug pulls or dev abandonment"
    },
    {
      title: "5-Minute Volume",
      question: "Does this token trade at least $100k in the last 5 minutes?",
      type: "more_than",
      value: 100000,
      explanation: "Ensures sufficient liquidity for smooth entry and exit"
    },
    {
      title: "Holder Count",
      question: "Are there more than 1,000 holders?",
      type: "more_than",
      value: 1000,
      explanation: "Indicates healthy distribution and community adoption"
    },
    {
      title: "Market Cap Range",
      question: "Is the market cap between $50,000 and $100,000?",
      type: "between",
      minValue: 50000,
      maxValue: 100000,
      explanation: "Sweet spot for potential growth while minimizing risk"
    }
  ];

  // Watch for external modal open trigger
  useEffect(() => {
    if (isAddCriteriaModalOpen && setIsAddCriteriaModalOpen) {
      setEditingCriteria(null); // Ensure we're adding new criteria, not editing
    }
  }, [isAddCriteriaModalOpen, setIsAddCriteriaModalOpen]);

  // Load user's criteria on mount
  useEffect(() => {
    if (user?.id) {
      loadCriteria();
    }
  }, [user?.id]);

  const loadCriteria = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('trade_criteria')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading criteria:', error);
        return;
      }

      const transformedCriteria: TradeCriteria[] = data.map(item => ({
        id: item.id,
        title: item.title,
        question: item.question,
        type: item.type as CriteriaType,
        value: item.value,
        minValue: item.min_value,
        maxValue: item.max_value,
        explanation: item.explanation,
        createdAt: item.created_at,
      }));

      setCriteria(transformedCriteria);
    } catch (error) {
      console.error('Error loading criteria:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCriteria = async (criteriaData: Omit<TradeCriteria, 'id' | 'createdAt'>) => {
    if (!user?.id) return;

    try {
      const dataToSave = {
        user_id: user.id,
        title: criteriaData.title,
        question: criteriaData.question,
        type: criteriaData.type,
        value: criteriaData.value || null,
        min_value: criteriaData.minValue || null,
        max_value: criteriaData.maxValue || null,
        explanation: criteriaData.explanation || null,
      };

      if (editingCriteria) {
        // Update existing criteria
        const { error } = await supabase
          .from('trade_criteria')
          .update(dataToSave)
          .eq('id', editingCriteria.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating criteria:', error);
          return;
        }
      } else {
        // Create new criteria
        const { error } = await supabase
          .from('trade_criteria')
          .insert(dataToSave);

        if (error) {
          console.error('Error creating criteria:', error);
          return;
        }
      }

      // Reload criteria and close modal
      await loadCriteria();
      setEditingCriteria(null);
    } catch (error) {
      console.error('Error saving criteria:', error);
    }
  };

  const deleteCriteria = async (id: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('trade_criteria')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting criteria:', error);
        return;
      }

      // Remove from local state
      setCriteria(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting criteria:', error);
    }
  };

  const addExampleRule = async (example: Omit<TradeCriteria, 'id' | 'createdAt'>) => {
    // Check if rule already exists
    const exists = criteria.some(c => c.title === example.title);
    if (exists) return;

    await saveCriteria(example);
  };

  const handleEdit = (criteriaToEdit: TradeCriteria) => {
    setEditingCriteria(criteriaToEdit);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingCriteria(null);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-center py-8"
      >
        <div className="animate-pulse text-emerald-400 text-xl">Loading your professional trade checklist...</div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full space-y-8"
    >
      {/* Only show Add Criteria button if not using external button */}
      {!setIsAddCriteriaModalOpen && (
        <div className="flex justify-end">
          <button
            onClick={handleAddNew}
            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-emerald-900/15 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Add criteria"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Criteria</span>
          </button>
        </div>
      )}

      {/* Professional Trading Criteria Section */}
      <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-xl shadow-emerald-900/10">
        <div className="p-6 border-b border-emerald-500/20">
          <h2 className="text-2xl font-bold text-white mb-2">Professional Trading Criteria</h2>
          <p className="text-slate-400">
            These criteria help ensure each new token meets your strategy before you trade.
          </p>
        </div>

        <div className="p-6">
          {criteria.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-600/20 to-green-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Your checklist is empty</h3>
              <p className="text-gray-400 mb-6">Click 'Add Criteria' to get started with your first trading rule.</p>
              <button
                onClick={handleAddNew}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300"
              >
                Add Your First Criteria
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              <AnimatePresence>
                {criteria.map((criteriaItem) => (
                  <CriterionCard
                    key={criteriaItem.id}
                    criteria={criteriaItem}
                    onEdit={handleEdit}
                    onDelete={deleteCriteria}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Rule Examples Section */}
      <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl shadow-xl shadow-purple-900/10">
        <div className="p-6 border-b border-purple-500/20">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/15">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
              Rule Examples
            </h2>
          </div>
          <p className="text-slate-400">Click to add these example rules to your checklist</p>
        </div>

        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {exampleRules.map((example, index) => {
              const isAdded = criteria.some(c => c.title === example.title);
              
              return (
                <div
                  key={index}
                  className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-purple-500/20 transition-all duration-300 hover:border-purple-500/40"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">{example.title}</h3>
                    <button
                      onClick={() => addExampleRule(example)}
                      disabled={isAdded}
                      className={`p-2 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                        isAdded
                          ? 'bg-green-900/30 border border-green-500/30 cursor-default'
                          : 'bg-slate-800/50 border border-purple-500/30 hover:bg-purple-600/20 hover:border-purple-500/50 focus:ring-purple-400'
                      }`}
                      aria-label={isAdded ? 'Rule already added' : 'Click to add this example rule'}
                      title={isAdded ? 'Rule already added' : 'Click to add this example rule'}
                    >
                      {isAdded ? (
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{example.question}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-purple-400 text-sm font-medium">
                      {example.type === 'yes' && 'Yes'}
                      {example.type === 'no' && 'No'}
                      {example.type === 'more_than' && `More than ${example.value?.toLocaleString()}`}
                      {example.type === 'less_than' && `Less than ${example.value?.toLocaleString()}`}
                      {example.type === 'between' && `Between ${example.minValue?.toLocaleString()} - ${example.maxValue?.toLocaleString()}`}
                    </span>
                    {example.explanation && (
                      <div className="group relative">
                        <svg className="w-4 h-4 text-purple-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-purple-500/30 max-w-xs">
                          {example.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add/Edit Criteria Modal */}
      <AddCriteriaModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCriteria(null);
        }}
        onSave={saveCriteria}
        editingCriteria={editingCriteria}
      />
    </motion.div>
  );
};

export default ChecklistContent; 