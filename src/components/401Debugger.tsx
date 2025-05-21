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
    <div className="bg-gray-900 p-4 rounded-lg text-white">
      <h2 className="text-xl font-bold mb-4">401 Unauthorized Debugger</h2>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={testSession}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Test Session
        </button>
        <button
          onClick={testSelect}
          disabled={loading}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Test SELECT
        </button>
        <button
          onClick={testInsert}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          Test INSERT
        </button>
      </div>
      
      {loading && (
        <div className="animate-pulse text-blue-300 mb-4">Running test...</div>
      )}
      
      {error && (
        <div className="bg-red-900/30 border border-red-500 p-3 rounded mb-4 text-red-200 text-sm">
          <div className="font-bold">Error:</div>
          <div className="font-mono whitespace-pre-wrap">{error}</div>
        </div>
      )}
      
      {result && (
        <div className="bg-gray-800 p-3 rounded text-sm font-mono whitespace-pre-wrap overflow-auto max-h-64">
          {JSON.stringify(result, null, 2)}
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-400">
        <p>If you're seeing 401 Unauthorized errors:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Run the emergency SQL in the Supabase dashboard</li>
          <li>Sign out and sign back in to refresh your token</li>
          <li>Check that RLS policies are properly set up</li>
          <li>Verify proper authentication</li>
        </ol>
      </div>
    </div>
  );
};

export default Debugger401; 