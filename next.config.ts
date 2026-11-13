// Next.js configuration for the Homeish application.
import type { NextConfig } from 'next';
import { STATIC_SECURITY_HEADERS } from './src/core/security/headers';

const defaultPageExtensions = ['ts', 'tsx', 'js', 'jsx'];
const pageExtensions =
  process.env.NODE_ENV === 'production'
    ? defaultPageExtensions
    : ['fixture.tsx', ...defaultPageExtensions];

const nextConfig: NextConfig = {
  pageExtensions,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [...STATIC_SECURITY_HEADERS] }];
  },
};

export default nextConfig;
