// Show the guard delivery workflow, expected deliveries, waiting responses and parcels.
import { Card } from '@/components/ui/data-display';
import { DeliveryActionForm } from '@/components/delivery/action-form';
import { DeliveryPhotoUpload } from '@/components/delivery/photo-upload';
import { DeliveryRealtimeRefresh } from '@/components/delivery/realtime-refresh';
import { requireIdentifiedGuard } from '@/core/guards/operations';
import {
  getDeliveryRealtimeSocietyId,
  getDeliverySocietyTimezone,
  getDeliverySettings,
  listDeliveryEntries,
  listDeliveryPreAnnouncements,
  listDeliveryUnits,
} from '@/core/delivery/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage, type MessageValues } from '@/core/i18n/messages';
import { formatLocalizedDateTime } from '@/core/i18n/format';
import {
  collectDeliveryAsGuardAction,
  createDeliveryEntryAction,
  overrideDeliveryAction,
} from './actions';

export const metadata = {
  title: 'Deliveries at the gate | Homeish',
  robots: { index: false, follow: false },
};

function unitLabel(unit: { block: string | null; number: string }) {
  return unit.block ? `${unit.block} · ${unit.number}` : unit.number;
}

function dateTime(value: string, timeZone: string, locale: 'en' | 'hi') {
  return formatLocalizedDateTime(new Date(value), locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });
}

