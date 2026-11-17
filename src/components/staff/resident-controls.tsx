// Register domestic staff and manage unit access for today.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { useId } from 'react';
import { StaffActionForm, type StaffFormAction } from './action-form';
import { StaffPhotoUpload } from './photo-upload';
import {
  blockStaffForTodayAction,
  registerDomesticStaffAction,
} from '@/app/(resident)/staff/actions';
import type { StaffUnit } from '@/core/staff/validation';

export function DomesticStaffRegistrationForm({
  units,
  societyId,
  action = registerDomesticStaffAction,
}: {
  units: readonly StaffUnit[];
  societyId: string;
  action?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const prefix = useId();
  return (
    <StaffActionForm
      action={action}
      input={(formData) => ({
        unitId: formData.get('unitId'),
        fullName: formData.get('fullName'),
        phone: formData.get('phone'),
        photoPath: formData.get('photoPath') || null,
        idType: formData.get('idType') || null,
        idLastFour: formData.get('idLastFour') || null,
        jobRole: formData.get('jobRole'),
        policeVerified: formData.get('policeVerified') === 'on',
      })}
      requestIdStorageKey={(formData) =>
        `homeish:staff-registration:${societyId}:${String(formData.get('unitId'))}`
      }
      submitLabel={t('Submit staff registration')}
    >
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-unit`}
      >
        {t('Register for unit')}
        <select
          className="min-h-12 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          id={`${prefix}-unit`}
          name="unitId"
          required
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </select>
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-name`}
      >
        {t('Full name')}
        <input
          className="min-h-12 rounded-md border border-rule px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          id={`${prefix}-name`}
          maxLength={120}
          name="fullName"
          required
        />
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-phone`}
      >
        {t('Phone number')}
        <input
          className="min-h-12 rounded-md border border-rule px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          id={`${prefix}-phone`}
          inputMode="tel"
          name="phone"
          required
          type="tel"
        />
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-role`}
      >
        {t('Role (for example, cook or electrician)')}
        <input
          className="min-h-12 rounded-md border border-rule px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          id={`${prefix}-role`}
          maxLength={80}
          name="jobRole"
          required
        />
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-id-type`}
      >
        {t('ID proof type (optional; do not enter a document number)')}
        <select
          className="min-h-12 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue=""
          id={`${prefix}-id-type`}
          name="idType"
        >
          <option value="">{t('Not provided')}</option>
          <option value="aadhaar">{t('Aadhaar')}</option>
          <option value="pan">{t('PAN')}</option>
          <option value="voter_id">{t('Voter ID')}</option>
          <option value="passport">{t('Passport')}</option>
          <option value="other">{t('Other')}</option>
        </select>
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-id-last-four`}
      >
        {t('Last four characters only')}
        <input
          autoComplete="off"
          className="min-h-12 rounded-md border border-rule px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          id={`${prefix}-id-last-four`}
          maxLength={4}
          name="idLastFour"
        />
      </label>
      <label className="flex min-h-11 items-center gap-space-2 text-body">
        <input name="policeVerified" type="checkbox" />
        {t('Police verification checked')}
      </label>
      <StaffPhotoUpload />
    </StaffActionForm>
  );
}

export function UnitStaffDayBlockForm({
  staffId,
  staffName,
  unitId,
  unitLabel,
  action = blockStaffForTodayAction,
}: {
  staffId: string;
  staffName: string;
  unitId: string;
  unitLabel: string;
  action?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <StaffActionForm
      action={action}
      className="inline-grid"
      confirmMessage={t(
        'Block {name} from entry to {unit} for the rest of today? Their access to other linked units is unchanged.',
        { name: staffName, unit: unitLabel },
      )}
      input={() => ({ staffId, unitId })}
      submitLabel={t('Block for today')}
      submitVariant="destructive"
    >
      <span className="sr-only">
        {t('Block {name} from this unit for today', { name: staffName })}
      </span>
    </StaffActionForm>
  );
}
