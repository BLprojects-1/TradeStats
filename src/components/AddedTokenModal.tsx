import { useState, useEffect, useContext } from 'react';
import { formatDate, formatTime } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { ChecklistItem, ChecklistItemType } from './TradeChecklist';
import { supabase } from '../utils/supabaseClient';
import { useLayoutContext } from './layouts/NewDashboardLayout';
import { LayoutContext } from './layouts/NewDashboardLayout';

interface AddedTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
  isSidebarCollapsed?: boolean;
  isMobileSidebarOpen?: boolean;
  isMobile?: boolean;
}

export default function AddedTokenModal({ 
  isOpen, 
  onClose, 
  tokenAddress, 
  tokenSymbol, 
  tokenLogoURI,
  isSidebarCollapsed,
  isMobileSidebarOpen,
  isMobile
}: AddedTokenModalProps) {
  const { user } = useAuth();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistCompletions, setChecklistCompletions] = useState<{[itemId: string]: boolean}>({});
  const [checklistTimestamps, setChecklistTimestamps] = useState<{[itemId: string]: string}>({});
  const [showSwingNotes, setShowSwingNotes] = useState(true);
  const [overallNotes, setOverallNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOverallNotes, setShowOverallNotes] = useState(false);
  const [savingOverallNotes, setSavingOverallNotes] = useState(false);
  const [overallNotesSaved, setOverallNotesSaved] = useState(false);
  const [copiedCA, setCopiedCA] = useState(false);

  // Add state to force re-render when sidebar state changes
  const [, forceUpdate] = useState({});

  // Get sidebar state from context if available
  // We need to handle this carefully to avoid calling hooks conditionally
  let layoutState = null;
  let hasLayoutContext = false;
  
  // Check if we're in a layout context by trying to access it
  // This is a safe pattern for optional context usage
  try {
    const context = useContext(LayoutContext);
    if (context) {
      layoutState = context;
      hasLayoutContext = true;
    }
  } catch (error) {
    // Context not available
    hasLayoutContext = false;
  }
  
  const currentSidebarCollapsed = isSidebarCollapsed ?? false;
  const currentMobileSidebarOpen = isMobileSidebarOpen ?? false;
  const currentMobile = isMobile ?? false;

  // Watch for sidebar state changes and update modal positioning
  useEffect(() => {
    // Force re-render when sidebar state changes to update modal positioning
    forceUpdate({});
  }, [currentSidebarCollapsed, currentMobileSidebarOpen, currentMobile]);

  // Dynamic width calculation based on sidebar state
  const getModalStyles = () => {
    // Base styles for all screen sizes with enhanced transitions and TradeStats branding
    let modalClasses = 'relative bg-gradient-to-br from-slate-900/95 via-emerald-950/95 to-teal-950/95 backdrop-blur-xl border border-emerald-400/40 rounded-3xl shadow-2xl shadow-emerald-900/30 overflow-y-auto transition-all duration-500 ease-in-out';
    let containerClasses = 'fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 transition-all duration-500 ease-in-out overflow-y-auto';
    
    // Handle different screen sizes and sidebar states
    if (currentMobile || window.innerWidth < 1024) {
      // Mobile screens - center between wallet selector and bottom, positioned slightly lower
      if (currentMobileSidebarOpen) {
        // Mobile with sidebar open - position modal to the right of sidebar with proper centering
        containerClasses = 'fixed bg-black/95 backdrop-blur-md flex items-start justify-center z-40 transition-all duration-500 ease-in-out overflow-y-auto py-4';
        containerClasses += ' top-16 bottom-0 left-80 right-0'; // Start after header (64px) and sidebar (320px)
        modalClasses += ' w-full max-w-md mx-auto mt-16 max-h-[70vh] min-h-[400px] transform transition-all duration-500 ease-in-out'; // Moved down with mt-16
      } else {
        // Mobile with sidebar closed - center in available space below header, positioned slightly lower
        containerClasses = 'fixed bg-black/95 backdrop-blur-md flex items-start justify-center z-50 transition-all duration-500 ease-in-out overflow-y-auto px-4 py-4';
        containerClasses += ' top-16 bottom-0 left-0 right-0'; // Start after header (64px)
        modalClasses += ' w-full max-w-xl mx-auto mt-16 max-h-[70vh] min-h-[400px] transform transition-all duration-500 ease-in-out'; // Moved down with mt-16
      }
    } else {
      // Desktop screens - maintain larger size but still add top padding
      if (currentMobileSidebarOpen) {
        // Desktop with mobile sidebar open - position modal to the right of sidebar
        containerClasses = 'fixed top-0 bottom-0 bg-black/95 backdrop-blur-md flex items-start justify-center z-40 transition-all duration-500 ease-in-out overflow-y-auto pt-16 pb-8';
        containerClasses += ' left-80 right-0'; // Start after 320px sidebar width
        modalClasses += ' w-full max-w-4xl mx-6 ml-6 mr-6 mt-4 max-h-[85vh] min-h-[600px] transform transition-all duration-500 ease-in-out';
      } else if (currentSidebarCollapsed) {
        // Desktop with collapsed sidebar - position modal to the right of collapsed sidebar
        containerClasses = 'fixed top-0 bottom-0 bg-black/95 backdrop-blur-md flex items-start justify-center z-40 transition-all duration-500 ease-in-out overflow-y-auto pt-16 pb-8';
        containerClasses += ' left-20 right-0'; // Start after 80px collapsed sidebar width
        modalClasses += ' w-full max-w-6xl mx-6 ml-6 mr-6 mt-4 max-h-[85vh] min-h-[600px] transform transition-all duration-500 ease-in-out';
      } else {
        // Desktop with expanded sidebar - position modal to the right of expanded sidebar
        containerClasses = 'fixed top-0 bottom-0 bg-black/95 backdrop-blur-md flex items-start justify-center z-40 transition-all duration-500 ease-in-out overflow-y-auto pt-16 pb-8';
        containerClasses += ' left-72 right-0'; // Start after 288px expanded sidebar width
        modalClasses += ' w-full max-w-5xl mx-6 ml-6 mr-6 mt-4 max-h-[85vh] min-h-[600px] transform transition-all duration-500 ease-in-out';
      }
    }
    
    return { containerClasses, modalClasses };
  };

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
      const overallNotesKey = `TradeStats_token_notes_${user.id}_${tokenAddress}`;
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

    setSavingOverallNotes(true);
    setOverallNotesSaved(false);
    try {
      const overallNotesKey = `TradeStats_token_notes_${user.id}_${tokenAddress}`;
      localStorage.setItem(overallNotesKey, overallNotes);
      
      // Show success message
      setOverallNotesSaved(true);

      // Reset success message after 3 seconds
      setTimeout(() => {
        setOverallNotesSaved(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving overall notes:', error);
    } finally {
      setSavingOverallNotes(false);
    }
  };

  const handleCopyCA = async () => {
    try {
      await navigator.clipboard.writeText(tokenAddress);
      setCopiedCA(true);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedCA(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy contract address:', error);
    }
  };

  const getAbbreviatedCA = () => {
    if (!tokenAddress) return '';
    return `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-6)}`;
  };

  if (!isOpen) return null;

  return (
    <div className={getModalStyles().containerClasses}>
      <div className={getModalStyles().modalClasses}>
        {/* Enhanced Header with TradeStats Branding */}
        <div className="relative bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-amber-500/10 p-6 border-b border-emerald-400/30">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <svg className="w-full h-full" viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="TradeStatsHeaderPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="10" cy="10" r="1" fill="currentColor" className="text-emerald-400" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#TradeStatsHeaderPattern)" />
            </svg>
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
              {/* Token logo with enhanced TradeStats styling */}
              {tokenLogoURI && (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500 rounded-full opacity-0 group-hover:opacity-20 blur transition-all duration-300"></div>
                  <img 
                    src={tokenLogoURI} 
                    alt={tokenSymbol} 
                    className="relative w-12 h-12 rounded-full border-2 border-emerald-400/40 shadow-lg shadow-emerald-900/30 group-hover:border-emerald-400/60 transition-all duration-300" 
                  />
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                    TradeStats Token Analysis
                  </h2>
                  <div className="px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 rounded-full">
                    <span className="text-sm font-medium text-emerald-200">{tokenSymbol}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-400/80 text-sm font-medium font-mono">{getAbbreviatedCA()}</span>
                  <button
                    onClick={handleCopyCA}
                    className="group p-2 rounded-lg bg-slate-800/50 border border-emerald-600/30 hover:bg-slate-700/50 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                    aria-label="Copy contract address"
                    title="Copy contract address"
                  >
                    {copiedCA ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Enhanced close button */}
            <button
              onClick={onClose}
              className="group p-3 rounded-xl bg-slate-800/50 border border-emerald-600/30 hover:bg-slate-700/50 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              aria-label="Close TradeStats token analysis modal"
            >
              <svg 
                className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Enhanced TradeStats Trade Checklist */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-amber-600/10 opacity-0 group-hover:opacity-100 blur-md transition-all duration-700 rounded-3xl"></div>
                <div className="relative bg-gradient-to-br from-slate-900/95 via-emerald-950/95 to-teal-950/95 backdrop-blur-xl border border-emerald-400/40 rounded-3xl p-6 shadow-xl shadow-emerald-900/20 transition-all duration-500 hover:border-emerald-400/50">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 via-teal-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/30 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-amber-400/20 animate-pulse"></div>
                        <svg className="w-6 h-6 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                          TradeStats Trade Checklist
                        </h3>
                        <p className="text-emerald-400/80 text-sm">Validate your trading criteria</p>
                      </div>
                    </div>
                    
                    {/* Enhanced Toggle Button */}
                    <button
                      onClick={() => setShowSwingNotes(!showSwingNotes)}
                      className="group p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 hover:border-emerald-400/50 text-emerald-300 hover:text-emerald-200 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                      aria-label={showSwingNotes ? "Hide checklist" : "Show checklist"}
                    >
                      <svg 
                        className={`w-5 h-5 transform transition-all duration-300 ease-out ${showSwingNotes ? 'rotate-180 scale-110' : 'rotate-0 scale-100'}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {showSwingNotes && (
                    <div className="mt-6 space-y-6 animate-in slide-in-from-top-2 fade-in-0 duration-500">
                      {/* Checklist Items */}
                      <div className="space-y-4">
                        {checklistItems.length === 0 ? (
                          <div className="bg-gradient-to-br from-slate-800/60 to-emerald-950/60 backdrop-blur-sm p-8 rounded-2xl text-center border border-emerald-700/30">
                            <div className="flex flex-col items-center space-y-4">
                              <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 via-teal-600 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-amber-400/20 animate-pulse"></div>
                                <svg className="w-8 h-8 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="text-xl font-bold text-white mb-2">No TradeStats Checklist Items</h4>
                                <p className="text-emerald-400/80 text-sm mb-6 max-w-sm">You haven't created any checklist items yet. Create your personalized trading criteria to maintain consistency in your TradeStats trading decisions.</p>
                                <button
                                  onClick={() => {
                                    onClose();
                                    // Navigate to trade checklist page
                                    window.location.href = '/checklist';
                                  }}
                                  className="group bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg shadow-emerald-900/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                                >
                                  <span>Create TradeStats Checklist Items</span>
                                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          checklistItems.map((item) => (
                            <div key={item.id} className="group relative">
                              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 blur-sm transition-all duration-500 rounded-2xl"></div>
                              <div className="relative bg-gradient-to-br from-slate-800/60 to-emerald-950/60 backdrop-blur-sm p-5 rounded-2xl border border-emerald-700/30 group-hover:border-emerald-600/50 transition-all duration-300">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center space-x-4">
                                    {/* Enhanced Checkbox */}
                                    <label className="relative flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={checklistCompletions[item.id] || false}
                                        onChange={() => toggleItemCompletion(item.id)}
                                        className="sr-only"
                                      />
                                      <div className={`w-6 h-6 rounded-lg border-2 transition-all duration-300 flex items-center justify-center ${
                                        checklistCompletions[item.id] 
                                          ? 'bg-gradient-to-br from-emerald-500 to-teal-500 border-emerald-400 shadow-lg shadow-emerald-500/30' 
                                          : 'border-emerald-500 hover:border-emerald-400 hover:bg-emerald-700/20'
                                      }`}>
                                        {checklistCompletions[item.id] && (
                                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                    </label>
                                    
                                    <div className="flex-1">
                                      <span className={`text-lg font-semibold transition-all duration-300 ${
                                        checklistCompletions[item.id] ? 'text-emerald-500/70 line-through' : 'text-white'
                                      }`}>
                                        {item.name}
                                      </span>
                                      
                                      {/* Show completion timestamp */}
                                      {checklistCompletions[item.id] && checklistTimestamps[item.id] && (
                                        <div className="text-xs text-emerald-400/80 mt-1 font-medium">
                                          ✓ Completed {formatDate(new Date(checklistTimestamps[item.id]).getTime())} at {formatTime(new Date(checklistTimestamps[item.id]).getTime())}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Item Details */}
                                <div className="mt-4 ml-10">
                                  {(item.type === 'yes' || item.type === 'no') && (
                                    <div className="flex items-center space-x-3">
                                      <span className="text-emerald-400/80 text-sm font-medium">Type:</span>
                                      <div className={
                                        item.type === 'yes'
                                          ? 'inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm font-semibold'
                                          : 'inline-flex items-center px-3 py-1 rounded-full bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-semibold'
                                      }>
                                        <div className={`w-2 h-2 rounded-full mr-2 ${item.type === 'yes' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                        {item.type === 'yes' ? 'Yes' : 'No'}
                                      </div>
                                    </div>
                                  )}

                                  {item.type === 'between' && (
                                    <div className="flex items-center space-x-4">
                                      <span className="text-emerald-400/80 text-sm font-medium">Range:</span>
                                      <div className="flex items-center space-x-2">
                                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-sm font-semibold">
                                          <span className="text-xs text-teal-400 mr-1">Min:</span>
                                          {item.minValue ? Number(item.minValue).toLocaleString() : 'Not set'}
                                        </div>
                                        <span className="text-emerald-500/70">to</span>
                                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-sm font-semibold">
                                          <span className="text-xs text-teal-400 mr-1">Max:</span>
                                          {item.maxValue ? Number(item.maxValue).toLocaleString() : 'Not set'}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {(item.type === 'more_than' || item.type === 'less_than') && (
                                    <div className="flex items-center space-x-3">
                                      <span className="text-emerald-400/80 text-sm font-medium">
                                        {item.type === 'more_than' ? 'More than:' : 'Less than:'}
                                      </span>
                                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-sm font-semibold">
                                        {item.value ? Number(item.value).toLocaleString() : 'Not set'}
                                      </div>
                                    </div>
                                  )}

                                  {item.type === 'text' && (
                                    <div className="flex items-center space-x-3">
                                      <span className="text-emerald-400/80 text-sm font-medium">Text:</span>
                                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm font-semibold">
                                        {item.textValue || 'Not set'}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced TradeStats Overall Token Notes */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-amber-600/10 opacity-0 group-hover:opacity-100 blur-md transition-all duration-700 rounded-3xl"></div>
                <div className="relative bg-gradient-to-br from-slate-900/95 via-emerald-950/95 to-teal-950/95 backdrop-blur-xl border border-emerald-400/40 rounded-3xl p-6 shadow-xl shadow-emerald-900/20 transition-all duration-500 hover:border-emerald-400/50">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 via-teal-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/30 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-amber-400/20 animate-pulse"></div>
                        <svg className="w-6 h-6 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                          TradeStats Token Notes
                        </h3>
                        <p className="text-emerald-400/80 text-sm">Track general insights about this token</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {/* Enhanced Save Button */}
                      {showOverallNotes && (
                        <>
                          {overallNotesSaved && (
                            <div className="flex items-center space-x-2 px-3 py-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
                              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-emerald-300 text-sm font-medium">Saved to TradeStats!</span>
                            </div>
                          )}
                          <button
                            onClick={saveOverallNotes}
                            disabled={savingOverallNotes}
                            className="group flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl font-medium transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg shadow-emerald-900/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                          >
                            {savingOverallNotes ? (
                              <>
                                <svg className="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Saving to TradeStats...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Save to TradeStats</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                      
                      {/* Enhanced Toggle Button */}
                      <button
                        onClick={() => setShowOverallNotes(!showOverallNotes)}
                        className="group p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 hover:border-emerald-400/50 text-emerald-300 hover:text-emerald-200 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                        aria-label={showOverallNotes ? "Hide notes" : "Show notes"}
                      >
                        <svg 
                          className={`w-5 h-5 transform transition-all duration-300 ease-out ${showOverallNotes ? 'rotate-180 scale-110' : 'rotate-0 scale-100'}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {showOverallNotes && (
                    <div className="mt-6 animate-in slide-in-from-top-2 fade-in-0 duration-500">
                      <div className="relative">
                        <textarea
                          value={overallNotes}
                          onChange={(e) => setOverallNotes(e.target.value)}
                          placeholder="Add notes about this token in your TradeStats analysis..."
                          className="w-full h-32 bg-slate-800/50 backdrop-blur-sm text-white placeholder-emerald-400/60 rounded-2xl p-4 border border-emerald-500/20 hover:border-emerald-500/40 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 resize-none transition-all duration-300 shadow-inner"
                          aria-label="TradeStats token notes"
                        />
                        {/* Enhanced corner decoration with TradeStats colors */}
                        <div className="absolute bottom-3 right-3 w-6 h-6 bg-gradient-to-br from-emerald-500/30 via-teal-500/30 to-amber-500/30 rounded-full opacity-60 border border-emerald-400/20"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 