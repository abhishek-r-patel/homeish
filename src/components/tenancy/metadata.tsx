// Add limited, privacy-safe verification and agreement metadata to existing moves.
'use client';
import { useId } from 'react';
import {
  saveTenancyAgreementMetadataAction,
  saveTenancyVerificationAction,
} from '@/app/(resident)/tenancy/actions';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import {
  tenancyAgreementMetadataInputSchema,
  tenancyVerificationInputSchema,
  type TenancyMoveDetail,
  type TenancyMoveProgress,
} from '@/core/tenancy/moves/validation';
import { useTenancyPresentation } from './presentation';

export function TenancyMetadataControls({
  detail,
  progress,
}: {
  detail: TenancyMoveDetail;
  progress: TenancyMoveProgress;
}) {
  const { t } = useTenancyPresentation();
  const prefix = useId();
  return (
    <div className="grid gap-space-4">
      {detail.move.kind === 'move_in' ? (
        <ModuleActionForm
          action={saveTenancyAgreementMetadataAction}
          submitLabel={t('Save agreement metadata')}
          input={(form) =>
            tenancyAgreementMetadataInputSchema.parse({
              moveId: detail.move.id,
              expectedVersion: progress.version,
              agreementType: form.get('agreementType'),
              startsOn: form.get('startsOn'),
              expiresOn: form.get('expiresOn'),
            })
          }
        >
          <SelectInput
            id={`${prefix}-agreement-type`}
            name="agreementType"
            label={t('Agreement type')}
            defaultValue={progress.agreement.type ?? 'rental'}
            options={[
              { value: 'rental', label: t('Rental') },
              {
                value: 'leave_and_licence',
                label: t('Leave and licence'),
              },
              { value: 'company_lease', label: t('Company lease') },
              { value: 'paying_guest', label: t('Paying guest') },
              { value: 'other', label: t('Other') },
            ]}
          />
          <TextInput
            id={`${prefix}-starts-on`}
            name="startsOn"
            type="date"
            label={t('Agreement start date')}
            defaultValue={progress.agreement.starts_on ?? ''}
            required
          />
          <TextInput
            id={`${prefix}-expires-on`}
            name="expiresOn"
            type="date"
            label={t('Agreement expiry date')}
            defaultValue={progress.agreement.expires_on ?? ''}
            required
          />
        </ModuleActionForm>
      ) : null}
      {progress.verification_tracking_enabled ? (
        <ModuleActionForm
          action={saveTenancyVerificationAction}
          submitLabel={t('Save verification status')}
          input={(form) =>
            tenancyVerificationInputSchema.parse({
              moveId: detail.move.id,
              expectedVersion: progress.version,
              status: form.get('status'),
              recordedOn: form.get('recordedOn'),
              reference: form.get('reference'),
            })
          }
        >
          <SelectInput
            id={`${prefix}-verification-status`}
            name="status"
            label={t('Verification status')}
            defaultValue={progress.verification.status ?? 'pending'}
            options={[
              { value: 'pending', label: t('Pending') },
              { value: 'verified', label: t('Verified') },
              { value: 'rejected', label: t('Rejected') },
            ]}
          />
          <TextInput
            id={`${prefix}-recorded-on`}
            name="recordedOn"
            type="date"
            label={t('Verification date')}
            defaultValue={progress.verification.checked_on ?? ''}
            required
          />
          <TextInput
            id={`${prefix}-reference`}
            name="reference"
            label={t('Verification reference')}
            maxLength={120}
            defaultValue={progress.verification.reference ?? ''}
            required
          />
          <p className="text-caption text-ink-muted">
            {t(
              'Store a receipt or tracking reference only. Do not upload or copy a government ID into this field.',
            )}
          </p>
        </ModuleActionForm>
      ) : (
        <p className="text-caption text-ink-muted">
          {t(
            'Optional verification tracking is off for this society. No status is required.',
          )}
        </p>
      )}
    </div>
  );
}
