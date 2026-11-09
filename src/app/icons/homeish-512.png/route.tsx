// Generate the 512px PNG install icon from the shared brand mark.
import { ImageResponse } from 'next/og';
import { AppIconMark } from '@/core/pwa/app-icon';

export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(<AppIconMark />, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
    width: 512,
    height: 512,
  });
}
