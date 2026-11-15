// Keep open SOS alerts in front of every recipient until they dismiss them, with a repeating gate alarm.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createNotificationBrowserClient } from '../../core/notifications/browser-client';
import {
  formatSosTimestamp,
  sosBannerTitle,
} from '../../core/sos/presentation';
import {
  sosBannerAlertsSchema,
  type SosBannerAlert,
} from '../../core/sos/validation';
import { Button } from '../ui/button';

export const SOS_ALARM_INTERVAL_MS = 30_000;
const POLL_INTERVAL_MS = 30_000;

export type SosSoundState = 'off' | 'unsupported' | 'blocked' | 'on' | 'muted';

function respondHref(alert: SosBannerAlert) {
  if (alert.audience === 'guard') return '/guard/sos';
  if (alert.audience === 'resident') return '/sos';
  return '/admin/sos';
}

export function SosAlertBannerView({
  alerts,
  sound,
  pendingId = null,
  error = null,
  onDismiss,
  onEnableSound,
  onToggleMute,
}: {
  alerts: readonly SosBannerAlert[];
  sound: SosSoundState;
  pendingId?: string | null;
  error?: string | null;
  onDismiss: (alertId: string) => void;
  onEnableSound?: () => void;
  onToggleMute?: () => void;
}) {
  if (alerts.length === 0) return null;
  const societies = new Set(alerts.map((alert) => alert.society_id));
  return (
    <section
      aria-label="Emergency alerts"
      className="sticky top-14 z-10 max-h-[50dvh] overflow-y-auto expanded:top-16 mb-space-4 grid min-w-0 gap-space-2 rounded-md border-2 border-danger bg-danger-tint px-space-4 py-space-3 text-danger shadow-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-space-2">
        <p className="flex items-center gap-space-2 text-body-strong">
          <span
            aria-hidden="true"
            className="size-3 rounded-full bg-danger motion-safe:animate-pulse"
          />
          <span role="alert">
            {alerts.length === 1
              ? 'Emergency SOS open'
              : `${alerts.length} emergency SOS alerts open`}
          </span>
        </p>
        {sound === 'blocked' && onEnableSound ? (
          <Button variant="destructive" onClick={onEnableSound}>
            Turn on alert sound
          </Button>
        ) : (sound === 'on' || sound === 'muted') && onToggleMute ? (
          <Button
            variant="secondary"
            aria-pressed={sound === 'muted'}
            onClick={onToggleMute}
          >
            {sound === 'muted' ? 'Unmute alert sound' : 'Mute alert sound'}
          </Button>
        ) : null}
      </div>
      {sound === 'blocked' ? (
        <p className="text-caption">
          This browser blocked the alarm until you interact with the page.
        </p>
      ) : sound === 'unsupported' ? (
        <p className="text-caption">
          This device cannot play the alarm. Keep this screen in view.
        </p>
      ) : null}
      <ul className="grid gap-space-2">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex flex-col gap-space-2 rounded-md border border-danger bg-surface p-space-3 text-ink medium:flex-row medium:items-center medium:justify-between"
          >
            <div className="grid min-w-0 gap-space-1 [overflow-wrap:anywhere]">
              <p className="text-body-strong text-danger">
                {sosBannerTitle(alert)}
              </p>
              <p className="text-caption text-ink-muted">
                {alert.status === 'acknowledged'
                  ? 'A responder is on it'
                  : 'Waiting for a responder'}{' '}
                ·{' '}
                <time dateTime={alert.raised_at}>
                  {formatSosTimestamp(alert.raised_at)}
                </time>
                {societies.size > 1 ? ` · ${alert.society_name}` : ''}
              </p>
              {alert.note ? <p className="text-body">{alert.note}</p> : null}
            </div>
            <div className="flex flex-wrap gap-space-2">
              {alert.audience !== 'resident' ? (
                <Link
                  href={respondHref(alert)}
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-danger bg-danger px-space-4 text-body-strong text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Respond
                </Link>
              ) : null}
              <Button
                variant="secondary"
                loading={pendingId === alert.id}
                aria-label={`Dismiss ${sosBannerTitle(alert)}`}
                onClick={() => onDismiss(alert.id)}
              >
                {alert.audience === 'resident'
                  ? 'Dismiss'
                  : 'Seen — stop alert'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-caption">
          {error}
        </p>
      ) : null}
    </section>
  );
}

