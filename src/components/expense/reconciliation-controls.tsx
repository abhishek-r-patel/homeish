// Render P39 bank reconciliation, petty-cash custodian and cash-count forms.
'use client';
import { useId } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import { TextInput } from '@/components/ui/text-input';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import {
  assignPettyCashAction,
  cancelStatementItemAction,
  matchStatementItemAction,
  recordCashCountAction,
  recordStatementItemAction,
} from '@/app/(admin)/admin/expenses/actions';

export function StatementItemForm({
  accountId,
  today,
  action = recordStatementItemAction,
}: {
  accountId: string;
  today: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Add statement item')}
      input={(data) => ({
        accountId,
        statementDate: data.get('statementDate'),
        reference: data.get('reference') ?? '',
        party: data.get('party') ?? '',
        direction: data.get('direction'),
        amountRupees: data.get('amountRupees'),
      })}
    >
      <TextInput
        id={`${id}-date`}
        label={t('Statement date')}
        name="statementDate"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <SelectInput
        id={`${id}-direction`}
        label={t('Money')}
        name="direction"
        required
        options={[
          { value: 'in', label: t('In (credit)') },
          { value: 'out', label: t('Out (debit)') },
        ]}
      />
      <AmountInput
        id={`${id}-amount`}
        label={t('Amount')}
        name="amountRupees"
        required
      />
      <TextInput
        id={`${id}-reference`}
        label={t('Reference')}
        name="reference"
        maxLength={80}
      />
      <TextInput
        id={`${id}-party`}
        label={t('Party')}
        name="party"
        maxLength={120}
      />
    </ModuleActionForm>
  );
}

export function StatementMatchForm({
  itemId,
  candidates,
  action = matchStatementItemAction,
}: {
  itemId: string;
  candidates: readonly { id: string; label: string }[];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Match')}
      input={(data) => ({ itemId, entryId: data.get('entryId') })}
    >
      <SelectInput
        id={`${id}-entry`}
        label={t('Book entry with the same amount and direction')}
        name="entryId"
        required
        options={candidates.map((entry) => ({
          value: entry.id,
          label: entry.label,
        }))}
      />
    </ModuleActionForm>
  );
}

export function StatementCancelForm({
  itemId,
  action = cancelStatementItemAction,
}: {
  itemId: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Cancel item')}
      confirmMessage={t(
        'Cancel this statement item? It stays on record with your reason.',
      )}
      input={(data) => ({ itemId, reason: data.get('reason') })}
    >
      <TextAreaInput
        id={`${id}-reason`}
        label={t('Reason for cancelling')}
        name="reason"
        required
        maxLength={1000}
      />
    </ModuleActionForm>
  );
}

export function PettyCashAssignForm({
  accountId,
  members,
  currentCustodianId,
  action = assignPettyCashAction,
}: {
  accountId: string;
  members: readonly { user_id: string; full_name: string }[];
  currentCustodianId: string | null;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const changing = currentCustodianId !== null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={changing ? t('Change custodian') : t('Set custodian')}
      input={(data) => ({
        accountId,
        custodianUserId: data.get('custodianUserId'),
        handoverCountRupees: data.get('handoverCountRupees') || null,
        handoverNote: data.get('handoverNote') ?? '',
      })}
    >
      <SelectInput
        id={`${id}-custodian`}
        label={t('Custodian')}
        name="custodianUserId"
        required
        defaultValue={currentCustodianId ?? ''}
        options={members.map((member) => ({
          value: member.user_id,
          label: member.full_name,
        }))}
      />
      {changing ? (
        <>
          <AmountInput
            id={`${id}-handover`}
            label={t('Handover count')}
            name="handoverCountRupees"
            required
            helpText={t(
              'Count the cash with the outgoing custodian before handing over.',
            )}
          />
          <TextAreaInput
            id={`${id}-note`}
            label={t('Handover note')}
            name="handoverNote"
            maxLength={500}
          />
        </>
      ) : null}
    </ModuleActionForm>
  );
}

export function CashCountForm({
  today,
  openingOn,
  action = recordCashCountAction,
}: {
  today: string;
  openingOn: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Record count')}
      input={(data) => ({
        countDate: data.get('countDate'),
        countedRupees: data.get('countedRupees'),
        note: data.get('note') ?? '',
      })}
    >
      <TextInput
        id={`${id}-date`}
        label={t('Count date')}
        name="countDate"
        type="date"
        required
        min={openingOn}
        max={today}
        defaultValue={today}
      />
      <AmountInput
        id={`${id}-counted`}
        label={t('Cash counted')}
        name="countedRupees"
        required
      />
      <TextAreaInput
        id={`${id}-note`}
        label={t('Note')}
        name="note"
        maxLength={500}
      />
    </ModuleActionForm>
  );
}
