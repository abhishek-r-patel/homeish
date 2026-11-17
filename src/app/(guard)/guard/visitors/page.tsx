// Show the guard's active visitor workflow and short, touch-friendly actions.
import { Card } from '@/components/ui/data-display';
import {
  VisitorActionForm,
  VisitorCodeControl,
} from '@/components/visitor/action-form';
import { VisitorPhotoUpload } from '@/components/visitor/photo-upload';
import { VisitorRealtimeRefresh } from '@/components/visitor/realtime-refresh';
import { requireIdentifiedGuard } from '@/core/guards/operations';
import {
  listVisitorEntries,
  getVisitorSettings,
  getVisitorRealtimeSocietyId,
  getVisitorSocietyTimezone,
  listVisitorUnits,
} from '@/core/visitor/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage, type MessageValues } from '@/core/i18n/messages';
import { formatLocalizedTime } from '@/core/i18n/format';
import {
  checkInPreApprovedVisitorAction,
  checkOutVisitorAction,
  createVisitorEntryAction,
  overrideVisitorAction,
  validateVisitorCodeAction,
} from './actions';

export const metadata = {
  title: 'Visitors at the gate | Homeish',
  robots: { index: false, follow: false },
};

function unitLabel(unit: { block: string | null; number: string }) {
  return unit.block ? `${unit.block} · ${unit.number}` : unit.number;
}

export default async function GuardVisitorsPage() {
  const locale = await getRequestLocale();
  const t = (source: string, values?: MessageValues) =>
    translateMessage(locale, source, values);
  const [guard, units, waiting, inside, today, settings, societyId, timezone] =
    await Promise.all([
      requireIdentifiedGuard(),
      listVisitorUnits(),
      listVisitorEntries('waiting'),
      listVisitorEntries('inside'),
      listVisitorEntries('today'),
      getVisitorSettings(),
      getVisitorRealtimeSocietyId(),
      getVisitorSocietyTimezone(),
    ]);
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          {t('Gate · Handled by {name}', { name: guard.name })}
        </p>
        <h1 className="text-title font-semibold">{t('Visitors')}</h1>
      </header>
      <VisitorRealtimeRefresh gate societyId={societyId} />

      <Card
        description={t("Send a request to the unit's active approvers.")}
        title={t('New visitor')}
      >
        {units.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('No active units are available.')}
          </p>
        ) : (
          <VisitorActionForm
            action={createVisitorEntryAction}
            className="grid gap-space-3"
            requestIdStorageKey={`homeish:visitor-entry:${societyId}`}
          >
            <input name="clientRequestId" type="hidden" value="" />
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-unit"
            >
              {t('Unit')}
              <select
                className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                id="visitor-unit"
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
              htmlFor="visitor-name"
            >
              {t('Visitor name')}
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="visitor-name"
                maxLength={120}
                name="visitorName"
                required
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-phone"
            >
              {t('Mobile number (optional)')}
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="visitor-phone"
                inputMode="tel"
                name="visitorPhone"
                type="tel"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-purpose"
            >
              {t('Purpose')}
              <select
                className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                id="visitor-purpose"
                name="purpose"
                required
              >
                <option value="guest">{t('Guest')}</option>
                <option value="cab">{t('Cab')}</option>
                <option value="service">{t('Service')}</option>
                <option value="official">{t('Official')}</option>
                <option value="other">{t('Other')}</option>
              </select>
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-people-count"
            >
              {t('Number of people')}
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                defaultValue={1}
                id="visitor-people-count"
                max={50}
                min={1}
                name="peopleCount"
                type="number"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-vehicle"
            >
              {t('Vehicle number (optional)')}
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="visitor-vehicle"
                maxLength={20}
                name="vehicleNo"
              />
            </label>
            <VisitorPhotoUpload
              required={settings.photo_required}
              unitSelectId="visitor-unit"
            />
            <button
              className="min-h-14 rounded-md bg-brand px-space-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-focus"
              type="submit"
            >
              {t('Notify resident')}
            </button>
          </VisitorActionForm>
        )}
      </Card>

      <Card
        description={t('Waiting requests update on refresh.')}
        title={t('Waiting for response')}
      >
        {waiting.length ? (
          <ul className="grid gap-space-3">
            {waiting.map((entry) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <p className="text-body-strong">{entry.visitor_name}</p>
                <p className="text-caption text-ink-muted">
                  {entry.purpose} ·{' '}
                  {t('{count} people', { count: entry.people_count })}
                  {entry.is_blacklisted ? ` · ${t('Blacklist warning')}` : ''}
                </p>
                {entry.respond_by ? (
                  <p className="text-caption text-ink-muted">
                    <time dateTime={entry.respond_by}>
                      {t('Respond by {date}', {
                        date: formatLocalizedTime(
                          new Date(entry.respond_by),
                          locale,
                          { timeZone: timezone },
                        ),
                      })}
                    </time>
                  </p>
                ) : null}
                {settings.guard_override_allowed ? (
                  <VisitorActionForm
                    action={overrideVisitorAction}
                    className="grid gap-space-2"
                  >
                    <input name="entryId" type="hidden" value={entry.id} />
                    <label
                      className="grid gap-space-1 text-caption"
                      htmlFor={`override-${entry.id}`}
                    >
                      {t('Allow by guard (reason required)')}
                      <input
                        className="min-h-11 rounded-md border border-rule px-space-3"
                        id={`override-${entry.id}`}
                        maxLength={500}
                        name="reason"
                        required
                      />
                    </label>
                    <button
                      className="min-h-12 rounded-md border border-rule-strong px-space-3 font-semibold text-ink"
                      type="submit"
                    >
                      {t('Allow by guard')}
                    </button>
                  </VisitorActionForm>
                ) : (
                  <p className="text-caption text-ink-muted">
                    {t('Guard approval is disabled for this society.')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No visitors are waiting.')}
          </p>
        )}
      </Card>

      <Card
        description={t('Check out visitors as they leave.')}
        title={t('Inside now')}
      >
        {inside.length ? (
          <ul className="grid gap-space-3">
            {inside.map((entry) => (
              <li
                className="flex flex-wrap items-center justify-between gap-space-3 rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <div>
                  <p className="text-body-strong">{entry.visitor_name}</p>
                  <p className="text-caption text-ink-muted">
                    {entry.is_overstay
                      ? t('Still inside · Overstay')
                      : t('Still inside')}
                  </p>
                </div>
                <VisitorActionForm action={checkOutVisitorAction}>
                  <input name="entryId" type="hidden" value={entry.id} />
                  <button
                    className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold"
                    type="submit"
                  >
                    {t('Check out')}
                  </button>
                </VisitorActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No visitors are inside.')}
          </p>
        )}
      </Card>

      <Card
        description={t('Entries handled at this gate today.')}
        title={t('Today')}
      >
        {today.length ? (
          <ol className="grid gap-space-2">
            {today.map((entry) => (
              <li
                className="rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <p className="text-body-strong">{entry.visitor_name}</p>
                <p className="text-caption text-ink-muted">
                  {entry.purpose} · {entry.status}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No visitor entries today.')}
          </p>
        )}
      </Card>

      <Card
        description={t(
          "Enter a 6-digit code from the resident's QR or message.",
        )}
        title={t('Validate pre-approved code')}
      >
        <VisitorCodeControl
          checkInAction={checkInPreApprovedVisitorAction}
          validateAction={validateVisitorCodeAction}
        />
      </Card>
    </section>
  );
}