type AudioContextConstructor = new () => AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const legacy = (
    window as unknown as { webkitAudioContext?: AudioContextConstructor }
  ).webkitAudioContext;
  return window.AudioContext ?? legacy ?? null;
}

function playAlarm(context: AudioContext) {
  const start = context.currentTime;
  for (let pulse = 0; pulse < 3; pulse += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.15;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + pulse * 0.35);
    oscillator.stop(start + pulse * 0.35 + 0.2);
  }
}

export function SosAlertBanner({ alarm = false }: { alarm?: boolean }) {
  const [alerts, setAlerts] = useState<SosBannerAlert[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [mutedKey, setMutedKey] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const supported = alarm && audioContextConstructor() !== null;
  const alertKey = alerts
    .filter((alert) => alert.audience === 'guard')
    .map((alert) => alert.id)
    .join(',');
  const muted = mutedKey !== null && mutedKey === alertKey;

  const load = useCallback(async () => {
    const client = createNotificationBrowserClient();
    const { data, error: loadError } = await client.rpc('sos_my_alerts');
    if (loadError) return false;
    const parsed = sosBannerAlertsSchema.safeParse(data);
    if (parsed.success) setAlerts(parsed.data);
    return parsed.success;
  }, []);

  useEffect(() => {
    let active = true;
    const client = createNotificationBrowserClient();
    let channel: ReturnType<typeof client.channel> | undefined;
    let subscribed = false;
    const refresh = () => {
      if (active) void load().catch(() => undefined);
    };
    refresh();
    // Realtime is a hint; polling covers outages and status changes without a notification.
    const poll = setInterval(() => {
      if (!subscribed || document.visibilityState === 'visible') refresh();
    }, POLL_INTERVAL_MS);
    void client.auth
      .getUser()
      .then(({ data }) => {
        if (!data.user || !active) return;
        channel = client
          .channel(`sos-banner:${data.user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${data.user.id}`,
            },
            refresh,
          )
          .subscribe((status) => {
            subscribed = status === 'SUBSCRIBED';
            if (subscribed) refresh();
          });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      clearInterval(poll);
      if (channel) void client.removeChannel(channel);
    };
  }, [load]);

  const ring = useCallback(() => {
    const Constructor = audioContextConstructor();
    if (!Constructor) return;
    try {
      audio.current ??= new Constructor();
    } catch {
      return;
    }
    const context = audio.current;
    if (context.state === 'running') {
      setBlocked(false);
      playAlarm(context);
      return;
    }
    void context.resume().then(() => {
      if (context.state === 'running') {
        setBlocked(false);
        playAlarm(context);
      }
    });
    // Browsers keep resume() pending until a user gesture; surface a control instead of failing silently.
    setTimeout(() => {
      if (context.state !== 'running') setBlocked(true);
    }, 500);
  }, []);

  useEffect(() => {
    if (!supported || !alertKey || muted) return;
    ring();
    const timer = setInterval(ring, SOS_ALARM_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [supported, alertKey, muted, ring]);

  useEffect(() => {
    if (!blocked) return;
    const unlock = () => ring();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [blocked, ring]);

  useEffect(
    () => () => {
      void audio.current?.close().catch(() => undefined);
    },
    [],
  );

  async function dismiss(alertId: string) {
    setPendingId(alertId);
    setError(null);
    try {
      const { dismissSosAlertAction } =
        await import('../../app/(resident)/sos/actions');
      const form = new FormData();
      form.set('input', JSON.stringify({ alertId }));
      const result = await dismissSosAlertAction(form);
      if (result.ok) {
        setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      } else {
        setError(result.message);
      }
      await load();
    } catch {
      setError('Could not reach the server. The alert stays until you retry.');
    } finally {
      setPendingId(null);
    }
  }

  const sound: SosSoundState = !alertKey
    ? 'off'
    : !alarm
      ? 'off'
      : !supported
        ? 'unsupported'
        : muted
          ? 'muted'
          : blocked
            ? 'blocked'
            : 'on';

  return (
    <SosAlertBannerView
      alerts={alerts}
      sound={sound}
      pendingId={pendingId}
      error={error}
      onDismiss={(alertId) => void dismiss(alertId)}
      onEnableSound={ring}
      onToggleMute={() => setMutedKey(muted ? null : alertKey)}
    />
  );
}
