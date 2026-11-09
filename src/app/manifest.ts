// PWA manifest for installable Homeish shells; no offline data caching is enabled.
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#f6f4ef',
    description:
      'A little more like home. Homeish helps communities manage visitors, deliveries and everyday society services.',
    display: 'standalone',
    icons: [
      {
        purpose: 'maskable',
        sizes: '192x192',
        src: '/icons/homeish-192.png',
        type: 'image/png',
      },
      {
        purpose: 'maskable',
        sizes: '512x512',
        src: '/icons/homeish-512.png',
        type: 'image/png',
      },
    ],
    name: 'Homeish',
    short_name: 'Homeish',
    start_url: '/',
    theme_color: '#1e4e8c',
  };
}
