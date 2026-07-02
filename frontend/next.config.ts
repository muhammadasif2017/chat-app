import type { NextConfig } from 'next';

// Content-Security-Policy is set per-request (with a nonce) in src/proxy.ts instead of here —
// Next's inline RSC hydration scripts need 'nonce-{value}' or 'unsafe-inline', and a nonce can
// only be minted per-request, not baked into a static header.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
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
