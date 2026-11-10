// Show the society delivery log and administrator-only delivery settings.
import { Card } from '@/components/ui/data-display';
import { DeliveryActionForm } from '@/components/delivery/action-form';
import { DeliveryRealtimeRefresh } from '@/components/delivery/realtime-refresh';
import {
  getDeliveryAdminAccess,
  getDeliveryRealtimeSocietyId,
  getDeliverySettings,
  getDeliverySocietyTimezone,
  listDeliveryEntries,
  listDeliveryUnits,
} from '@/core/delivery/operations';
import { updateDeliverySettingsAction } from './actions';

export const metadata = {
  title: 'Delivery management | Homeish',
  robots: { index: false, follow: false },
};

function dateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

function unitLabel(unit: { block: string | null; number: string }) {
  return unit.block ? `${unit.block} · ${unit.number}` : unit.number;
}

export default async function AdminDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const access = await getDeliveryAdminAccess();
  const [{ q, status }, entries, units, settings, societyId, timezone] =
    await Promise.all([
      searchParams,
      listDeliveryEntries('all'),
      listDeliveryUnits(),
      access.canManage ? getDeliverySettings() : Promise.resolve(null),
      getDeliveryRealtimeSocietyId(),
      getDeliverySocietyTimezone(),
    ]);
  const unitLabels = new Map(units.map((unit) => [unit.id, unitLabel(unit)]));
  const query = q?.trim().toLocaleLowerCase() ?? '';
  const visibleEntries = entries.filter((entry) => {
    const matchesStatus =
      !status || status === 'all' || entry.status === status;
    const matchesQuery =
      !query ||
      entry.company.toLocaleLowerCase().includes(query) ||
      (entry.delivery_person?.toLocaleLowerCase().includes(query) ?? false) ||
      (unitLabels.get(entry.unit_id)?.toLocaleLowerCase().includes(query) ??
        false);
    return matchesStatus && matchesQuery;
  });

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Delivery management</h1>
        <p className="text-body text-ink-muted">
          Review delivery activity and configure response and collection rules.
        </p>
      </header>
      <DeliveryRealtimeRefresh societyId={societyId} />

      {access.canManage && settings ? (
        <Card
          description="Updates apply immediately to new delivery requests."
          title="Delivery settings"
        >
          <DeliveryActionForm
            action={updateDeliverySettingsAction}
            className="grid gap-space-3"
          >
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="delivery-response-timeout"
            >
              Resident response timeout (minutes)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                defaultValue={settings.response_timeout_minutes}
                id="delivery-response-timeout"
                max={30}
                min={1}
                name="responseTimeoutMinutes"
                required
                type="number"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="delivery-uncollected-days"
            >
              Mark uncollected after (days)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                defaultValue={settings.uncollected_days}
                id="delivery-uncollected-days"
                max={90}
                min={1}
                name="uncollectedDays"
                required
                type="number"
              />
            </label>
            <label className="flex min-h-12 items-center gap-space-2 text-body-strong">
              <input
                defaultChecked={settings.leave_at_gate_enabled}
                name="leaveAtGateEnabled"
                type="checkbox"
              />
              Allow residents to request leaving deliveries at the gate
            </label>
            <button
              className="min-h-12 w-fit rounded-md bg-brand px-space-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-focus"
              type="submit"
            >
              Save settings
            </button>
          </DeliveryActionForm>
        </Card>
      ) : null}

      <Card title="Delivery log">
        <form className="mb-space-4 flex flex-wrap gap-space-2" method="get">
          <label
            className="grid gap-space-1 text-caption"
            htmlFor="delivery-search"
          >
            Search company, person or unit
            <input
              className="min-h-11 rounded-md border border-rule px-space-3"
              defaultValue={q ?? ''}
              id="delivery-search"
              name="q"
            />
          </label>
          <label
            className="grid gap-space-1 text-caption"
            htmlFor="delivery-status"
          >
            Status
            <select
              className="min-h-11 rounded-md border border-rule bg-surface px-space-3"
              defaultValue={status ?? 'all'}
              id="delivery-status"
              name="status"
            >
              <option value="all">All</option>
              <option value="pending_response">Waiting</option>
              <option value="allowed">Allowed inside</option>
              <option value="left_at_gate">Left at gate</option>
              <option value="denied">Denied / returned</option>
              <option value="collected">Collected</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <button
            className="min-h-11 self-end rounded-md bg-brand px-space-4 font-semibold text-white"
            type="submit"
          >
            Filter
          </button>
        </form>
        {visibleEntries.length ? (
          <ol className="grid gap-space-3">
            {visibleEntries.map((entry) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <p className="text-body-strong">{entry.company}</p>
                <p className="text-caption text-ink-muted">
                  {unitLabels.get(entry.unit_id) ?? 'Unit'} ·{' '}
                  {entry.delivery_type} · {entry.status.replaceAll('_', ' ')}
                  {entry.delivery_person ? ` · ${entry.delivery_person}` : ''}
                </p>
                <time
                  className="text-caption text-ink-muted"
                  dateTime={entry.created_at}
                >
                  {dateTime(entry.created_at, timezone)}
                </time>
                {entry.photo_url ? (
                  <a
                    className="w-fit text-body-strong underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus"
                    href={entry.photo_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View delivery photo
                  </a>
                ) : null}
                {entry.is_uncollected_overdue ? (
                  <p className="text-caption text-danger">
                    Uncollected beyond the configured threshold.
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">
            No deliveries match these filters.
          </p>
        )}
      </Card>
    </section>
  );
}
