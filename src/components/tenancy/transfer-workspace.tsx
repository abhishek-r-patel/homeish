// Present the transfer tab, one-society warning and privacy-scoped case list.
'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  acknowledgeClearanceWarningAction,
  saveTransferCaseAction,
} from '@/app/(resident)/tenancy/actions';
import {
  CLEARANCE_WARNING,
  clearanceAcknowledgementInputSchema,
  transferCaseInputSchema,
  transferStageSchema,
  type TransferCaseDetail,
  type TransferCasesPage,
  type TenancyCertificate,
} from '@/core/tenancy/transfers/validation';
import type { ClearanceDues } from '@/core/tenancy/transfers/validation';
import type { TenancyWorkspace } from '@/core/tenancy/moves/validation';
import { TRANSFER_STAGE_LABELS } from '@/core/tenancy/transfers/presentation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { DatePicker } from '@/components/ui/date-time-inputs';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { Combobox } from '@/components/ui/combobox';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';
import { Pagination, type PageSize } from '@/components/ui/table-controls';
import { useTenancyPresentation } from './presentation';
import { TransferCaseView } from './transfer-detail';
import { TransferDocumentLink } from './transfer-files';
import { CERTIFICATE_KIND_LABELS } from '@/core/tenancy/transfers/presentation';

export function TenancyAdminTabs({
  selected,
}: {
  selected: 'moves' | 'transfers';
}) {
  const { t } = useTenancyPresentation();
  return (
    <nav
      aria-label={t('Tenancy views')}
      className="flex border-b border-rule"
      role="tablist"
    >
      <Link
        aria-selected={selected === 'moves'}
        className={`inline-flex min-h-12 items-center border-b-2 px-space-4 ${selected === 'moves' ? 'border-brand font-semibold text-brand' : 'border-transparent text-ink-muted'}`}
        href="/admin/tenancy?tab=moves"
        role="tab"
      >
        {t('Moves')}
      </Link>
      <Link
        aria-selected={selected === 'transfers'}
        className={`inline-flex min-h-12 items-center border-b-2 px-space-4 ${selected === 'transfers' ? 'border-brand font-semibold text-brand' : 'border-transparent text-ink-muted'}`}
        href="/admin/tenancy?tab=transfers"
        role="tab"
      >
        {t('Transfers')}
      </Link>
    </nav>
  );
}

