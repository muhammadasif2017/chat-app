import type { NextConfig } from 'next';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? ''} ${process.env.NEXT_PUBLIC_WS_URL ?? ''}`,
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
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
