// Show resident visitor requests, history, pre-approvals and frequent visitors.
import Image from 'next/image';
import QRCode from 'qrcode';
import { Card, CodeDisplay } from '@/components/ui/data-display';
import { VisitorActionForm } from '@/components/visitor/action-form';
import { VisitorRealtimeRefresh } from '@/components/visitor/realtime-refresh';
import {
  getVisitorRealtimeSocietyId,
  getVisitorSocietyTimezone,
  listFrequentVisitors,
  listVisitorEntries,
  listVisitorPreApprovals,
  listVisitorUnits,
  requireVisitorResident,
  type VisitorPreApproval,
} from '@/core/visitor/operations';
import {
  cancelVisitorPreApprovalAction,
  createVisitorPreApprovalAction,
  decideVisitorAction,
  preApproveFrequentVisitorAction,
  removeFrequentVisitorAction,
  saveFrequentVisitorAction,
} from './actions';

export const metadata = {
  title: 'Visitors | Homeish',
  robots: { index: false, follow: false },
};

function unitLabel(unit: { block: string | null; number: string }) {
  return unit.block ? `${unit.block} · ${unit.number}` : unit.number;
}

export default async function ResidentVisitorsPage() {
  await requireVisitorResident();
  const [units, entries, societyId, timezone] = await Promise.all([
    listVisitorUnits('own'),
    listVisitorEntries('all'),
    getVisitorRealtimeSocietyId(),
    getVisitorSocietyTimezone(),
  ]);
  const preApprovals = (
    await Promise.all(units.map((unit) => listVisitorPreApprovals(unit.id)))
  ).flat();
  const frequentByUnit = await Promise.all(
    units.map(async (unit) => ({
      unit,
      visitors: await listFrequentVisitors(unit.id),
    })),
  );
  const approvalCards = await Promise.all(
    preApprovals.map(async (approval: VisitorPreApproval) => ({
      approval,
      qrCode:
        approval.status === 'active' && !approval.is_expired
          ? await QRCode.toDataURL(approval.code, {
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 192,
            })
          : null,
    })),
  );
  const pending = entries.filter((entry) => entry.status === 'pending');

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Visitors</h1>
        <p className="text-body text-ink-muted">
          Approve visitors at the gate and prepare one-time entry codes.
        </p>
      </header>
      <VisitorRealtimeRefresh societyId={societyId} />

      <Card
        description="Approvals close after the society's response timeout."
        title="Waiting for your response"
      >
        {pending.length ? (
          <ul className="grid gap-space-3">
            {pending.map((entry) => (
              <li
                className="grid gap-space-3 rounded-md border border-rule p-space-4"
                key={entry.id}
              >
                <div>
                  <h2 className="text-body-strong">{entry.visitor_name}</h2>
                  <p className="text-caption text-ink-muted">
                    {entry.purpose} · {entry.people_count} people
                    {entry.visitor_phone ? ` · ${entry.visitor_phone}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-space-2">
                  {(['approve', 'deny'] as const).map((decision) => (
                    <VisitorActionForm
                      action={decideVisitorAction}
                      className="inline"
                      key={decision}
                    >
                      <input name="entryId" type="hidden" value={entry.id} />
                      <input name="decision" type="hidden" value={decision} />
                      <button
                        className={`min-h-14 rounded-md px-space-5 font-semibold focus-visible:outline-2 focus-visible:outline-focus ${decision === 'approve' ? 'bg-brand text-white' : 'border border-rule-strong text-ink'}`}
                        type="submit"
                      >
                        {decision === 'approve' ? 'Allow' : 'Deny'}
                      </button>
                    </VisitorActionForm>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">No visitors need approval.</p>
        )}
      </Card>

      <Card
        description="The QR and manual code represent the same single-use approval."
        title="Pre-approve a visitor"
      >
        {units.length ? (
          <VisitorActionForm
            action={createVisitorPreApprovalAction}
            className="grid gap-space-3"
          >
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="preapproval-unit"
            >
              Unit
              <select
                className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                id="preapproval-unit"
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
              htmlFor="preapproval-name"
            >
              Visitor name
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="preapproval-name"
                maxLength={120}
                name="visitorName"
                required
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="preapproval-from"
            >
              Valid from (society time)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="preapproval-from"
                name="validFrom"
                required
                type="datetime-local"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="preapproval-to"
            >
              Valid until (society time)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="preapproval-to"
                name="validTo"
                required
                type="datetime-local"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="preapproval-vehicle"
            >
              Vehicle number (optional)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="preapproval-vehicle"
                maxLength={20}
                name="vehicleNo"
              />
            </label>
            <button
              className="min-h-14 rounded-md bg-brand px-space-4 font-semibold text-white"
              type="submit"
            >
              Create pre-approval
            </button>
          </VisitorActionForm>
        ) : (
          <p className="text-body text-ink-muted">
            Your account has no active unit occupancy.
          </p>
        )}
      </Card>

      <Card
        description="Save people who visit often, then create a one-time code for them in one step."
        title="Frequent visitors"
      >
        {units.length ? (
          <div className="grid gap-space-4">
            <VisitorActionForm
              action={saveFrequentVisitorAction}
              className="grid gap-space-3"
            >
              <label
                className="grid gap-space-1 text-body-strong"
                htmlFor="frequent-unit"
              >
                Unit
                <select
                  className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                  id="frequent-unit"
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
                htmlFor="frequent-name"
              >
                Visitor name
                <input
                  className="min-h-12 rounded-md border border-rule px-space-3"
                  id="frequent-name"
                  maxLength={120}
                  name="visitorName"
                  required
                />
              </label>
              <label
                className="grid gap-space-1 text-body-strong"
                htmlFor="frequent-vehicle"
              >
                Vehicle number (optional)
                <input
                  className="min-h-12 rounded-md border border-rule px-space-3"
                  id="frequent-vehicle"
                  maxLength={20}
                  name="vehicleNo"
                />
              </label>
              <button
                className="min-h-12 w-fit rounded-md border border-rule-strong px-space-4 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
                type="submit"
              >
                Save frequent visitor
              </button>
            </VisitorActionForm>
            {frequentByUnit.some(({ visitors }) => visitors.length) ? (
              <ul className="grid gap-space-3">
                {frequentByUnit.flatMap(({ unit, visitors }) =>
                  visitors.map((visitor) => (
                    <li
                      className="grid gap-space-3 rounded-md border border-rule p-space-4"
                      key={visitor.id}
                    >
                      <div>
                        <h2 className="text-body-strong">
                          {visitor.visitor_name}
                        </h2>
                        <p className="text-caption text-ink-muted">
                          {unitLabel(unit)}
                          {visitor.vehicle_no ? ` · ${visitor.vehicle_no}` : ''}
                        </p>
                      </div>
                      <VisitorActionForm
                        action={preApproveFrequentVisitorAction}
                        className="grid gap-space-2"
                      >
                        <input
                          name="frequentVisitorId"
                          type="hidden"
                          value={visitor.id}
                        />
                        <label
                          className="grid gap-space-1 text-caption"
                          htmlFor={`frequent-from-${visitor.id}`}
                        >
                          Valid from (society time)
                          <input
                            className="min-h-11 rounded-md border border-rule px-space-3"
                            id={`frequent-from-${visitor.id}`}
                            name="validFrom"
                            required
                            type="datetime-local"
                          />
                        </label>
                        <label
                          className="grid gap-space-1 text-caption"
                          htmlFor={`frequent-to-${visitor.id}`}
                        >
                          Valid until (society time)
                          <input
                            className="min-h-11 rounded-md border border-rule px-space-3"
                            id={`frequent-to-${visitor.id}`}
                            name="validTo"
                            required
                            type="datetime-local"
                          />
                        </label>
                        <button
                          aria-label={`Pre-approve ${visitor.visitor_name}`}
                          className="min-h-12 w-fit rounded-md bg-brand px-space-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-focus"
                          type="submit"
                        >
                          Pre-approve
                        </button>
                      </VisitorActionForm>
                      <VisitorActionForm action={removeFrequentVisitorAction}>
                        <input
                          name="frequentVisitorId"
                          type="hidden"
                          value={visitor.id}
                        />
                        <button
                          aria-label={`Remove ${visitor.visitor_name} from frequent visitors`}
                          className="min-h-11 rounded-md border border-rule-strong px-space-3 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
                          type="submit"
                        >
                          Remove
                        </button>
                      </VisitorActionForm>
                    </li>
                  )),
                )}
              </ul>
            ) : (
              <p className="text-body text-ink-muted">
                You have no saved frequent visitors.
              </p>
            )}
          </div>
        ) : (
          <p className="text-body text-ink-muted">
            Your account has no active unit occupancy.
          </p>
        )}
      </Card>

      <Card title="Pre-approvals">
        {preApprovals.length ? (
          <ul className="grid gap-space-3">
            {approvalCards.map(({ approval, qrCode }) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-4"
                key={approval.id}
              >
                <h2 className="text-body-strong">{approval.visitor_name}</h2>
                {qrCode &&
                approval.status === 'active' &&
                !approval.is_expired ? (
                  <CodeDisplay
                    label="Show this QR code or share the matching entry code."
                    qrCode={
                      <Image
                        alt="QR code for the visitor entry code"
                        height={160}
                        src={qrCode}
                        unoptimized
                        width={160}
                      />
                    }
                    singleUse
                    validity={`Valid until ${new Date(
                      approval.valid_to,
                    ).toLocaleString(undefined, { timeZone: timezone })}`}
                    value={approval.code}
                  />
                ) : (
                  <p className="font-mono text-title font-semibold tracking-widest">
                    {approval.code}
                  </p>
                )}
                <p className="text-caption text-ink-muted">
                  {approval.is_expired ? 'Expired' : approval.status}
                </p>
                {approval.status === 'active' ? (
                  <VisitorActionForm action={cancelVisitorPreApprovalAction}>
                    <input
                      name="approvalId"
                      type="hidden"
                      value={approval.id}
                    />
                    <button
                      className="min-h-11 rounded-md border border-rule-strong px-space-3 font-semibold"
                      type="submit"
                    >
                      Cancel
                    </button>
                  </VisitorActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            You have no visitor pre-approvals.
          </p>
        )}
      </Card>

      <Card title="Visitor history">
        {entries.length ? (
          <ol className="grid gap-space-3">
            {entries.map((entry) => (
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
          <p className="text-body text-ink-muted">No visitor history yet.</p>
        )}
      </Card>
    </section>
  );
}
