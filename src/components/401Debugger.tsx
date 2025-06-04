import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

/**
 * This component provides diagnostic tools specifically for 401 Unauthorized errors
 */
const Debugger401 = () => {
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Test if we can get the session
  const testSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setResult({ 
        sessionExists: !!data.session, 
        userId: data.session?.user?.id,
        email: data.session?.user?.email,
        role: data.session?.user?.role,
        expiry: data.session?.expires_at 
          ? new Date(data.session.expires_at * 1000).toISOString() 
          : 'unknown',
        expired: data.session?.expires_at 
          ? (Date.now() > data.session.expires_at * 1000) 
          : 'unknown',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Test if we can directly select from user_profiles
  const testSelect = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(1);
      
      if (error) throw error;
      setResult({ 
        canSelect: true, 
        data,
        message: 'Success! You can read from user_profiles table' 
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult({ canSelect: false });
    } finally {
      setLoading(false);
    }
  };

  // Test if we can insert a dummy record (then delete it)
  const testInsert = async () => {
    setLoading(true);
    setError(null);
    try {
      // First get the user ID
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) {
        throw new Error('No authenticated user found');
      }
      
      // Try to insert a test record
      const { data, error } = await supabase
        .from('user_profiles')
        .insert([
          { 
            id: userData.user.id, 
            display_name: 'Test User ' + new Date().toISOString() 
          }
        ])
        .select();
      
      if (error) throw error;
      
      setResult({ 
        canInsert: true, 
        data,
        message: 'Success! You can insert into user_profiles table',
        userId: userData.user.id
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult({ canInsert: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 p-6 rounded-2xl text-white border border-emerald-500/30 shadow-2xl shadow-emerald-900/20">
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">TradeStats Authentication Debugger</h2>
      
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={testSession}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 transition-all duration-300 shadow-lg shadow-emerald-500/20 border border-emerald-400/30"
        >
          Test Session
        </button>
        <button
          onClick={testSelect}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl hover:from-teal-500 hover:to-teal-600 disabled:opacity-50 transition-all duration-300 shadow-lg shadow-teal-500/20 border border-teal-400/30"
        >
          Test SELECT
        </button>
        <button
          onClick={testInsert}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 text-white rounded-xl hover:from-amber-500 hover:to-yellow-500 disabled:opacity-50 transition-all duration-300 shadow-lg shadow-amber-500/20 border border-amber-400/30"
        >
          Test INSERT
        </button>
      </div>
      
      {loading && (
        <div className="animate-pulse text-emerald-300 mb-4 flex items-center space-x-2">
          <div className="w-4 h-4 bg-emerald-400 rounded-full animate-bounce"></div>
          <span>Running diagnostic test...</span>
        </div>
      )}
      
      {error && (
        <div className="bg-gradient-to-r from-red-900/40 to-orange-900/40 border border-red-400/50 p-4 rounded-xl mb-4 text-red-200 text-sm backdrop-blur-sm">
          <div className="font-bold text-red-300 mb-2">🚨 Error Detected:</div>
          <div className="font-mono whitespace-pre-wrap bg-black/20 p-3 rounded-lg">{error}</div>
        </div>
      )}
      
      {result && (
        <div className="bg-gradient-to-br from-slate-800/60 to-emerald-900/30 p-4 rounded-xl text-sm font-mono whitespace-pre-wrap overflow-auto max-h-64 border border-emerald-500/20 backdrop-blur-sm">
          {JSON.stringify(result, null, 2)}
        </div>
      )}
      
      <div className="mt-6 text-sm text-emerald-200/80 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 p-4 rounded-xl border border-emerald-400/20">
        <p className="font-semibold text-emerald-300 mb-3">🔧 If you're experiencing 401 Unauthorized errors:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Execute the emergency SQL commands in the TradeStats dashboard</li>
          <li>Sign out and sign back in to refresh your authentication token</li>
          <li>Verify that RLS policies are properly configured</li>
          <li>Confirm proper TradeStats authentication</li>
        </ol>
      </div>
    </div>
  );
};

export default Debugger401; 