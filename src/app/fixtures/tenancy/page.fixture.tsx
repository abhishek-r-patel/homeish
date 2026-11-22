// Exercise moving screens with synthetic records and injected actions; never call hosted Auth or data.
'use client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { publicEnvironment } from '@/core/config/public-env';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  tenancyDecisionInputSchema,
  tenancyDocumentInputSchema,
  tenancyMoveInputSchema,
  tenancyProofKindSchema,
  tenancySettingsInputSchema,
  tenancyVersionInputSchema,
  type TenancyMoveDetail,
  type TenancyPage,
  type TenancyStatus,
  type TenancyWorkspace,
} from '@/core/tenancy/moves/validation';
import { tenancyProofsReady } from '@/core/tenancy/moves/presentation';
import type { TenancyActions } from '@/components/tenancy/controls';
import { TransferWorkspaceView } from '@/components/tenancy/transfer-workspace';
import {
  TenancyMoveView,
  TenancyRouteState,
  TenancyWorkspaceView,
  type TenancyRouteStateKind,
} from '@/components/tenancy/workspace';
import { Banner } from '@/components/ui/feedback';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { SelectInput } from '@/components/ui/select-input';
import type { PageSize } from '@/components/ui/table-controls';

const SOCIETY_ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const UNIT_ID = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const TENANT_ID = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const MOVE_ID = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const DOCUMENT_ID = 'e0d55fc3-0751-4b79-86c1-5b3e25942392';
const CREATED_AT = '2026-11-15T10:00:00Z';
const STORAGE_BASE = publicEnvironment.NEXT_PUBLIC_SUPABASE_URL.replace(
  /\/$/,
  '',
);
const STORAGE_UPLOAD_PATH = `${new URL(STORAGE_BASE).pathname.replace(/\/$/, '')}/storage/v1/object/upload/sign/tenancy-files/`;

const requestFiles: typeof fetch = async (resource, options) => {
  if (
    new URLSearchParams(window.location.search).get('fileTransport') ===
    'intercepted'
  ) {
    return fetch(resource, options);
  }
  const url = new URL(
    resource instanceof Request ? resource.url : String(resource),
    window.location.origin,
  );
  if (url.pathname === '/api/files/upload-url' && options?.method === 'POST') {
    const body: unknown = JSON.parse(z.string().parse(options.body));
    const value = z
      .object({
        moveId: z.uuid(),
        kind: tenancyProofKindSchema,
        contentType: z.string(),
      })
      .parse(body);
    const extension =
      value.contentType === 'application/pdf'
        ? 'pdf'
        : value.contentType === 'image/png'
          ? 'png'
          : 'jpg';
    const path = `${SOCIETY_ID}/moves/${value.moveId}/${value.kind}/${crypto.randomUUID()}.${extension}`;
    return Response.json({
      ok: true,
      data: {
        path,
        signedUrl: `${STORAGE_BASE}/storage/v1/object/upload/sign/tenancy-files/${path}?token=synthetic`,
      },
    });
  }
  if (
    url.origin === new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin &&
    url.pathname.startsWith(STORAGE_UPLOAD_PATH) &&
    options?.method === 'PUT'
  ) {
    return new Response(null, { status: 200 });
  }
  if (url.pathname === '/api/files/url' && options?.method === 'POST') {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message:
            'This synthetic fixture does not issue real file links. Automated browser tests simulate private-link responses.',
        },
      },
      { status: 403 },
    );
  }
  throw new Error(
    'Unexpected synthetic file operation. No network request was sent.',
  );
};
const ROLE_NAMES = {
  admin: 'Synthetic Admin',
  owner: 'Synthetic Owner',
  tenant: 'Synthetic Tenant',
  committee: 'Synthetic Committee',
  guard: 'Synthetic Guard',
};
const roleSchema = z.enum(['admin', 'owner', 'tenant', 'committee', 'guard']);
type FixtureRole = z.infer<typeof roleSchema>;
const ROUTE_STATES = [
  'loading',
  'error',
  'disabled',
  'denied',
  'not_found',
  'invalid_filters',
] as const satisfies readonly TenancyRouteStateKind[];
const scenarioSchema = z.enum([
  'workflow',
  'scheduled',
  'pagination',
  'move_out',
  'empty',
  'transfers',
  ...ROUTE_STATES,
]);
const duesSchema = z.enum(['not_checked', 'cleared', 'pending']);
type DuesMode = z.infer<typeof duesSchema>;

