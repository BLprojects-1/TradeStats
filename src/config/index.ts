export const config = {
  drpc: {
    apiKey: 'AkOKnudhf0RpkMOvshGdMo5E0I1BNf0R8KgybrRhIxXF',
    endpoint: 'https://lb.drpc.org/ogrpc?network=solana',
    rateLimit: 125, // Requests per second
  },
  cache: {
    ttl: 30, // seconds
  },
  api: {
    defaultLimit: 50,
    maxLimit: 500,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },
} as const;

// Type guard for environment variables
function validateEnv(): void {
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const;
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
} 