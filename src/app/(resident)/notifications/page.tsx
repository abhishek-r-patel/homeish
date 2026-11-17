// Render the signed-in user's notification inbox.
import Link from 'next/link';
import { NotificationRealtimeRefresh } from '@/components/notifications/notification-realtime-refresh';
import { PushSubscriptionControl } from '@/components/notifications/push-subscription-control';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from './actions';
import { listNotifications } from '@/core/notifications/operations';
import { notificationPath } from '@/core/notifications/links';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { formatLocalizedDateTime } from '@/core/i18n/format';

function notificationHref(entityType: string | null, entityId: string | null) {
  return notificationPath(entityType, entityId, (value) => value.length > 0);
}

export default async function NotificationsPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const notifications = await listNotifications();

  return (
    <div className="mx-auto grid max-w-content-default gap-space-5">
      <NotificationRealtimeRefresh />
      <header className="flex flex-wrap items-start justify-between gap-space-4">
        <div>
          <h1 className="text-heading font-semibold text-ink">
            {t('Notifications')}
          </h1>
          <p className="mt-space-2 text-body text-ink-muted">
            {t('Updates for your account and household.')}
          </p>
        </div>
        {notifications.some((notification) => !notification.read_at) ? (
          <form action={markAllNotificationsReadAction}>
            <button
              className="min-h-11 rounded-md border border-rule-strong px-space-4 text-body-strong text-brand focus-visible:outline-2 focus-visible:outline-focus"
              type="submit"
            >
              {t('Mark all as read')}
            </button>
          </form>
        ) : null}
      </header>

      <section
        aria-label={t('Device alerts')}
        className="grid gap-space-3 rounded-lg border border-rule bg-surface p-space-4"
      >
        <div>
          <h2 className="text-body-strong font-semibold text-ink">
            {t('Device alerts')}
          </h2>
          <p className="mt-space-1 text-caption text-ink-muted">
            {t('Choose whether this device can receive short push alerts.')}
          </p>
        </div>
        <PushSubscriptionControl />
      </section>

      {notifications.length === 0 ? (
        <div className="py-space-8 text-center">
          <h2 className="text-title font-semibold text-ink">
            {t("You're all caught up")}
          </h2>
          <p className="mt-space-2 text-body text-ink-muted">
            {t('New updates will appear here.')}
          </p>
        </div>
      ) : (
        <ol aria-label={t('Recent notifications')} className="grid gap-space-3">
          {notifications.map((notification) => {
            const href = notificationHref(
              notification.entity_type,
              notification.entity_id,
            );
            return (
              <li
                className={`rounded-lg border p-space-4 ${notification.read_at ? 'border-rule bg-surface' : 'border-brand/40 bg-brand-tint/30'}`}
                key={notification.id}
              >
                <article className="grid gap-space-2">
                  <div className="flex flex-wrap items-start justify-between gap-space-3">
                    <h2 className="text-body-strong font-semibold text-ink">
                      {href ? (
                        <Link
                          className="underline-offset-4 hover:underline"
                          href={href}
                        >
                          {notification.title}
                        </Link>
                      ) : (
                        notification.title
                      )}
                    </h2>
                    <time
                      className="text-caption text-ink-muted"
                      dateTime={notification.created_at}
                    >
                      {formatLocalizedDateTime(
                        new Date(notification.created_at),
                        locale,
                        {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Asia/Kolkata',
                        },
                      )}
                    </time>
                  </div>
                  <p className="text-body text-ink-muted">
                    {notification.body}
                  </p>
                  {!notification.read_at ? (
                    <form action={markNotificationReadAction}>
                      <input
                        name="notificationId"
                        type="hidden"
                        value={notification.id}
                      />
                      <button
                        className="min-h-10 rounded-md px-space-2 text-caption font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                        type="submit"
                      >
                        {t('Mark as read')}
                      </button>
                    </form>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
