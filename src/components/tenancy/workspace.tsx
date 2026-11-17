// Present role-scoped schedules, private move history and truthful access-changing decisions.
'use client';
import { useId, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import {
  TENANCY_DOCUMENT_LABELS,
  TENANCY_EVENT_LABELS,
  TENANCY_KIND_LABELS,
  isTenancyOpen,
  tenancyProofsReady,
} from '@/core/tenancy/moves/presentation';
import {
  TENANCY_STATUSES,
  tenancyListSearchSchema,
  tenancyStatusSchema,
  type TenancyMoveDetail,
  type TenancyPage,
  type TenancyStatus,
  type TenancyWorkspace,
} from '@/core/tenancy/moves/validation';
import { Button } from '@/components/ui/button';
import { Card, StatusChip, statusMap } from '@/components/ui/data-display';
import {
  Banner,
  EmptyState,
  ErrorPanel,
  Skeleton,
} from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';
import {
  DataTable,
  FilterBar,
  Pagination,
  type PageSize,
} from '@/components/ui/table-controls';
import {
  DEFAULT_TENANCY_ACTIONS,
  TenancyCreateForm,
  TenancyDecisionControl,
  TenancySettingsControl,
  type TenancyActions,
} from './controls';
import { TenancyDocumentLink, TenancyProofUpload } from './documents';
import { useTenancyPresentation } from './presentation';

export type TenancyAudience = 'resident' | 'management' | 'guard';
export type TenancyRouteStateKind =
  'loading' | 'disabled' | 'denied' | 'not_found' | 'invalid_filters' | 'error';

export function TenancyRouteState({
  kind,
  returnHref = '/',
  retryHref,
  referenceId,
  message,
  onRetry,
}: {
  kind: TenancyRouteStateKind;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { t, translateFeedback } = useTenancyPresentation();
  if (kind === 'disabled')
    return (
      <ModuleDisabledPage
        embedded
        moduleKey="tenancy"
        returnHref={returnHref}
      />
    );
  const copy = {
    loading: {
      title: 'Loading moving requests',
      message: 'Loading the current schedule.',
    },
    denied: {
      title: 'Moving access is restricted',
      message:
        'You do not have access to this view. Return to your workspace or ask an administrator to review your access.',
    },
    not_found: {
      title: 'Move request unavailable',
      message:
        'This request is unavailable or you no longer have permission to view it. Return to the moving schedule.',
    },
    invalid_filters: {
      title: 'Check the moving filters',
      message:
        'Choose a listed status, a valid page and 10, 25, 50 or 100 rows per page. Clear the filters to continue.',
    },
    error: {
      title: 'Could not load moving requests',
      message:
        'No move data or dues clearance is confirmed. Retry; do not assume the move was completed.',
    },
  }[kind];
  return (
    <section className="grid min-w-0 gap-space-4">
      <h1 className="text-title font-semibold">{t('Move-in / Move-out')}</h1>
      {kind === 'loading' ? (
        <Skeleton label={t(copy.title)} rows={5} />
      ) : (
        <ErrorPanel
          title={t(copy.title)}
          message={message ? translateFeedback(message) : t(copy.message)}
          referenceId={referenceId}
          action={
            <div className="flex flex-wrap gap-space-3">
              {onRetry ? (
                <Button onClick={onRetry}>{t('Retry')}</Button>
              ) : retryHref ? (
                <a
                  href={retryHref}
                  className="inline-flex min-h-12 items-center text-brand underline"
                >
                  {t('Retry')}
                </a>
              ) : null}
              <a
                href={returnHref}
                className="inline-flex min-h-12 items-center text-brand underline"
              >
                {t(
                  kind === 'invalid_filters'
                    ? 'Clear filters'
                    : 'Back to workspace',
                )}
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

export function TenancyWorkspaceView({
  workspace,
  page,
  status,
  audience,
  baseHref,
  actions = DEFAULT_TENANCY_ACTIONS,
  onCreated,
  onStatusChange,
  onPageChange,
  getMoveHref,
}: {
  workspace: TenancyWorkspace;
  page: TenancyPage;
  status: TenancyStatus | null;
  audience: TenancyAudience;
  baseHref: string;
  actions?: TenancyActions;
  onCreated?: (id: string) => void;
  onStatusChange?: (status: TenancyStatus | null) => void;
  onPageChange?: (offset: number, size: PageSize) => void;
  getMoveHref?: (id: string) => string;
}) {
  const { t, time } = useTenancyPresentation();
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const size = tenancyListSearchSchema.shape.limit.parse(page.limit);
  const canCreate =
    audience === 'management'
      ? workspace.can_manage
      : audience === 'resident' && workspace.can_create;
  const privateDetails =
    audience === 'resident' ||
    (audience === 'management' && workspace.can_manage);
  function navigate(
    nextStatus: TenancyStatus | null,
    offset: number,
    limit: PageSize,
  ) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (nextStatus) query.set('status', nextStatus);
    if (offset > 0) query.set('offset', String(offset));
    startTransition(() => router.push(`${baseHref}?${query}`));
  }
  function filter(nextStatus: TenancyStatus | null) {
    if (onStatusChange) onStatusChange(nextStatus);
    else navigate(nextStatus, 0, size);
  }
  function paginate(offset: number, limit: PageSize) {
    if (onPageChange) onPageChange(offset, limit);
    else navigate(status, offset, limit);
  }
  return (
    <section
      className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]"
      id="schedule"
    >
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">
          {t(audience === 'guard' ? 'Moving schedule' : 'Move-in / Move-out')}
        </h1>
        <p className="text-body text-ink-muted">
          {t(
            'Approval schedules a move. Only an administrator confirming the actual move changes household access.',
          )}
        </p>
      </header>
      {audience === 'guard' ||
      (audience === 'management' && !workspace.can_manage) ? (
        <Banner tone="neutral">
          {t(
            'Read-only schedule. {unitLabel}, date, time and status only; tenant identities and private documents are not included.',
            { unitLabel: workspace.unit_label },
          )}
        </Banner>
      ) : null}
      {!workspace.can_write ? (
        <Banner tone="warning">
          {t(
            'This society is read-only. You can view permitted history, but no moving details or access can be changed.',
          )}
        </Banner>
      ) : null}
      {canCreate && workspace.can_write ? (
        <TenancyCreateForm
          workspace={workspace}
          baseHref={baseHref}
          action={actions.create}
          onCreated={onCreated}
        />
      ) : null}
      <Card
        title={t('Moving schedule')}
        description={t(
          'Times are shown in {timezone}. Latest moving dates are listed first.',
          { timezone: workspace.timezone },
        )}
      >
        <div className="grid min-w-0 gap-space-4" aria-busy={pending}>
          <FilterBar
            appliedFilters={
              status
                ? [
                    {
                      id: 'status',
                      label: t(statusMap[`tenancy.${status}`].label),
                    },
                  ]
                : []
            }
            onClearAll={() => filter(null)}
            onRemoveFilter={() => filter(null)}
          >
            <SelectInput
              id={`${id}-status`}
              label={t('Move status')}
              value={status ?? ''}
              options={[
                { value: '', label: t('All statuses') },
                ...TENANCY_STATUSES.map((value) => ({
                  value,
                  label: t(statusMap[`tenancy.${value}`].label),
                })),
              ]}
              onChange={(event) =>
                filter(
                  event.currentTarget.value
                    ? tenancyStatusSchema.parse(event.currentTarget.value)
                    : null,
                )
              }
            />
          </FilterBar>
          {pending ? (
            <p role="status" className="text-caption text-ink-muted">
              {t('Updating the moving schedule...')}
            </p>
          ) : null}
          {page.items.length ? (
            <DataTable
              caption={t('Moving schedule')}
              rows={page.items}
              getRowId={(row) => row.id}
              getRowLabel={(row) =>
                `${workspace.unit_label} ${row.unit_number} ${t(TENANCY_KIND_LABELS[row.kind])}`
              }
              getRowHref={(row) =>
                privateDetails && row.can_view_details
                  ? (getMoveHref?.(row.id) ?? `${baseHref}/${row.id}`)
                  : undefined
              }
              mobilePrimary={(row) =>
                `${workspace.unit_label} ${row.unit_number}: ${t(TENANCY_KIND_LABELS[row.kind])}`
              }
              mobileSecondary={(row) =>
                t('{start} to {end}', {
                  start: time(row.starts_at, workspace.timezone),
                  end: time(row.ends_at, workspace.timezone),
                })
              }
              mobileStatus={(row) => `tenancy.${row.status}`}
              columns={[
                {
                  id: 'unit',
                  header: workspace.unit_label,
                  render: (row) => row.unit_number,
                },
                {
                  id: 'kind',
                  header: t('Move'),
                  render: (row) => t(TENANCY_KIND_LABELS[row.kind]),
                },
                {
                  id: 'start',
                  header: t('From'),
                  render: (row) => time(row.starts_at, workspace.timezone),
                },
                {
                  id: 'end',
                  header: t('To'),
                  render: (row) => time(row.ends_at, workspace.timezone),
                },
                {
                  id: 'status',
                  header: t('Status'),
                  render: (row) => (
                    <StatusChip status={`tenancy.${row.status}`} />
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState
              title={t(
                page.offset > 0
                  ? 'This page is empty'
                  : status
                    ? 'No matching move requests'
                    : 'No move requests yet',
              )}
              description={t(
                page.offset > 0
                  ? 'The schedule may have changed. Return to the first page.'
                  : status
                    ? 'No requests match this status. Clear the filter to see other requests.'
                    : canCreate
                      ? 'Create a request above when a tenant is ready to move.'
                      : 'An administrator will add approved moving requests here.',
              )}
              action={
                page.offset > 0 ? (
                  <Button variant="secondary" onClick={() => paginate(0, size)}>
                    {t('First Page')}
                  </Button>
                ) : status ? (
                  <Button variant="secondary" onClick={() => filter(null)}>
                    {t('Clear Filters')}
                  </Button>
                ) : undefined
              }
            />
          )}
          {page.items.length || page.offset === 0 ? (
            <Pagination
              total={page.total}
              page={Math.floor(page.offset / size) + 1}
              pageSize={size}
              onPageChange={(next) => paginate((next - 1) * size, size)}
              onPageSizeChange={(next) => paginate(0, next)}
            />
          ) : null}
        </div>
      </Card>
      {audience === 'management' &&
      workspace.can_manage &&
      workspace.can_write ? (
        <TenancySettingsControl
          key={String(workspace.police_verification_required)}
          workspace={workspace}
          action={actions.settings}
        />
      ) : null}
    </section>
  );
}

function TenancyDues({
  detail,
  timezone,
}: {
  detail: TenancyMoveDetail;
  timezone: string;
}) {
  const { t, time, balance } = useTenancyPresentation();
  const dues = detail.dues;
  if (!dues) return null;
  if (dues.status === 'not_checked')
    return (
      <Banner tone="warning" title={t('Dues: Not checked')}>
        {t(
          'Billing is disabled. This is not a zero balance or a clearance certificate. The NOC will explicitly record that dues were not checked.',
        )}
      </Banner>
    );
  return (
    <Banner
      tone={dues.status === 'pending' ? 'danger' : 'success'}
      title={t(
        dues.status === 'pending'
          ? 'Dues outstanding'
          : 'Dues cleared at last check',
      )}
    >
      <p>
        {t('Authoritative household balance: {amount}.', {
          amount: balance(dues.balance_paise),
        })}
      </p>
      <p>
        {t('Checked: {date}. Completion and NOC issue recheck the balance.', {
          date: time(dues.checked_at, timezone),
        })}
      </p>
      {dues.status === 'pending' ? (
        <p>
          {t(
            'Positive dues block completion and NOC issue. There is no override.',
          )}
        </p>
      ) : null}
    </Banner>
  );
}

export function TenancyMoveView({
  detail,
  workspace,
  audience,
  baseHref,
  actions = DEFAULT_TENANCY_ACTIONS,
  backHref,
  fileRequest,
}: {
  detail: TenancyMoveDetail;
  workspace: TenancyWorkspace;
  audience: Exclude<TenancyAudience, 'guard'>;
  baseHref: string;
  actions?: TenancyActions;
  backHref?: string;
  fileRequest?: typeof fetch;
}) {
  const { t, date, time } = useTenancyPresentation();
  const move = detail.move;
  const open = isTenancyOpen(move.status);
  const proofsReady = tenancyProofsReady(detail);
  const canManage = audience === 'management' && detail.can_manage;
  const canWrite = workspace.can_write;
  const consentReady = move.kind === 'move_out' || detail.owner_consent_valid;
  const noc = detail.documents.find((document) => document.kind === 'noc');
  const positiveDues = detail.dues?.status === 'pending';
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <a
        className="inline-flex min-h-12 w-fit items-center text-brand underline"
        href={backHref ?? baseHref}
      >
        {t('Back to moving schedule')}
      </a>
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">
          {t(TENANCY_KIND_LABELS[move.kind])}: {workspace.unit_label}{' '}
          {move.unit_number}
        </h1>
        <div>
          <StatusChip status={`tenancy.${move.status}`} />
        </div>
      </header>
      {!canWrite ? (
        <Banner tone="warning">
          {t(
            'This society is read-only. Private history remains available to permitted members; no changes can be saved.',
          )}
        </Banner>
      ) : null}
      <Card title={t('Request details')}>
        <dl className="grid min-w-0 gap-space-3 text-body">
          <div>
            <dt className="text-caption text-ink-muted">{t('Tenant')}</dt>
            <dd>{detail.tenant_name}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">
              {t('Moving window')}
            </dt>
            <dd>
              {t('{start} to {end}', {
                start: time(move.starts_at, workspace.timezone),
                end: time(move.ends_at, workspace.timezone),
              })}
            </dd>
          </div>
          {detail.agreement_expires_on ? (
            <div>
              <dt className="text-caption text-ink-muted">
                {t('Rental agreement expiry')}
              </dt>
              <dd>{date(detail.agreement_expires_on)}</dd>
            </div>
          ) : null}
          {detail.amenity_booking_id ? (
            <div>
              <dt className="text-caption text-ink-muted">{t('Amenity')}</dt>
              <dd>
                {t(
                  'An existing confirmed booking is linked. This request does not reserve an amenity.',
                )}
              </dd>
            </div>
          ) : null}
          {detail.completed_at ? (
            <div>
              <dt className="text-caption text-ink-muted">
                {t('Actual completion')}
              </dt>
              <dd>{time(detail.completed_at, workspace.timezone)}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-space-4 text-caption text-ink-muted">
          {t(
            'No move fee or deposit. Core household and financial history is preserved.',
          )}
        </p>
      </Card>
      {move.status === 'approved' ? (
        <Banner tone="info" title={t('Scheduled, not completed')}>
          {t(
            'Approval has not changed tenant access. An administrator must confirm the actual move during the approved window.',
          )}
        </Banner>
      ) : move.status === 'completed' ? (
        <Banner tone="success" title={t('Actual move completed')}>
          {t(
            move.kind === 'move_in'
              ? 'Core tenant occupancy was activated when this move was completed.'
              : 'Core tenant occupancy was ended when this move was completed.',
          )}
        </Banner>
      ) : null}
      {move.kind === 'move_in' ? (
        <Card title={t('Owner consent')}>
          <p className="text-body">
            {t(
              detail.owner_consent_valid
                ? 'Consent from an active owner is recorded.'
                : move.status === 'completed'
                  ? 'The move was completed with the required owner consent. Current ownership may have changed.'
                  : 'One active owner must consent after all required proofs are attached. An administrator cannot bypass this.',
            )}
          </p>
          {open && canWrite && detail.can_consent && proofsReady ? (
            <div className="mt-space-3">
              <TenancyDecisionControl
                detail={detail}
                decision="consent"
                action={actions.consent}
              />
            </div>
          ) : null}
          {open && !proofsReady ? (
            <p className="mt-space-2 text-caption text-ink-muted">
              {t('Attach all required proofs before requesting consent.')}
            </p>
          ) : null}
        </Card>
      ) : null}
      <TenancyDues detail={detail} timezone={workspace.timezone} />
      <Card
        title={t('Private documents')}
        description={t(
          'Only the tenant, active household owners and administrators can access these files. Never upload Aadhaar or other government ID copies.',
        )}
      >
        <div className="grid min-w-0 gap-space-4">
          <p className="text-caption text-ink-muted">
            {t(
              'Files and NOCs are retained for one year after move-out, or 30 days after rejection or cancellation. Expired files are not available.',
            )}
          </p>
          {detail.documents.length ? (
            detail.documents.map((document) => (
              <div
                key={document.id}
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {t(TENANCY_DOCUMENT_LABELS[document.kind])}
                </p>
                <p className="text-caption text-ink-muted">
                  {t('Attached {date}', {
                    date: time(document.created_at, workspace.timezone),
                  })}
                </p>
                <TenancyDocumentLink
                  request={fileRequest}
                  path={document.path}
                  label={t(TENANCY_DOCUMENT_LABELS[document.kind])}
                />
              </div>
            ))
          ) : (
            <p className="text-body text-ink-muted">
              {t('No retained documents are attached.')}
            </p>
          )}
          {move.kind === 'move_in' && open && canWrite ? (
            <>
              {!detail.documents.some(
                (document) => document.kind === 'rental_agreement',
              ) ? (
                <TenancyProofUpload
                  detail={detail}
                  kind="rental_agreement"
                  action={actions.attach}
                  request={fileRequest}
                />
              ) : null}
              {detail.police_verification_required &&
              !detail.documents.some(
                (document) => document.kind === 'police_verification',
              ) ? (
                <TenancyProofUpload
                  detail={detail}
                  kind="police_verification"
                  action={actions.attach}
                  request={fileRequest}
                />
              ) : null}
              {!detail.police_verification_required ? (
                <p className="text-caption text-ink-muted">
                  {t(
                    'Police-verification proof is not required by this society.',
                  )}
                </p>
              ) : null}
            </>
          ) : null}
          {canManage &&
          canWrite &&
          move.kind === 'move_out' &&
          move.status === 'completed' &&
          !noc ? (
            <>
              <p className="text-body">
                {t(
                  'An administrator can issue the approved move-out NOC. The file records dues status at issue; current dues are checked again.',
                )}
              </p>
              {!positiveDues ? (
                <TenancyDecisionControl
                  detail={detail}
                  decision="issue"
                  action={actions.issue}
                />
              ) : (
                <p className="text-caption text-danger">
                  {t(
                    'Clear the positive balance and refresh before issuing the NOC.',
                  )}
                </p>
              )}
            </>
          ) : null}
        </div>
      </Card>
      {canWrite && open ? (
        <Card title={t('Next actions')}>
          <div className="grid gap-space-3">
            {canManage &&
            ['awaiting_consent', 'pending_review'].includes(move.status) &&
            proofsReady &&
            consentReady ? (
              <TenancyDecisionControl
                detail={detail}
                decision="approved"
                action={actions.decide}
              />
            ) : null}
            {canManage &&
            move.status === 'approved' &&
            proofsReady &&
            consentReady &&
            !positiveDues ? (
              <TenancyDecisionControl
                detail={detail}
                decision="complete"
                action={actions.complete}
              />
            ) : null}
            {canManage && move.status === 'approved' && positiveDues ? (
              <p className="text-body text-danger">
                {t(
                  'Clear the positive balance and refresh before confirming actual completion.',
                )}
              </p>
            ) : null}
            {canManage && move.kind === 'move_in' && !consentReady ? (
              <p className="text-body">
                {t(
                  'Waiting for valid consent from an active owner. If recorded consent is no longer valid, cancel this request and create a new one; there is no bypass.',
                )}
              </p>
            ) : null}
            {canManage && !proofsReady ? (
              <p className="text-body">
                {t(
                  'Required proofs must be attached before scheduling or completion.',
                )}
              </p>
            ) : null}
            {canManage ? (
              <TenancyDecisionControl
                detail={detail}
                decision="rejected"
                action={actions.decide}
              />
            ) : null}
            {detail.can_cancel ? (
              <TenancyDecisionControl
                detail={detail}
                decision="cancelled"
                action={actions.decide}
              />
            ) : null}
            {!canManage && !detail.can_cancel ? (
              <p className="text-body text-ink-muted">
                {t(
                  'An administrator reviews the schedule and confirms actual completion.',
                )}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
      <Card
        title={t('Request timeline')}
        description={t(
          'History is preserved. Approval and actual completion are separate events.',
        )}
      >
        <ol className="grid min-w-0 gap-space-4">
          {detail.events.map((event) => (
            <li
              key={event.id}
              className="grid gap-space-1 border-b border-rule pb-space-3"
            >
              <p className="text-body-strong">
                {t(TENANCY_EVENT_LABELS[event.action])}
              </p>
              <p className="text-caption text-ink-muted">
                {event.actor_name}, {time(event.created_at, workspace.timezone)}
              </p>
              {event.reason ? (
                <p className="whitespace-pre-wrap text-body">{event.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>
      <p className="text-caption text-ink-muted">
        {t('NOCs and other generated documents remain in English.')}
      </p>
    </section>
  );
}