export function TransferCreateForm({
  workspace,
  action = saveTransferCaseAction,
}: {
  workspace: TenancyWorkspace;
  action?: ModuleFormAction;
}) {
  const { t } = useTenancyPresentation();
  const id = useId();
  const router = useRouter();
  const [unitId, setUnitId] = useState<string | null>(
    workspace.units[0]?.id ?? null,
  );
  const [sellerIds, setSellerIds] = useState<string[]>([]);
  const [buyerMembershipId, setBuyerMembershipId] = useState<string | null>(
    null,
  );
  const [buyerName, setBuyerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [receivedOn, setReceivedOn] = useState(workspace.today);
  const owners = workspace.occupancies.filter(
    (occupancy) =>
      occupancy.unit_id === unitId &&
      !occupancy.is_tenant &&
      occupancy.status === 'active',
  );
  const ownerChoices = owners.map((owner) => {
    const tenant = workspace.tenants.find(
      (candidate) => candidate.id === owner.membership_id,
    );
    return {
      value: owner.membership_id,
      label: tenant?.name ?? owner.membership_id,
    };
  });
  return (
    <Card
      title={t('New transfer case')}
      description={t(
        'This records an application only. Completing the tracker does not change Core ownership.',
      )}
    >
      <ModuleActionForm
        action={action}
        idempotent
        refresh={false}
        onSaved={(caseId) =>
          router.push(`/admin/tenancy/transfers/${zString(caseId)}`)
        }
        submitDisabled={!unitId || sellerIds.length === 0 || !buyerName.trim()}
        submitLabel={t('Create Transfer Case')}
        input={(_, clientRequestId) =>
          transferCaseInputSchema.parse({
            caseId: null,
            unitId,
            receivedOn,
            sellers: sellerIds.map((membershipId) => ({ membershipId })),
            buyer: {
              name: buyerName,
              membershipId: buyerMembershipId,
              phone: phone || null,
              email: email || null,
            },
            expectedVersion: null,
            clientRequestId,
          })
        }
      >
        <Combobox
          id={`${id}-unit`}
          label={workspace.unit_label}
          onChange={(value) => {
            setUnitId(value);
            setSellerIds([]);
          }}
          options={workspace.units.map((unit) => ({
            value: unit.id,
            label: unit.number,
          }))}
          required
          value={unitId}
        />
        <div className="grid gap-space-2">
          <p className="text-body-strong">
            {t('Current active owners (sellers)')}
          </p>
          {ownerChoices.map((owner) => (
            <label
              className="flex min-h-12 items-center gap-space-2"
              key={owner.value}
            >
              <input
                checked={sellerIds.includes(owner.value)}
                onChange={(event) =>
                  setSellerIds((current) =>
                    event.currentTarget.checked
                      ? [...current, owner.value]
                      : current.filter((id) => id !== owner.value),
                  )
                }
                type="checkbox"
              />
              {owner.label}
            </label>
          ))}
          {ownerChoices.length === 0 ? (
            <p className="text-caption text-ink-muted">
              {t('No active owner is available for this unit.')}
            </p>
          ) : null}
        </div>
        <TextInput
          id={`${id}-buyer-name`}
          label={t('Buyer name')}
          onChange={(event) => setBuyerName(event.currentTarget.value)}
          required
          value={buyerName}
        />
        <Combobox
          id={`${id}-buyer-member`}
          label={t('Buyer member (optional)')}
          onChange={setBuyerMembershipId}
          options={workspace.tenants
            .filter((tenant) => !sellerIds.includes(tenant.id))
            .map((tenant) => ({ value: tenant.id, label: tenant.name }))}
          value={buyerMembershipId}
        />
        <TextInput
          id={`${id}-phone`}
          label={t('Buyer phone (optional)')}
          onChange={(event) => setPhone(event.currentTarget.value)}
          type="tel"
          value={phone}
        />
        <TextInput
          id={`${id}-email`}
          label={t('Buyer email (optional)')}
          onChange={(event) => setEmail(event.currentTarget.value)}
          type="email"
          value={email}
        />
        <DatePicker
          id={`${id}-received`}
          label={t('Received date')}
          max={workspace.today}
          onChange={setReceivedOn}
          value={receivedOn}
        />
      </ModuleActionForm>
    </Card>
  );
}

function zString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function TransferWorkspaceView({
  workspace,
  page,
  detail,
  dues,
  mode,
  certificates,
  acknowledgement,
  stage: appliedStage = null,
  action = acknowledgeClearanceWarningAction,
}: {
  workspace: TenancyWorkspace;
  page: TransferCasesPage;
  detail: TransferCaseDetail | null;
  dues: ClearanceDues | null;
  mode: 'admin' | 'committee' | 'own';
  certificates: TenancyCertificate[];
  acknowledgement: {
    acknowledged: boolean;
    acknowledged_at: string | null;
  } | null;
  stage?:
    | 'received'
    | 'documents_checked'
    | 'committee_decision'
    | 'dues_settled'
    | 'completed'
    | 'rejected'
    | 'withdrawn'
    | null;
  action?: ModuleFormAction;
}) {
  const { t, date } = useTenancyPresentation();
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(
    acknowledgement?.acknowledged ?? false,
  );
  const [stage, setStage] = useState(appliedStage ?? '');
  const baseHref =
    mode === 'admin' || mode === 'committee' ? '/admin/tenancy' : '/tenancy';
  const items = page.items;
  const pageSize = [10, 25, 50, 100].includes(page.limit)
    ? (page.limit as PageSize)
    : 25;
  function navigate(nextStage: string, offset: number, limit: PageSize) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (mode !== 'own') query.set('tab', 'transfers');
    if (nextStage) query.set('stage', nextStage);
    if (offset) query.set('offset', String(offset));
    router.push(`${baseHref}?${query}`);
  }
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      {mode !== 'own' ? <TenancyAdminTabs selected="transfers" /> : null}
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">
          {t(mode === 'own' ? 'My transfer cases' : 'Transfer cases')}
        </h1>
        <p className="text-body text-ink-muted">
          {t(
            'Application tracking only. Transfer cases never transfer legal title or change Core ownership.',
          )}
        </p>
      </header>
      {mode === 'admin' && workspace.can_write ? (
        acknowledged ? (
          <Banner title={t('Warning acknowledged')} tone="success">
            {t('The warning is acknowledged for this society.')}
          </Banner>
        ) : (
          <Card
            title={t('Clearance warning')}
            description={t(CLEARANCE_WARNING)}
          >
            <ModuleActionForm
              action={action}
              idempotent
              submitLabel={t('Acknowledge Warning')}
              onSaved={() => setAcknowledged(true)}
              input={(_, clientRequestId) =>
                clearanceAcknowledgementInputSchema.parse({
                  warningText: CLEARANCE_WARNING,
                  clientRequestId,
                })
              }
            >
              <p className="text-body">
                {t(
                  'Use of transfer, conditional handover and new certificate writes is blocked until this society warning is acknowledged.',
                )}
              </p>
            </ModuleActionForm>
          </Card>
        )
      ) : null}
      {mode === 'admin' && workspace.can_write && acknowledged ? (
        <TransferCreateForm workspace={workspace} />
      ) : null}
      {mode === 'committee' ? (
        <Banner title={t('Read only')} tone="neutral">
          {t(
            'Buyer contact details, agreement files and certificate files are hidden.',
          )}
        </Banner>
      ) : null}
      <Card title={t('Tenancy certificates')}>
        {certificates.length ? (
          <ul className="grid gap-space-3">
            {certificates.map((certificate) => (
              <li
                className="grid gap-space-2 border-b border-rule pb-space-3"
                key={certificate.id}
              >
                <p className="text-body-strong">
                  {certificate.number} ·{' '}
                  {t(CERTIFICATE_KIND_LABELS[certificate.kind])}
                </p>
                <p className="text-caption text-ink-muted">
                  {date(certificate.issued_at.slice(0, 10))}
                  {certificate.superseded_by ? t(' · Superseded') : ''}
                </p>
                {certificate.path && mode !== 'committee' ? (
                  <TransferDocumentLink
                    label={certificate.number}
                    path={certificate.path}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No numbered tenancy certificate is available to you.')}
          </p>
        )}
      </Card>
      {detail && mode !== 'admin' ? (
        <TransferCaseView
          baseHref={baseHref}
          detail={detail}
          dues={dues}
          mode={mode === 'own' ? 'own' : 'committee'}
          workspace={workspace}
        />
      ) : (
        <Card title={t('Cases')}>
          <label
            className="grid gap-space-1 text-caption"
            htmlFor="transfer-stage"
          >
            {t('Stage')}
            <select
              className="min-h-12 w-full min-w-0 rounded-md border border-rule bg-surface px-space-3 text-body"
              id="transfer-stage"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setStage(value ? transferStageSchema.parse(value) : '');
                navigate(value, 0, pageSize);
              }}
              value={stage}
            >
              <option value="">{t('All stages')}</option>
              {transferStageSchema.options.map((value) => (
                <option key={value} value={value}>
                  {t(TRANSFER_STAGE_LABELS[value])}
                </option>
              ))}
            </select>
          </label>
          {items.length ? (
            <ul className="mt-space-4 grid gap-space-3">
              {items.map((item) => (
                <li
                  className="grid gap-space-2 rounded-md border border-rule p-space-3"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-space-2">
                    <a
                      className="text-body-strong text-brand underline"
                      href={
                        mode === 'own'
                          ? `${baseHref}?transferId=${item.id}`
                          : `${baseHref}/transfers/${item.id}`
                      }
                    >
                      {workspace.unit_label} {item.unit_number}
                    </a>
                    <span className="rounded-sm bg-surface-sunken px-space-2 py-space-1 text-micro">
                      {t(TRANSFER_STAGE_LABELS[item.stage])}
                    </span>
                  </div>
                  <p className="text-caption text-ink-muted">
                    {t('Received {date}', { date: date(item.received_on) })}
                    {' · '}
                    {t(TRANSFER_STAGE_LABELS[item.stage])}
                  </p>
                  <p className="text-body">
                    {t('Buyer')}:{' '}
                    {item.buyers.map((buyer) => buyer.name).join(', ')}
                  </p>
                  <Button
                    onClick={() =>
                      router.push(
                        mode === 'own'
                          ? `${baseHref}?transferId=${item.id}`
                          : `${baseHref}/transfers/${item.id}`,
                      )
                    }
                    variant="secondary"
                  >
                    {t('View Case')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description={t(
                mode === 'own'
                  ? 'There is no transfer case for your active linked party record.'
                  : 'No transfer cases match this stage.',
              )}
              title={t('No transfer cases')}
            />
          )}
          <Pagination
            total={page.total}
            page={Math.floor(page.offset / pageSize) + 1}
            pageSize={pageSize}
            onPageChange={(next) =>
              navigate(stage, (next - 1) * pageSize, pageSize)
            }
            onPageSizeChange={(next) => navigate(stage, 0, next)}
          />
        </Card>
      )}
    </section>
  );
}