function input(data: FormData): unknown {
  const raw = data.get('input');
  if (typeof raw !== 'string')
    throw new Error('Missing synthetic moving input.');
  return JSON.parse(raw);
}
function failure(message: string): ServerActionResult<unknown> {
  return { ok: false, code: 'CONFLICT', message };
}
function dues(mode: DuesMode): TenancyMoveDetail['dues'] {
  return mode === 'not_checked'
    ? { status: mode, balance_paise: null, checked_at: null }
    : {
        status: mode,
        balance_paise: mode === 'pending' ? '12345' : '0',
        checked_at: CREATED_AT,
      };
}
function sampleMove(
  kind: 'move_in' | 'move_out' = 'move_in',
): TenancyMoveDetail {
  return {
    move: {
      id: MOVE_ID,
      unit_id: UNIT_ID,
      unit_number: 'A-101',
      kind,
      status: kind === 'move_in' ? 'awaiting_consent' : 'pending_review',
      starts_at: '2026-11-16T03:30:00Z',
      ends_at: '2026-11-16T04:30:00Z',
      version: 1,
      can_view_details: true,
    },
    tenant_membership_id: TENANT_ID,
    tenant_name: ROLE_NAMES.tenant,
    agreement_expires_on: kind === 'move_in' ? '2027-11-15' : null,
    amenity_booking_id: null,
    completed_at: null,
    owner_consent_valid: kind === 'move_out',
    police_verification_required: false,
    can_manage: false,
    can_consent: false,
    can_cancel: false,
    documents: [],
    dues: kind === 'move_out' ? dues('not_checked') : null,
    events: [
      {
        id: DOCUMENT_ID,
        action: 'created',
        status: kind === 'move_in' ? 'awaiting_consent' : 'pending_review',
        reason: null,
        actor_name: ROLE_NAMES.admin,
        created_at: CREATED_AT,
      },
    ],
  };
}

