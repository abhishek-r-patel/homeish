// Next.js configuration for the Homeish application.
import type { NextConfig } from 'next';

const defaultPageExtensions = ['ts', 'tsx', 'js', 'jsx'];
const pageExtensions =
  process.env.NODE_ENV === 'production'
    ? defaultPageExtensions
    : ['fixture.tsx', ...defaultPageExtensions];

const nextConfig: NextConfig = { pageExtensions };

export default nextConfig;
