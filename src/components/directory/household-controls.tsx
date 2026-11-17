// Let residents manage their own directory visibility, vehicles and contacts.
'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import * as defaultActions from '../../app/directory/actions';
import type { ServerActionResult } from '../../core/actions/server-action';
import type {
  DirectoryEmergencyContact,
  DirectoryHousehold,
  DirectoryPage,
  DirectoryVehicle,
  DirectoryVisibility,
} from '../../core/directory/validation';
import { Button } from '../ui/button';
import { Card } from '../ui/data-display';
import { EmptyState, ErrorPanel } from '../ui/feedback';
import { SelectInput } from '../ui/select-input';
import { TextInput } from '../ui/text-input';
import { Pagination, type PageSize } from '../ui/table-controls';
import { useUiTranslator } from '../ui/language';
import { DIRECTORY_LABELS } from './labels';

type Mutation = (formData: FormData) => Promise<ServerActionResult<unknown>>;
export type HouseholdDirectoryActions = Pick<
  typeof defaultActions,
  | 'deactivateDirectoryEmergencyContactAction'
  | 'deactivateDirectoryVehicleAction'
  | 'getDirectoryEmergencyContactsPageAction'
  | 'getDirectoryVehiclesPageAction'
  | 'saveDirectoryEmergencyContactAction'
  | 'saveDirectoryVehicleAction'
  | 'setDirectoryVisibilityAction'
>;

function useMutation(action: Mutation, resetOnSuccess = false) {
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const request = useRef<{ fingerprint: string; id: string } | null>(null);

  function submit(
    event: FormEvent<HTMLFormElement>,
    options: {
      requestId?: boolean;
      transform?: (formData: FormData) => void;
    } = {},
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    options.transform?.(formData);
    if (options.requestId) {
      const fingerprint = JSON.stringify([...formData.entries()]);
      if (request.current?.fingerprint !== fingerprint) {
        request.current = { fingerprint, id: crypto.randomUUID() };
      }
      formData.set('clientRequestId', request.current.id);
    }
    startTransition(async () => {
      const nextResult = await action(formData);
      setResult(nextResult);
      if (nextResult.ok) {
        request.current = null;
        if (resetOnSuccess) form.reset();
        router.refresh();
      }
    });
  }

  return { pending, result, submit };
}

