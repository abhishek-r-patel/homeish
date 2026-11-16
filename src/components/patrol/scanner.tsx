// Record checkpoint visits by camera QR scan when supported, always with typed-code entry as a fallback.
'use client';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  normalizePatrolCode,
  patrolScanInputSchema,
  patrolScanResultSchema,
} from '@/core/patrol/validation';
import { Button } from '@/components/ui/button';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';

type Barcode = { rawValue: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<Barcode[]>;
};
type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorInstance;

function barcodeDetector() {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
}

function subscribeNever() {
  return () => undefined;
}

function PatrolCamera({
  onCode,
  onFailure,
}: {
  onCode: (code: string) => void;
  onFailure: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let stopped = false;

    async function start() {
      const Detector = barcodeDetector();
      if (!Detector || !navigator.mediaDevices?.getUserMedia) {
        onFailure(
          'QR scanning is not supported on this phone. Type the code printed under the QR code instead.',
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch {
        onFailure(
          'Camera access is unavailable or was refused. Type the code printed under the QR code instead.',
        );
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        onFailure('The camera could not start. Type the code instead.');
        return;
      }
      const detector = new Detector({ formats: ['qr_code'] });
      async function scan() {
        if (stopped || !video) return;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            const barcode = (await detector.detect(video)).find(
              (item) => item.rawValue,
            );
            if (barcode && !stopped) {
              onCode(barcode.rawValue);
              return;
            }
          } catch {
            // Keep trying; a single frame can fail while the camera focuses.
          }
        }
        if (!stopped) timer = window.setTimeout(scan, 250);
      }
      void scan();
    }

    void start();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onCode, onFailure]);

  return (
    <video
      aria-label="Camera view for scanning a checkpoint QR code"
      className="aspect-video w-full rounded-md bg-ink"
      muted
      playsInline
      ref={videoRef}
    />
  );
}

export function PatrolScanPanel({ action }: { action: ModuleFormAction }) {
  const id = useId();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const supported = useSyncExternalStore(
    subscribeNever,
    () => Boolean(barcodeDetector()),
    () => null,
  );

  const failure = useCallback((message: string) => {
    setScanning(false);
    setResult({ ok: false, text: message });
  }, []);

  const detected = useCallback(
    (raw: string) => {
      setScanning(false);
      const code = normalizePatrolCode(raw);
      if (!code) {
        setResult({
          ok: false,
          text: 'That QR code is not a Homeish checkpoint. Scan the checkpoint sticker or type its code.',
        });
        return;
      }
      setPending(true);
      setResult(null);
      const form = new FormData();
      form.set(
        'input',
        JSON.stringify(
          patrolScanInputSchema.parse({
            code,
            method: 'qr',
            clientRequestId: crypto.randomUUID(),
          }),
        ),
      );
      action(form)
        .then((response: ServerActionResult<unknown>) => {
          if (response.ok) {
            const scan = patrolScanResultSchema.safeParse(response.data);
            setResult({
              ok: true,
              text: scan.success
                ? `${scan.data.checkpoint_name} recorded.`
                : (response.message ?? 'Checkpoint recorded.'),
            });
            router.refresh();
          } else {
            setResult({
              ok: false,
              text: `${response.message}${response.referenceId ? ` Reference: ${response.referenceId}` : ''}`,
            });
          }
        })
        .catch(() =>
          setResult({
            ok: false,
            text: 'Could not reach the server. Scan again when you are back online.',
          }),
        )
        .finally(() => setPending(false));
    },
    [action, router],
  );

  return (
    <div className="grid min-w-0 gap-space-4">
      <div className="grid gap-space-3">
        {scanning ? (
          <>
            <PatrolCamera onCode={detected} onFailure={failure} />
            <Button
              size="guard"
              variant="secondary"
              onClick={() => setScanning(false)}
            >
              Stop camera
            </Button>
          </>
        ) : (
          <Button
            size="guard"
            loading={pending}
            disabled={pending}
            onClick={() => {
              setResult(null);
              if (!barcodeDetector()) {
                failure(
                  'QR scanning is not supported on this phone. Type the code printed under the QR code instead.',
                );
                return;
              }
              setScanning(true);
            }}
          >
            Scan checkpoint QR code
          </Button>
        )}
        {supported === false ? (
          <p className="text-caption text-ink-muted">
            This browser cannot scan QR codes. Type the code printed under the
            QR code instead.
          </p>
        ) : null}
        {result ? (
          <p
            role={result.ok ? 'status' : 'alert'}
            className={`text-body ${result.ok ? 'text-success' : 'text-danger'}`}
          >
            {result.text}
          </p>
        ) : null}
      </div>
      <ModuleActionForm
        action={action}
        idempotent
        submitLabel="Record checkpoint"
        input={(form, clientRequestId) =>
          patrolScanInputSchema.parse({
            code: String(form.get('code') ?? ''),
            method: 'typed',
            clientRequestId,
          })
        }
      >
        <TextInput
          id={`${id}-code`}
          name="code"
          label="Or type the checkpoint code"
          helpText="The 6 letters and numbers printed under the QR code, for example K7M 2QX."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          required
        />
      </ModuleActionForm>
    </div>
  );
}
