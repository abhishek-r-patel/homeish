// Generate the Apple home-screen icon from the shared brand mark.
import { ImageResponse } from 'next/og';
import { AppIconMark } from '@/core/pwa/app-icon';

export const alt = 'Homeish';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<AppIconMark />, size);
}