function ActionMessage({
  result,
}: {
  result: ServerActionResult<unknown> | null;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (!result) return null;
  return (
    <p
      aria-live="polite"
      className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
      role="status"
    >
      {result.message ? translateFeedback(result.message) : null}
      {!result.ok && result.fieldErrors
        ? ` ${Object.values(result.fieldErrors).map(translateFeedback).join(' ')}`
        : ''}
      {!result.ok && result.referenceId
        ? ` ${t('Reference: {reference}', { reference: result.referenceId })}`
        : ''}
    </p>
  );
}

function householdOptions(households: readonly DirectoryHousehold[]) {
  return households.map((household) => ({
    label: household.unit_number,
    value: `${household.unit_id}|${household.membership_id}`,
  }));
}

function populateTarget(formData: FormData) {
  const target = String(formData.get('target') ?? '');
  const [unitId, membershipId] = target.split('|');
  formData.delete('target');
  formData.set('unitId', unitId ?? '');
  formData.set('membershipId', membershipId ?? '');
  return formData;
}

function VehicleForm({
  action = defaultActions.saveDirectoryVehicleAction,
  households,
  vehicle,
}: {
  action?: Mutation;
  households: readonly DirectoryHousehold[];
  vehicle?: DirectoryVehicle;
}) {
  const { translate: t } = useUiTranslator();
  const { pending, result, submit } = useMutation(action, !vehicle);
  const options = householdOptions(households);
  return (
    <form
      className="grid gap-space-3 rounded-md border border-rule p-space-4"
      onSubmit={(event) => {
        submit(event, {
          requestId: true,
          transform: (formData) => {
            if (!vehicle) populateTarget(formData);
          },
        });
      }}
    >
      {vehicle ? (
        <>
          <input name="vehicleId" type="hidden" value={vehicle.id} />
          <input name="unitId" type="hidden" value={vehicle.unit_id} />
          <input
            name="membershipId"
            type="hidden"
            value={vehicle.membership_id}
          />
        </>
      ) : (
        <SelectInput
          id="vehicle-target"
          label={t('Household unit')}
          name="target"
          options={options}
          placeholder={t('Choose a unit')}
          required
        />
      )}
      <SelectInput
        defaultValue={vehicle?.vehicle_type ?? 'car'}
        id={`vehicle-type-${vehicle?.id ?? 'new'}`}
        label={t('Vehicle type')}
        name="vehicleType"
        options={[
          { label: t('Car'), value: 'car' },
          { label: t('Two-wheeler'), value: 'two_wheeler' },
          { label: t('Other'), value: 'other' },
        ]}
        required
      />
      <TextInput
        autoComplete="off"
        defaultValue={vehicle?.registration_number}
        id={`vehicle-registration-${vehicle?.id ?? 'new'}`}
        label={t('Registration number')}
        maxLength={32}
        name="registrationNumber"
        required
      />
      <TextInput
        defaultValue={vehicle?.tag_number ?? ''}
        id={`vehicle-tag-${vehicle?.id ?? 'new'}`}
        label={t('Parking tag (optional)')}
        maxLength={40}
        name="tagNumber"
      />
      <Button disabled={pending} loading={pending} type="submit">
        {t(vehicle ? 'Save vehicle' : 'Add vehicle')}
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}

function ContactForm({
  action = defaultActions.saveDirectoryEmergencyContactAction,
  household,
  contact,
}: {
  action?: Mutation;
  household: DirectoryHousehold;
  contact?: DirectoryEmergencyContact;
}) {
  const { translate: t } = useUiTranslator();
  const { pending, result, submit } = useMutation(action, !contact);
  return (
    <form
      className="grid gap-space-3 rounded-md border border-rule p-space-4"
      onSubmit={(event) => {
        submit(event, {
          requestId: true,
          transform: (formData) => {
            formData.set('unitId', household.unit_id);
            formData.set('membershipId', household.membership_id);
            formData.set('contactId', contact?.id ?? '');
          },
        });
      }}
    >
      <TextInput
        defaultValue={contact?.full_name}
        id={`contact-name-${contact?.id ?? household.unit_id}`}
        label={t('Contact name')}
        maxLength={120}
        name="fullName"
        required
      />
      <TextInput
        defaultValue={contact?.relationship}
        id={`contact-relationship-${contact?.id ?? household.unit_id}`}
        label={t('Relationship')}
        maxLength={80}
        name="relationship"
        required
      />
      <TextInput
        autoComplete="tel"
        defaultValue={contact?.phone}
        id={`contact-phone-${contact?.id ?? household.unit_id}`}
        label={t('Phone number')}
        name="phone"
        required
        type="tel"
      />
      <Button disabled={pending} loading={pending} type="submit">
        {t(contact ? 'Save contact' : 'Add emergency contact')}
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}

export function HouseholdDirectoryControls({
  actions = defaultActions,
  contacts,
  households,
  preferences,
  vehicles,
}: {
  actions?: HouseholdDirectoryActions;
  contacts: readonly {
    unitId: string;
    page: DirectoryPage<DirectoryEmergencyContact>;
  }[];
  households: readonly DirectoryHousehold[];
  preferences: DirectoryVisibility;
  vehicles: DirectoryPage<DirectoryVehicle>;
}) {
  const { locale, translate: t, translateFeedback } = useUiTranslator();
  const visibility = useMutation(actions.setDirectoryVisibilityAction);
  const [vehiclePage, setVehiclePage] = useState(vehicles);
  const [vehiclePageSize, setVehiclePageSize] = useState<PageSize>(10);
  const [vehicleFailure, setVehicleFailure] = useState<string | null>(null);
  const [contactUnitId, setContactUnitId] = useState(
    households[0]?.unit_id ?? '',
  );
  const [contactPage, setContactPage] = useState(
    contacts.find(({ unitId }) => unitId === (households[0]?.unit_id ?? ''))
      ?.page ?? { items: [], total: 0, limit: 10, offset: 0 },
  );
  const [contactPageSize, setContactPageSize] = useState<PageSize>(10);
  const [contactFailure, setContactFailure] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadVehicles(page: number, pageSize = vehiclePageSize) {
    startTransition(async () => {
      const result = await actions.getDirectoryVehiclesPageAction({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      if (!result.ok || !result.data) {
        setVehiclePage({ items: [], total: 0, limit: pageSize, offset: 0 });
        setVehicleFailure(
          result.ok
            ? 'The vehicle list returned an invalid response.'
            : result.message,
        );
        return;
      }
      setVehicleFailure(null);
      setVehiclePage(result.data);
    });
  }

  function loadContacts(unitId: string, page: number, pageSize: PageSize = 10) {
    startTransition(async () => {
      const result = await actions.getDirectoryEmergencyContactsPageAction({
        unitId,
        page: { limit: pageSize, offset: (page - 1) * pageSize },
      });
      if (!result.ok || !result.data) {
        setContactPage({ items: [], total: 0, limit: pageSize, offset: 0 });
        setContactFailure(
          result.ok
            ? 'The contact list returned an invalid response.'
            : result.message,
        );
        return;
      }
      setContactFailure(null);
      setContactPage(result.data);
      setContactPageSize(pageSize);
    });
  }

  const contactHousehold = households.find(
    ({ unit_id }) => unit_id === contactUnitId,
  );
  const vehicleCurrentPage =
    Math.floor(vehiclePage.offset / vehiclePageSize) + 1;
  const contactCurrentPage =
    Math.floor(contactPage.offset / contactPageSize) + 1;

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h2 className="text-title font-semibold">
          {t('Your directory details')}
        </h2>
        <p className="text-body text-ink-muted">
          {t(
            'Control what neighbours can see and maintain the vehicles and emergency contacts for your active household units.',
          )}
        </p>
      </header>
      <fieldset
        aria-label={t('Household directory controls')}
        className="grid min-w-0 gap-space-5"
        disabled={isPending}
      >
        <Card title={t('Visibility preferences')}>
          <form
            className="grid gap-space-3"
            onSubmit={(event) => visibility.submit(event)}
          >
            <label className="inline-flex min-h-12 items-center gap-space-2">
              <input
                defaultChecked={preferences.name_visible}
                name="nameVisible"
                type="checkbox"
              />
              {t('Show my name to residents')}
            </label>
            <label className="inline-flex min-h-12 items-center gap-space-2">
              <input
                defaultChecked={preferences.unit_visible}
                name="unitVisible"
                type="checkbox"
              />
              {t('Show my unit to residents')}
            </label>
            <label className="inline-flex min-h-12 items-center gap-space-2">
              <input
                defaultChecked={preferences.phone_visible}
                name="phoneVisible"
                type="checkbox"
              />
              {t('Share my phone number with residents')}
            </label>
            <p className="text-caption text-ink-muted">
              {t(
                'Society administrators and committee members can view verified profile phone numbers regardless of this preference.',
              )}
            </p>
            <Button
              disabled={visibility.pending}
              loading={visibility.pending}
              type="submit"
            >
              {t('Save visibility')}
            </Button>
            <ActionMessage result={visibility.result} />
          </form>
        </Card>

        <Card title={t('Vehicles')}>
          {vehicleFailure ? (
            <>
              <ErrorPanel
                message={translateFeedback(vehicleFailure)}
                title={t('Could not load vehicles')}
              />
              <Button onClick={() => loadVehicles(1)} variant="secondary">
                {t('Retry loading vehicles')}
              </Button>
            </>
          ) : null}
          {vehiclePage.items.length ? (
            <ul className="grid gap-space-3">
              {vehiclePage.items.map((vehicle) => (
                <li
                  className="grid gap-space-3 rounded-md border border-rule p-space-4"
                  key={vehicle.id}
                >
                  <p className="text-body-strong">
                    {vehicle.registration_number} ·{' '}
                    {locale === 'hi'
                      ? t(
                          DIRECTORY_LABELS[vehicle.vehicle_type] ??
                            vehicle.vehicle_type,
                        )
                      : vehicle.vehicle_type}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {households.find(
                      ({ unit_id }) => unit_id === vehicle.unit_id,
                    )?.unit_number ?? t('Unit')}{' '}
                    ·{' '}
                    {locale === 'hi'
                      ? t(DIRECTORY_LABELS[vehicle.status] ?? vehicle.status)
                      : vehicle.status}
                    {vehicle.status === 'active'
                      ? vehicle.is_verified
                        ? t(' · verified')
                        : t(' · awaiting verification')
                      : ''}
                  </p>
                  {vehicle.status === 'active' &&
                  households.some(
                    ({ membership_id, unit_id }) =>
                      membership_id === vehicle.membership_id &&
                      unit_id === vehicle.unit_id,
                  ) ? (
                    <div className="grid gap-space-3">
                      <details>
                        <summary className="min-h-12 cursor-pointer content-center text-brand underline underline-offset-4">
                          {t('Edit vehicle')}
                        </summary>
                        <div className="mt-space-3">
                          <VehicleForm
                            action={actions.saveDirectoryVehicleAction}
                            households={households}
                            vehicle={vehicle}
                          />
                        </div>
                      </details>
                      <DeactivateVehicleForm
                        action={actions.deactivateDirectoryVehicleAction}
                        vehicleId={vehicle.id}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : vehicleFailure ? null : (
            <EmptyState
              description={t(
                'Add a vehicle so your household records stay current.',
              )}
              title={t('No vehicles registered')}
            />
          )}
          {vehiclePage.total > 10 ? (
            <Pagination
              onPageChange={(page) => loadVehicles(page)}
              onPageSizeChange={(size) => {
                setVehiclePageSize(size);
                loadVehicles(1, size);
              }}
              page={vehicleCurrentPage}
              pageSize={vehiclePageSize}
              total={vehiclePage.total}
            />
          ) : null}
          {households.length ? (
            <VehicleForm
              action={actions.saveDirectoryVehicleAction}
              households={households}
            />
          ) : null}
        </Card>

        <Card title={t('Emergency contacts')}>
          {households.length ? (
            <SelectInput
              id="contact-unit"
              label={t('Household unit')}
              onChange={(event) => {
                const nextUnitId = event.currentTarget.value;
                setContactUnitId(nextUnitId);
                loadContacts(nextUnitId, 1, contactPageSize);
              }}
              options={households.map(({ unit_id, unit_number }) => ({
                label: unit_number,
                value: unit_id,
              }))}
              value={contactUnitId}
            />
          ) : null}
          {contactFailure ? (
            <>
              <ErrorPanel
                message={translateFeedback(contactFailure)}
                title={t('Could not load emergency contacts')}
              />
              <Button
                onClick={() => loadContacts(contactUnitId, 1, contactPageSize)}
                variant="secondary"
              >
                {t('Retry loading contacts')}
              </Button>
            </>
          ) : contactPage.items.length ? (
            <ul className="grid gap-space-3">
              {contactPage.items.map((contact) => (
                <li
                  className="grid gap-space-3 rounded-md border border-rule p-space-4"
                  key={contact.id}
                >
                  <p className="text-body-strong">{contact.full_name}</p>
                  <p className="text-caption text-ink-muted">
                    {contact.relationship} · {contact.phone}
                  </p>
                  {contactHousehold?.membership_id === contact.membership_id ? (
                    <details>
                      <summary className="min-h-12 cursor-pointer content-center text-brand underline underline-offset-4">
                        {t('Edit contact')}
                      </summary>
                      <div className="mt-space-3">
                        <ContactForm
                          action={actions.saveDirectoryEmergencyContactAction}
                          contact={contact}
                          household={contactHousehold}
                        />
                      </div>
                    </details>
                  ) : null}
                  {contactHousehold?.membership_id === contact.membership_id ? (
                    <DeactivateContactForm
                      action={actions.deactivateDirectoryEmergencyContactAction}
                      contactId={contact.id}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : contactFailure ? null : (
            <EmptyState
              description={t(
                'Emergency contacts are available only to members of your active household, administrators and committee.',
              )}
              title={t('No emergency contacts')}
            />
          )}
          {contactPage.total > 10 ? (
            <Pagination
              onPageChange={(page) =>
                loadContacts(contactUnitId, page, contactPageSize)
              }
              onPageSizeChange={(size) => {
                setContactPageSize(size);
                loadContacts(contactUnitId, 1, size);
              }}
              page={contactCurrentPage}
              pageSize={contactPageSize}
              total={contactPage.total}
            />
          ) : null}
          {contactHousehold ? (
            <ContactForm
              action={actions.saveDirectoryEmergencyContactAction}
              household={contactHousehold}
            />
          ) : null}
          {isPending ? (
            <p aria-live="polite" className="text-caption text-ink-muted">
              {t('Loading directory records…')}
            </p>
          ) : null}
        </Card>
      </fieldset>
    </section>
  );
}

function DeactivateVehicleForm({
  action,
  vehicleId,
}: {
  action: Mutation;
  vehicleId: string;
}) {
  const { translate: t } = useUiTranslator();
  const { pending, result, submit } = useMutation(action);
  return (
    <form className="grid gap-space-2" onSubmit={(event) => submit(event)}>
      <input name="vehicleId" type="hidden" value={vehicleId} />
      <Button
        disabled={pending}
        loading={pending}
        type="submit"
        variant="destructive"
      >
        {t('Deactivate vehicle')}
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}

function DeactivateContactForm({
  action,
  contactId,
}: {
  action: Mutation;
  contactId: string;
}) {
  const { translate: t } = useUiTranslator();
  const { pending, result, submit } = useMutation(action);
  return (
    <form className="grid gap-space-2" onSubmit={(event) => submit(event)}>
      <input name="contactId" type="hidden" value={contactId} />
      <Button
        disabled={pending}
        loading={pending}
        type="submit"
        variant="destructive"
      >
        {t('Deactivate contact')}
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}
