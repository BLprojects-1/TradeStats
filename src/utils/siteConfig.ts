/**
 * Get the site URL based on the environment
 * In production, this will return https://TradeStats.xyz
 * In development, this will return http://localhost:3000
 */
export const getSiteUrl = () => {
  // Check for Vercel production environment first
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return 'https://TradeStats.xyz';
  }
  
  // Check for general production environment
  if (process.env.NODE_ENV === 'production') {
    return 'https://TradeStats.xyz';
  }
  
  // In development, use localhost or the environment variable if set
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}; 