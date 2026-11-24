// Control resident identity visibility on the society amenity calendar.
'use client';
import { useId } from 'react';
import {
  saveAmenityCalendarVisibilityAction,
  saveAmenityDepositPolicyAction,
} from '@/app/(resident)/amenities/actions';
import { useUiTranslator } from '@/components/ui/language';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import {
  AMENITY_CALENDAR_IDENTITIES,
  amenityCalendarVisibilityInputSchema,
  type AmenityCalendarIdentity,
} from '@/core/amenity/validation';
import { createComponentTranslator } from '@/core/i18n/catalogs/hi-components';

const labels: Record<AmenityCalendarIdentity, string> = {
  availability_only: 'Availability only',
  booker_name: 'Booker name',
  booker_name_and_unit: 'Booker name and unit',
};

export function AmenityCalendarSettings({
  identity,
  directoryEnabled,
  canManage,
  action = saveAmenityCalendarVisibilityAction,
  depositPolicy,
  depositPolicyAction = saveAmenityDepositPolicyAction,
}: {
  identity: AmenityCalendarIdentity;
  directoryEnabled: boolean;
  canManage: boolean;
  action?: ModuleFormAction;
  depositPolicy: 'per_amenity' | 'immediate';
  depositPolicyAction?: ModuleFormAction;
}) {
  const id = useId();
  const { locale, translate } = useUiTranslator();
  const t = createComponentTranslator(locale ?? 'en', translate);
  return (
    <div className="grid gap-space-3">
      <p className="text-body">
        {t(
          identity === 'availability_only'
            ? 'Residents see availability only.'
            : directoryEnabled
              ? `Residents may see the ${labels[identity].toLowerCase()} after each person’s Directory preferences are checked.`
              : 'The selected identity mode is unavailable because the Directory module is off. Residents still see availability only.',
        )}
      </p>
      <p className="text-body">
        {depositPolicy === 'per_amenity'
          ? t(
              'Required deposits follow each amenity and reserve the slot until full payment is recorded.',
            )
          : t(
              'Bookings confirm immediately and any configured deposit remains outstanding.',
            )}
      </p>
      {canManage ? (
        <>
          <ModuleActionForm
            action={action}
            submitLabel={t('Save amenity calendar visibility')}
            input={(form) =>
              amenityCalendarVisibilityInputSchema.parse({
                identity: form.get('identity'),
              })
            }
          >
            <SelectInput
              id={id}
              name="identity"
              label={t('Resident calendar identity')}
              defaultValue={identity}
              options={AMENITY_CALENDAR_IDENTITIES.map((value) => ({
                value,
                label: t(labels[value]),
              }))}
            />
            <p className="text-caption text-ink-muted">
              {t(
                'Name and unit are shown only when Directory is enabled and the person has allowed each field. Phone, email, guest count, rules and cancellation details are never shown here.',
              )}
            </p>
          </ModuleActionForm>
          <ModuleActionForm
            action={depositPolicyAction}
            input={(form) => ({
              policy: form.get('depositPolicy'),
            })}
            submitLabel={t('Save deposit confirmation policy')}
          >
            <SelectInput
              id={`${id}-deposit-policy`}
              name="depositPolicy"
              label={t('Booking confirmation when a deposit is configured')}
              defaultValue={depositPolicy}
              options={[
                {
                  value: 'per_amenity',
                  label: t('Use each amenity prepayment setting'),
                },
                {
                  value: 'immediate',
                  label: t(
                    'Confirm immediately and keep the deposit outstanding',
                  ),
                },
              ]}
            />
          </ModuleActionForm>
        </>
      ) : null}
    </div>
  );
}
