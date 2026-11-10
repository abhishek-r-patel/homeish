// Let a signed-in user opt in to and out of Web Push on this device.
'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { publicEnvironment } from '../../core/config/public-env';

type PushState = 'loading' | 'subscribed' | 'unsubscribed';

function pushSupportChanged() {
  return () => {};
}

function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const decoded = window.atob(
    `${value}${padding}`.replaceAll('-', '+').replaceAll('_', '/'),
  );
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function updateSubscription(method: 'DELETE' | 'POST', body: unknown) {
  const response = await fetch('/api/push/subscriptions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Push settings could not be updated.');
  }
}

export function PushSubscriptionControl() {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const supported = useSyncExternalStore(
    pushSupportChanged,
    isPushSupported,
    () => false,
  );

  useEffect(() => {
    let active = true;
    if (!supported) return;

    void navigator.serviceWorker
      .getRegistration('/')
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setState(subscription ? 'subscribed' : 'unsubscribed');
      })
      .catch(() => {
        if (active) setState('unsubscribed');
      });

    return () => {
      active = false;
    };
  }, [supported]);

  async function subscribe() {
    setBusy(true);
    setMessage('');
    try {
      const permission =
        Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission !== 'granted') {
        setMessage('Allow notifications in your browser to turn on alerts.');
        return;
      }

      const registration = await navigator.serviceWorker.register(
        '/service-worker.js',
        { scope: '/', updateViaCache: 'none' },
      );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(
          publicEnvironment.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        ),
      });
      const serialized = subscription.toJSON();
      if (
        !serialized.endpoint ||
        !serialized.keys?.auth ||
        !serialized.keys.p256dh
      ) {
        await subscription.unsubscribe();
        throw new Error('The browser returned an incomplete subscription.');
      }
      try {
        await updateSubscription('POST', {
          endpoint: serialized.endpoint,
          keys: serialized.keys,
        });
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
      setState('subscribed');
    } catch {
      setMessage('Notifications could not be enabled. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await updateSubscription('DELETE', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState('unsubscribed');
    } catch {
      setMessage('Notifications could not be disabled. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-caption text-ink-muted">
        Push alerts are not supported in this browser.
      </p>
    );
  }
  if (state === 'loading') {
    return (
      <p className="text-caption text-ink-muted">Checking device alerts…</p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-space-3">
      <button
        className="min-h-11 rounded-md border border-rule-strong px-space-4 text-body-strong text-brand focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
        disabled={busy}
        onClick={state === 'subscribed' ? unsubscribe : subscribe}
        type="button"
      >
        {busy
          ? 'Updating…'
          : state === 'subscribed'
            ? 'Turn off device alerts'
            : 'Turn on device alerts'}
      </button>
      {message ? (
        <p
          aria-live="polite"
          className="text-caption text-danger"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
