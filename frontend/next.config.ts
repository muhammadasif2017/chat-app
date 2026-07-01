import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  webpack: (config, { dev }) => {
    if (dev) config.watchOptions = { poll: 1000, aggregateTimeout: 300 };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '3001' },
    ],
  },
};

export default nextConfig;
