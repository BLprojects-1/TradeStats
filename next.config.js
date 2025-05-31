/** @type {import('next').NextConfig} */
// Configuration for Next.js
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'ipfs.io',
      'gateway.pinata.cloud',
      'cloudflare-ipfs.com',
      'dweb.link',
      'gateway.ipfs.io',
      'raw.githubusercontent.com',
      'avatars.githubusercontent.com',
      'cdn.coinranking.com',
      'coin-images.coingecko.com',
      's2.coinmarketcap.com',
      'assets.coingecko.com'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.ipfs.dweb.link',
      },
      {
        protocol: 'https',
        hostname: '**.ipfs.io',
      }
    ]
  }
}

module.exports = nextConfig
