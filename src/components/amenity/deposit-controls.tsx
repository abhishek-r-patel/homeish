// Record, correct and view permanent amenity deposit history.
'use client';

import { useId, useState } from 'react';
import {
  overrideAmenityDepositAction,
  recordAmenityDepositEventAction,
  voidAmenityDepositEventAction,
} from '@/app/(resident)/amenities/actions';
import { formatRupees } from '@/core/billing/format';
import { rupeesFromPaise } from '@/core/billing/validation';
import type { AmenityBooking } from '@/core/amenity/validation';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import {
  AmenityDepositEvidenceLink,
  AmenityDepositEvidenceUpload,
} from './deposit-files';

const control =
  'min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3';

type Deposit = NonNullable<AmenityBooking['deposit']>;

export function AmenityDepositControls({
  accounts,
  admin,
  booking,
}: {
  accounts: { id: string; name: string; account_type: 'cash' | 'bank' }[];
  admin: boolean;
  booking: AmenityBooking;
}) {
  const { translate: t } = useUiTranslator();
  const deposit = booking.deposit;
  if (!deposit) return null;
  return (
    <section className="grid gap-space-3 border-t border-rule pt-space-3">
      <h3 className="text-body-strong">{t('Refundable deposit')}</h3>
      <dl className="grid gap-space-2 text-body">
        <DepositAmount
          label={t('Required')}
          value={deposit.current_amount_paise}
        />
        <DepositAmount label={t('Received')} value={deposit.received_paise} />
        <DepositAmount label={t('Refunded')} value={deposit.refunded_paise} />
        <DepositAmount label={t('Deducted')} value={deposit.deducted_paise} />
        <DepositAmount label={t('Still held')} value={deposit.held_paise} />
        <DepositAmount
          label={t('Still to receive')}
          value={deposit.remaining_paise}
        />
      </dl>
      {admin && deposit.can_override ? (
        <DepositOverride bookingId={booking.id} deposit={deposit} />
      ) : null}
      {admin ? (
        <DepositEventForm
          accounts={accounts}
          bookingId={booking.id}
          confirmed={booking.status === 'confirmed'}
        />
      ) : null}
      <DepositHistory admin={admin} deposit={deposit} />
    </section>
  );
}

function DepositAmount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-space-3">
      <dt>{label}</dt>
      <dd>{formatRupees(value)}</dd>
    </div>
  );
}

function DepositOverride({
  bookingId,
  deposit,
}: {
  bookingId: string;
  deposit: Deposit;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={overrideAmenityDepositAction}
      idempotent
      input={(form) => ({
        bookingId,
        amountRupees: form.get('amountRupees'),
        reason: form.get('reason'),
      })}
      submitLabel={t('Change deposit amount')}
    >
      <h4 className="font-semibold">{t('Deposit amount override')}</h4>
      <TextInput
        defaultValue={rupeesFromPaise(deposit.current_amount_paise)}
        id={`${id}-amount`}
        label={t('Deposit amount in rupees')}
        name="amountRupees"
        inputMode="decimal"
        required
      />
      <TextInput
        id={`${id}-reason`}
        label={t('Reason')}
        name="reason"
        maxLength={500}
        required
      />
    </ModuleActionForm>
  );
}