export default async function GuardDeliveriesPage() {
  const locale = await getRequestLocale();
  const t = (source: string, values?: MessageValues) =>
    translateMessage(locale, source, values);
  const [
    guard,
    units,
    waiting,
    uncollected,
    today,
    settings,
    societyId,
    timezone,
    expected,
  ] = await Promise.all([
    requireIdentifiedGuard(),
    listDeliveryUnits(),
    listDeliveryEntries('waiting'),
    listDeliveryEntries('uncollected'),
    listDeliveryEntries('today'),
    getDeliverySettings(),
    getDeliveryRealtimeSocietyId(),
    getDeliverySocietyTimezone(),
    listDeliveryPreAnnouncements(),
  ]);
  const unitLabels = new Map(units.map((unit) => [unit.id, unitLabel(unit)]));

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          {t('Gate · Handled by {name}', { name: guard.name })}
        </p>
        <h1 className="text-title font-semibold">{t('Deliveries')}</h1>
      </header>
      <DeliveryRealtimeRefresh gate societyId={societyId} />

      <Card
        description={t(
          "The unit's standing preference is applied automatically; otherwise residents are asked.",
        )}
        title={t('Log a delivery')}
      >
        {units.length ? (
          <DeliveryActionForm
            action={createDeliveryEntryAction}
            className="grid gap-space-3"
            requestIdStorageKey={`homeish:delivery-entry:${societyId}`}
          >
            <input name="clientRequestId" type="hidden" value="" />
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="delivery-unit"
            >
              {t('Unit')}
              <select
                className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                id="delivery-unit"
                name="unitId"
                required
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unitLabel(unit)}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="delivery-company"
            >
              {t('Company or platform')}
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                list="delivery-company-options"
                id="delivery-company"
                maxLength={60}
                name="company"
                required
              />
              <datalist id="delivery-company-options">
                <option value="Amazon" />
                <option value="BigBasket" />
                <option value="Blinkit" />
                <option value="Dunzo" />
                <option value="Flipkart" />
                <option value="Swiggy" />
                <option value="Zepto" />
                <option value="Zomato" />
              </datalist>
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="delivery-person"
            >
              {t('Delivery person (optional)')}
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="delivery-person"
                maxLength={120}
                name="deliveryPerson"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="delivery-type"
            >
              {t('Type')}
              <select
                className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                id="delivery-type"
                name="deliveryType"
                required
              >
                <option value="food">{t('Food')}</option>
                <option value="parcel">{t('Parcel')}</option>
                <option value="grocery">{t('Grocery')}</option>
                <option value="other">{t('Other')}</option>
              </select>
            </label>
            <DeliveryPhotoUpload unitSelectId="delivery-unit" />
            <button
              className="min-h-14 rounded-md bg-brand px-space-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-focus"
              type="submit"
            >
              {t('Notify resident')}
            </button>
          </DeliveryActionForm>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No active units are available.')}
          </p>
        )}
      </Card>

      <Card
        description={t('Residents told the gate about these deliveries.')}
        title={t('Expected deliveries')}
      >
        {expected.length ? (
          <ul className="grid gap-space-3">
            {expected.map((announcement) => (
              <li
                className="grid gap-space-1 rounded-md border border-rule p-space-3"
                key={announcement.id}
              >
                <p className="text-body-strong">{announcement.platform}</p>
                <p className="text-caption text-ink-muted">
                  {unitLabels.get(announcement.unit_id) ?? t('Unit')} ·{' '}
                  {dateTime(announcement.expected_from, timezone, locale)}{' '}
                  {t('to')}{' '}
                  {dateTime(announcement.expected_to, timezone, locale)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No expected deliveries.')}
          </p>
        )}
      </Card>

      <Card
        description={t('Residents have {minutes} minutes to respond.', {
          minutes: settings.response_timeout_minutes,
        })}
        title={t('Waiting for response')}
      >
        {waiting.length ? (
          <ul className="grid gap-space-3">
            {waiting.map((entry) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <p className="text-body-strong">{entry.company}</p>
                <p className="text-caption text-ink-muted">
                  {unitLabels.get(entry.unit_id) ?? t('Unit')} ·{' '}
                  {entry.delivery_type}
                  {entry.delivery_person ? ` · ${entry.delivery_person}` : ''}
                </p>
                {entry.respond_by ? (
                  <p className="text-caption text-ink-muted">
                    {t('Respond by {date}', {
                      date: dateTime(entry.respond_by, timezone, locale),
                    })}
                  </p>
                ) : null}
                {entry.is_response_overdue ? (
                  <DeliveryActionForm
                    action={overrideDeliveryAction}
                    className="grid gap-space-2"
                  >
                    <input name="entryId" type="hidden" value={entry.id} />
                    <label
                      className="grid gap-space-1 text-caption"
                      htmlFor={`delivery-override-${entry.id}`}
                    >
                      {t('Decision and reason for handling the timeout')}
                      <select
                        className="min-h-11 rounded-md border border-rule bg-surface px-space-3"
                        defaultValue="allowed"
                        name="decision"
                      >
                        <option value="allowed">{t('Send inside')}</option>
                        {settings.leave_at_gate_enabled ? (
                          <option value="left_at_gate">
                            {t('Leave at gate')}
                          </option>
                        ) : null}
                        <option value="denied">{t('Deny / return')}</option>
                        <option value="closed">{t('Close request')}</option>
                      </select>
                      <textarea
                        className="min-h-20 rounded-md border border-rule px-space-3 py-space-2"
                        id={`delivery-override-${entry.id}`}
                        maxLength={500}
                        name="reason"
                        required
                      />
                    </label>
                    <button
                      className="min-h-11 w-fit rounded-md border border-rule-strong px-space-3 font-semibold"
                      type="submit"
                    >
                      {t('Record guard decision')}
                    </button>
                  </DeliveryActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No deliveries are waiting for a response.')}
          </p>
        )}
      </Card>

      <Card
        description={t('Parcels are overdue after {days} days.', {
          days: settings.uncollected_days,
        })}
        title={t('Uncollected at the gate')}
      >
        {uncollected.length ? (
          <ul className="grid gap-space-3">
            {uncollected.map((entry) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <p className="text-body-strong">
                  {entry.company}
                  {entry.is_uncollected_overdue ? (
                    <span className="ml-space-2 text-danger">
                      {t('Overdue')}
                    </span>
                  ) : null}
                </p>
                <p className="text-caption text-ink-muted">
                  {unitLabels.get(entry.unit_id) ?? t('Unit')} ·{' '}
                  {entry.delivery_type}
                </p>
                {entry.photo_url ? (
                  <a
                    className="w-fit text-body-strong underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus"
                    href={entry.photo_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t('View delivery photo')}
                  </a>
                ) : null}
                {entry.received_at ? (
                  <time
                    className="text-caption text-ink-muted"
                    dateTime={entry.received_at}
                  >
                    {t('Left at gate {date}', {
                      date: dateTime(entry.received_at, timezone, locale),
                    })}
                  </time>
                ) : null}
                <DeliveryActionForm
                  action={collectDeliveryAsGuardAction}
                  className="w-fit"
                >
                  <input name="entryId" type="hidden" value={entry.id} />
                  <button
                    className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
                    type="submit"
                  >
                    {t('Mark collected')}
                  </button>
                </DeliveryActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No parcels are waiting to be collected.')}
          </p>
        )}
      </Card>

      <Card title={t('Today at the gate')}>
        {today.length ? (
          <ol className="grid gap-space-2">
            {today.map((entry) => (
              <li
                className="rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <p className="text-body-strong">{entry.company}</p>
                <p className="text-caption text-ink-muted">
                  {unitLabels.get(entry.unit_id) ?? t('Unit')} ·{' '}
                  {entry.delivery_type} · {entry.status.replaceAll('_', ' ')}
                </p>
                <time
                  className="text-caption text-ink-muted"
                  dateTime={entry.created_at}
                >
                  {dateTime(entry.created_at, timezone, locale)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No deliveries were logged today.')}
          </p>
        )}
      </Card>
    </section>
  );
}
