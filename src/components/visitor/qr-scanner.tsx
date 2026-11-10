// Scan visitor QR codes with the device camera when the browser supports it.
'use client';

import { useEffect, useRef, useState } from 'react';

type Barcode = { rawValue: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<Barcode[]>;
};
type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorInstance;

export function QrScanner({
  active,
  onCode,
}: {
  active: boolean;
  onCode: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let stopped = false;

    async function start() {
      try {
        const Detector = (
          window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }
        ).BarcodeDetector;
        if (!Detector) {
          setError(
            'QR scanning is not supported in this browser. Enter the code manually.',
          );
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ['qr_code'] });

        async function scan() {
          if (
            stopped ||
            !video ||
            video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            if (!stopped) timer = window.setTimeout(scan, 250);
            return;
          }
          try {
            const barcode = (await detector.detect(video)).find(
              (item) => item.rawValue,
            );
            if (barcode) {
              onCode(barcode.rawValue);
              return;
            }
          } catch {
            setError(
              'Could not read the QR code. Keep it in view or enter the code manually.',
            );
          }
          if (!stopped) timer = window.setTimeout(scan, 250);
        }

        void scan();
      } catch {
        setError('Camera access is unavailable. Enter the code manually.');
      }
    }

    void start();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, onCode]);

  if (!active) return null;
  return (
    <div className="grid gap-space-2">
      <video
        aria-label="Camera view for scanning a visitor QR code"
        className="aspect-video w-full rounded-md bg-ink"
        muted
        playsInline
        ref={videoRef}
      />
      {error ? (
        <p
          aria-live="polite"
          className="text-caption text-danger"
          role="status"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