export default function TenancyFixturePage() {
  const [role, setRole] = useState<FixtureRole>('admin');
  const [scenario, setScenario] =
    useState<z.infer<typeof scenarioSchema>>('workflow');
  const [moves, setMoves] = useState<readonly TenancyMoveDetail[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [required, setRequired] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [duesMode, setDuesMode] = useState<DuesMode>('not_checked');
  const [financialFailure, setFinancialFailure] = useState(false);
  const [attachmentFailure, setAttachmentFailure] = useState(false);
  const [lostResponse, setLostResponse] = useState(false);
  const [occupancyActive, setOccupancyActive] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [uniqueKeys, setUniqueKeys] = useState(0);
  const [status, setStatus] = useState<TenancyStatus | null>(null);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState<PageSize>(10);
  const creations = useRef(new Map<string, string>());
  const [creators, setCreators] = useState<ReadonlyMap<string, FixtureRole>>(
    () => new Map(),
  );
  const responseLost = useRef(false);
  const privateRole = role === 'admin' || role === 'owner' || role === 'tenant';
  const canManage = role === 'admin';
  const audience =
    role === 'guard'
      ? 'guard'
      : role === 'committee' || role === 'admin'
        ? 'management'
        : 'resident';

  useEffect(() => {
    const change = () => {
      if (!privateRole) {
        setSelected(null);
        return;
      }
      const match = /^#move-(.+)$/.exec(window.location.hash);
      setSelected(match ? z.uuid().parse(match[1]) : null);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, [privateRole]);

  const workspace: TenancyWorkspace = {
    today: '2026-11-15',
    timezone: 'Asia/Kolkata',
    unit_label: 'Flat',
    can_manage: canManage,
    can_create: privateRole,
    can_write: !readOnly,
    police_verification_required: required,
    amenity_enabled: false,
    units: privateRole ? [{ id: UNIT_ID, number: 'A-101' }] : [],
    tenants: privateRole
      ? [{ id: TENANT_ID, name: ROLE_NAMES.tenant, status: 'active' }]
      : [],
    occupancies: privateRole
      ? [
          {
            unit_id: UNIT_ID,
            membership_id: TENANT_ID,
            is_tenant: true,
            status: occupancyActive ? 'active' : 'pending',
          },
        ]
      : [],
    bookings: [],
  };
  const found = moves.find((move) => move.move.id === selected);
  const detail: TenancyMoveDetail | null =
    found && privateRole
      ? {
          ...found,
          can_manage: canManage,
          can_consent:
            role === 'owner' && found.move.status === 'awaiting_consent',
          can_cancel: canManage || creators.get(found.move.id) === role,
          police_verification_required: required,
          dues: found.move.kind === 'move_out' ? dues(duesMode) : null,
        }
      : null;
  const visible =
    scenario === 'empty'
      ? []
      : moves.filter(
          (record) =>
            (!status || record.move.status === status) &&
            (role !== 'guard' ||
              ['approved', 'completed', 'cancelled'].includes(
                record.move.status,
              )),
        );
  const page: TenancyPage = {
    items: visible
      .slice(offset, offset + limit)
      .map((record) => ({ ...record.move, can_view_details: privateRole })),
    total: visible.length,
    limit,
    offset,
  };

  function current(data: FormData) {
    const version = tenancyVersionInputSchema.parse(input(data));
    const record = moves.find((move) => move.move.id === version.moveId);
    if (!record || record.move.version !== version.expectedVersion)
      throw new Error('The synthetic request changed. Reload the fixture.');
    return record;
  }
  function save(
    next: TenancyMoveDetail,
    action: TenancyMoveDetail['events'][number]['action'],
    reason: string | null = null,
  ) {
    setMoves((rows) =>
      rows.map((row) =>
        row.move.id !== next.move.id
          ? row
          : {
              ...next,
              move: { ...next.move, version: row.move.version + 1 },
              events: [
                ...row.events,
                {
                  id: crypto.randomUUID(),
                  action,
                  status: next.move.status,
                  reason,
                  actor_name: ROLE_NAMES[role],
                  created_at: next.completed_at ?? CREATED_AT,
                },
              ],
            },
      ),
    );
  }
  const actions: TenancyActions = {
    create: async (data) => {
      const parsed = tenancyMoveInputSchema.parse(input(data));
      setAttempts((value) => value + 1);
      const existing = creations.current.get(parsed.clientRequestId);
      let id = existing;
      if (!id) {
        const createdId = crypto.randomUUID();
        id = createdId;
        creations.current.set(parsed.clientRequestId, id);
        setCreators((values) => new Map(values).set(createdId, role));
        const record = sampleMove(parsed.kind);
        record.move = {
          ...record.move,
          id,
          starts_at: parsed.startsAt,
          ends_at: parsed.endsAt,
        };
        record.agreement_expires_on = parsed.agreementExpiresOn;
        record.events = record.events.map((event) => ({
          ...event,
          actor_name: ROLE_NAMES[role],
        }));
        setMoves((rows) => [...rows, record]);
      }
      setUniqueKeys(creations.current.size);
      if (lostResponse && !responseLost.current) {
        responseLost.current = true;
        throw new Error('Synthetic lost response after saving.');
      }
      return { ok: true, data: id, message: 'Move request created.' };
    },
    attach: async (data) => {
      const parsed = tenancyDocumentInputSchema.parse(input(data));
      if (attachmentFailure) {
        setAttachmentFailure(false);
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          referenceId: 'ERR-A1B2C3D4E5',
          message:
            'The proof was uploaded but not attached. No proof metadata was saved; retry attachment.',
        };
      }
      const record = moves.find((move) => move.move.id === parsed.moveId);
      if (!record || record.move.version !== parsed.expectedVersion)
        return failure('The request changed. Refresh and retry.');
      save(
        {
          ...record,
          documents: [
            ...record.documents,
            {
              id: crypto.randomUUID(),
              kind: parsed.kind,
              path: parsed.path,
              content_type: 'application/pdf',
              size_bytes: 32,
              created_at: CREATED_AT,
            },
          ],
        },
        'document_attached',
      );
      return { ok: true, message: 'Private proof attached.' };
    },
    consent: async (data) => {
      const record = current(data);
      if (
        role !== 'owner' ||
        !tenancyProofsReady({
          ...record,
          police_verification_required: required,
        })
      )
        return failure(
          'An active owner must consent after all required proofs are attached.',
        );
      save(
        {
          ...record,
          owner_consent_valid: true,
          move: { ...record.move, status: 'pending_review' },
        },
        'consented',
      );
      return {
        ok: true,
        message: 'Owner consent recorded. Access is unchanged.',
      };
    },
    decide: async (data) => {
      const parsed = tenancyDecisionInputSchema.parse(input(data));
      const record = moves.find((move) => move.move.id === parsed.moveId);
      if (!record || record.move.version !== parsed.expectedVersion)
        return failure('The request changed. Refresh and retry.');
      if (
        parsed.decision === 'approved' &&
        (!canManage ||
          !record.owner_consent_valid ||
          !tenancyProofsReady({
            ...record,
            police_verification_required: required,
          }))
      )
        return failure(
          'Approval requires administrator access, required proof and owner consent.',
        );
      save(
        { ...record, move: { ...record.move, status: parsed.decision } },
        parsed.decision,
        parsed.reason,
      );
      return {
        ok: true,
        message: 'Schedule decision saved. Access is unchanged.',
      };
    },
    complete: async (data) => {
      const record = current(data);
      if (financialFailure && record.move.kind === 'move_out') {
        setFinancialFailure(false);
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          referenceId: 'ERR-F1A2B3C4D5',
          message:
            'Dues could not be checked. The move was not completed; retry.',
        };
      }
      if (
        !canManage ||
        record.move.status !== 'approved' ||
        (record.move.kind === 'move_out' && duesMode === 'pending')
      )
        return failure(
          'This move cannot be completed. Check approval and current dues.',
        );
      save(
        {
          ...record,
          completed_at: new Date(
            (Date.parse(record.move.starts_at) +
              Date.parse(record.move.ends_at)) /
              2,
          ).toISOString(),
          move: { ...record.move, status: 'completed' },
        },
        'completed',
      );
      setOccupancyActive(record.move.kind === 'move_in');
      return {
        ok: true,
        message: 'Actual move completed. Core occupancy changed.',
      };
    },
    issue: async (data) => {
      const record = current(data);
      if (financialFailure) {
        setFinancialFailure(false);
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          referenceId: 'ERR-F1A2B3C4D5',
          message: 'Dues could not be checked. No NOC was issued; retry.',
        };
      }
      if (
        !canManage ||
        record.move.status !== 'completed' ||
        duesMode === 'pending'
      )
        return failure('Current positive dues block NOC issue.');
      save(
        {
          ...record,
          documents: [
            ...record.documents,
            {
              id: DOCUMENT_ID,
              kind: 'noc',
              path: `${SOCIETY_ID}/moves/${record.move.id}/noc/${DOCUMENT_ID}.pdf`,
              content_type: 'application/pdf',
              size_bytes: 256,
              created_at: record.completed_at ?? CREATED_AT,
            },
          ],
        },
        'noc_issued',
      );
      return { ok: true, message: 'Approved move-out NOC issued.' };
    },
    settings: async (data) => {
      const parsed = tenancySettingsInputSchema.parse(input(data));
      setRequired(parsed.policeVerificationRequired);
      return { ok: true, message: 'Proof requirement saved.' };
    },
  };

  function changeScenario(value: z.infer<typeof scenarioSchema>) {
    setScenario(value);
    setSelected(null);
    setStatus(null);
    setOffset(0);
    setDuesMode('not_checked');
    setOccupancyActive(value === 'move_out');
    if (value === 'move_out') {
      setMoves([sampleMove('move_out')]);
      setSelected(MOVE_ID);
    } else if (value === 'scheduled' || value === 'pagination') {
      setMoves(
        Array.from({ length: value === 'pagination' ? 27 : 1 }, (_, index) => {
          const record = sampleMove();
          const moveId = index === 0 ? MOVE_ID : crypto.randomUUID();
          const documentId = index === 0 ? DOCUMENT_ID : crypto.randomUUID();
          record.move = {
            ...record.move,
            id: moveId,
            unit_id: index === 0 ? UNIT_ID : crypto.randomUUID(),
            unit_number: `A-${101 + index}`,
            status: index % 2 ? 'awaiting_consent' : 'approved',
          };
          record.owner_consent_valid = record.move.status === 'approved';
          record.documents = [
            {
              id: documentId,
              kind: 'rental_agreement',
              path: `${SOCIETY_ID}/moves/${moveId}/rental_agreement/${documentId}.pdf`,
              content_type: 'application/pdf',
              size_bytes: 32,
              created_at: CREATED_AT,
            },
          ];
          return record;
        }),
      );
    } else setMoves([]);
  }
  const routeState = ROUTE_STATES.find((state) => state === scenario);
  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic tenancy fixture" tone="info">
          Development-only records and injected actions. No hosted Auth or
          database writes. Files stay in this browser; automated tests
          explicitly use intercepted file HTTP. Completion simulates entering
          the approved moving window. Reload to reset.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-2">
          <SelectInput
            id="fixture-role"
            label="Fixture role"
            value={role}
            options={roleSchema.options.map((value) => ({
              value,
              label: ROLE_NAMES[value],
            }))}
            onChange={(event) => {
              const next = roleSchema.parse(event.currentTarget.value);
              setRole(next);
              if (next === 'guard' || next === 'committee') {
                setSelected(null);
                window.location.hash = 'schedule';
              }
            }}
          />
          <SelectInput
            id="fixture-scenario"
            label="Fixture scenario"
            value={scenario}
            options={scenarioSchema.options.map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            }))}
            onChange={(event) =>
              changeScenario(scenarioSchema.parse(event.currentTarget.value))
            }
          />
          <SelectInput
            id="fixture-dues"
            label="Fixture dues"
            value={duesMode}
            options={[
              { value: 'not_checked', label: 'Billing disabled' },
              { value: 'cleared', label: 'Cleared' },
              { value: 'pending', label: 'Positive balance' },
            ]}
            onChange={(event) =>
              setDuesMode(duesSchema.parse(event.currentTarget.value))
            }
          />
          <div className="grid gap-space-2">
            <CheckboxInput
              id="fixture-read-only"
              label="Read-only society"
              checked={readOnly}
              onChange={(event) => setReadOnly(event.currentTarget.checked)}
            />
            <CheckboxInput
              id="fixture-lost-response"
              label="Lose first creation response"
              checked={lostResponse}
              onChange={(event) => setLostResponse(event.currentTarget.checked)}
            />
            <CheckboxInput
              id="fixture-attachment-failure"
              label="Fail next proof attachment"
              checked={attachmentFailure}
              onChange={(event) =>
                setAttachmentFailure(event.currentTarget.checked)
              }
            />
            <CheckboxInput
              id="fixture-dues-failure"
              label="Fail next financial check"
              checked={financialFailure}
              onChange={(event) =>
                setFinancialFailure(event.currentTarget.checked)
              }
            />
          </div>
        </div>
        <p className="text-caption text-ink-muted" role="status">
          Synthetic Core tenant occupancy:{' '}
          {occupancyActive ? 'active' : 'not active'}. Creation attempts:{' '}
          {attempts}. Unique creation keys: {uniqueKeys}.
        </p>
      </header>
      <main
        className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink"
        data-storage-origin={
          new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
        }
      >
        {scenario === 'transfers' ? (
          <TransferWorkspaceView
            detail={null}
            dues={null}
            certificates={[]}
            acknowledgement={
              role === 'admin'
                ? { acknowledged: false, acknowledged_at: null }
                : null
            }
            mode={
              role === 'committee'
                ? 'committee'
                : role === 'admin'
                  ? 'admin'
                  : 'own'
            }
            page={{
              items: [
                {
                  id: 'f0d55fc3-0751-4b79-86c1-5b3e25942392',
                  unit_id: UNIT_ID,
                  unit_number: 'A-101',
                  stage: 'received',
                  received_on: '2026-11-15',
                  version: 1,
                  buyers: [
                    {
                      id: '10d55fc3-0751-4b79-86c1-5b3e25942392',
                      name: 'Synthetic Buyer',
                    },
                  ],
                },
              ],
              total: 1,
              limit: 25,
              offset: 0,
            }}
            workspace={workspace}
          />
        ) : (
          <>
            {routeState ? (
              <TenancyRouteState
                kind={routeState}
                returnHref="/fixtures/tenancy"
                referenceId={
                  routeState === 'error' ? 'ERR-F1A2B3C4D5' : undefined
                }
                onRetry={
                  routeState === 'error'
                    ? () => changeScenario('workflow')
                    : undefined
                }
              />
            ) : detail ? (
              <TenancyMoveView
                detail={detail}
                progress={{
                  move_id: detail.move.id,
                  version: detail.move.version,
                  steps: [
                    {
                      key: 'request_recorded',
                      state: 'complete',
                      at: CREATED_AT,
                    },
                    {
                      key: 'owner_consent',
                      state:
                        detail.move.kind === 'move_out'
                          ? 'not_required'
                          : detail.owner_consent_valid
                            ? 'complete'
                            : 'pending',
                      at: detail.owner_consent_valid ? CREATED_AT : null,
                    },
                    {
                      key: 'required_proofs',
                      state:
                        detail.move.kind === 'move_out'
                          ? 'not_required'
                          : 'pending',
                      at: null,
                    },
                    {
                      key: 'verification',
                      state: 'not_required',
                      at: null,
                    },
                    {
                      key: 'admin_scheduled',
                      state:
                        detail.move.status === 'approved' ||
                        detail.move.status === 'completed'
                          ? 'complete'
                          : 'pending',
                      at:
                        detail.move.status === 'approved' ||
                        detail.move.status === 'completed'
                          ? CREATED_AT
                          : null,
                    },
                    {
                      key: 'actual_completion',
                      state:
                        detail.move.status === 'completed'
                          ? 'complete'
                          : 'pending',
                      at: detail.completed_at,
                    },
                    {
                      key: 'core_occupancy',
                      state:
                        detail.move.status === 'completed'
                          ? 'complete'
                          : 'pending',
                      at: detail.completed_at,
                    },
                  ],
                  verification_tracking_enabled: false,
                  verification: {
                    status: null,
                    checked_on: null,
                    reference: null,
                  },
                  agreement: {
                    type: detail.move.kind === 'move_in' ? 'rental' : null,
                    starts_on:
                      detail.move.kind === 'move_in' ? '2026-11-15' : null,
                    expires_on: detail.agreement_expires_on,
                  },
                }}
                workspace={workspace}
                audience={audience === 'guard' ? 'resident' : audience}
                baseHref="/fixtures/tenancy"
                backHref="#schedule"
                actions={actions}
                fileRequest={requestFiles}
              />
            ) : (
              <TenancyWorkspaceView
                workspace={workspace}
                page={page}
                status={status}
                audience={audience}
                baseHref="/fixtures/tenancy"
                actions={actions}
                getMoveHref={(id) => `#move-${id}`}
                onCreated={setSelected}
                onStatusChange={(next) => {
                  setStatus(next);
                  setOffset(0);
                }}
                onPageChange={(nextOffset, nextLimit) => {
                  setOffset(nextOffset);
                  setLimit(nextLimit);
                }}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
