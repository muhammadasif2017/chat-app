import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Build runs on Turbopack (default); empty config silences the webpack-config warning.
  // The webpack block below only applies to `next dev --webpack` (docker hot-reload poll).
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) config.watchOptions = { poll: 1000, aggregateTimeout: 300 };
    return config;
  },
  images: {
    remotePatterns: [{ protocol: 'http', hostname: 'localhost', port: '3001' }],
  },
};

export default nextConfig;
