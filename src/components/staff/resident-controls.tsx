// Register domestic staff and manage unit access for today.
'use client';

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
      submitLabel="Submit staff registration"
    >
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-unit`}
      >
        Register for unit
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
        Full name
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
        Phone number
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
        Role (for example, cook or electrician)
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
        ID proof type (optional; do not enter a document number)
        <select
          className="min-h-12 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue=""
          id={`${prefix}-id-type`}
          name="idType"
        >
          <option value="">Not provided</option>
          <option value="aadhaar">Aadhaar</option>
          <option value="pan">PAN</option>
          <option value="voter_id">Voter ID</option>
          <option value="passport">Passport</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-id-last-four`}
      >
        Last four characters only
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
        Police verification checked
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
  return (
    <StaffActionForm
      action={action}
      className="inline-grid"
      confirmMessage={`Block ${staffName} from entry to ${unitLabel} for the rest of today? Their access to other linked units is unchanged.`}
      input={() => ({ staffId, unitId })}
      submitLabel="Block for today"
      submitVariant="destructive"
    >
      <span className="sr-only">
        Block {staffName} from this unit for today
      </span>
    </StaffActionForm>
  );
}