function DepositEventForm({
  accounts,
  bookingId,
  confirmed,
}: {
  accounts: { id: string; name: string; account_type: 'cash' | 'bank' }[];
  bookingId: string;
  confirmed: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [kind, setKind] = useState<'receipt' | 'refund' | 'deduction'>(
    'receipt',
  );
  const [evidencePath, setEvidencePath] = useState<string | null>(null);
  return (
    <ModuleActionForm
      action={recordAmenityDepositEventAction}
      idempotent
      input={(form) => ({
        bookingId,
        kind,
        amountRupees: form.get('amountRupees'),
        eventDate: form.get('eventDate'),
        accountId:
          kind === 'deduction' ? null : String(form.get('accountId') ?? ''),
        reference: String(form.get('reference') ?? '').trim() || null,
        reason: String(form.get('reason') ?? '').trim() || null,
        evidencePath: kind === 'deduction' ? evidencePath : null,
      })}
      submitLabel={t('Record deposit event')}
    >
      <h4 className="font-semibold">{t('Record external deposit movement')}</h4>
      <label className="grid gap-space-1">
        {t('Event')}
        <select
          className={control}
          id={`${id}-kind`}
          onChange={(event) =>
            setKind(event.target.value as 'receipt' | 'refund' | 'deduction')
          }
          value={kind}
        >
          <option value="receipt">{t('Receipt')}</option>
          <option value="refund">{t('Refund')}</option>
          <option disabled={!confirmed} value="deduction">
            {t('Deduction')}
          </option>
        </select>
      </label>
      <TextInput
        id={`${id}-amount`}
        label={t('Amount in rupees')}
        name="amountRupees"
        inputMode="decimal"
        required
      />
      <TextInput
        id={`${id}-date`}
        label={t('Date')}
        name="eventDate"
        required
        type="date"
      />
      {kind === 'deduction' ? (
        <AmenityDepositEvidenceUpload
          bookingId={bookingId}
          onUploaded={setEvidencePath}
        />
      ) : (
        <label className="grid gap-space-1">
          {t('Cash or bank account')}
          <select className={control} name="accountId" required>
            <option value="">{t('Choose an account')}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ·{' '}
                {t(account.account_type === 'cash' ? 'Cash' : 'Bank')}
              </option>
            ))}
          </select>
        </label>
      )}
      <TextInput
        id={`${id}-reference`}
        label={t('Reference (optional)')}
        maxLength={120}
        name="reference"
      />
      <TextInput
        id={`${id}-reason`}
        label={t(kind === 'receipt' ? 'Reason (optional)' : 'Reason')}
        maxLength={500}
        name="reason"
        required={kind !== 'receipt'}
      />
      {kind === 'deduction' && evidencePath ? (
        <p className="text-caption text-ink-muted">
          {t('Evidence attached. It remains private.')}
        </p>
      ) : null}
    </ModuleActionForm>
  );
}

function DepositHistory({
  admin,
  deposit,
}: {
  admin: boolean;
  deposit: Deposit;
}) {
  const { translate: t } = useUiTranslator();
  if (deposit.events.length === 0) return <p>{t('No deposit events yet.')}</p>;
  return (
    <div className="grid gap-space-2">
      <h4 className="font-semibold">{t('Deposit history')}</h4>
      <ul className="grid gap-space-2">
        {deposit.events.map((event) => (
          <li
            className="rounded-md border border-rule p-space-3"
            key={event.id}
          >
            <p className="font-semibold">
              {t(event.kind.replace('_', ' '))}{' '}
              {event.amount_paise === null
                ? ''
                : `· ${formatRupees(event.amount_paise)}`}
              {event.is_voided ? ` · ${t('Voided')}` : ''}
            </p>
            {event.event_date ? <p>{event.event_date}</p> : null}
            {event.account_name ? <p>{event.account_name}</p> : null}
            {event.reference ? <p>{event.reference}</p> : null}
            {event.reason ? <p>{event.reason}</p> : null}
            {event.evidence_path ? (
              <AmenityDepositEvidenceLink path={event.evidence_path} />
            ) : null}
            {admin && event.kind !== 'void' && !event.is_voided ? (
              <ModuleActionForm
                action={voidAmenityDepositEventAction}
                confirmMessage={t(
                  'Void this deposit event and preserve a permanent correction?',
                )}
                idempotent
                input={(form) => ({
                  eventId: event.id,
                  reason: form.get('reason'),
                })}
                submitLabel={t('Void event')}
              >
                <TextInput
                  id={`void-${event.id}-reason`}
                  label={t('Void reason')}
                  maxLength={500}
                  name="reason"
                  required
                />
              </ModuleActionForm>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
