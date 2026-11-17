// Show society directory records to administrators and read-only committee members.
'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import * as defaultActions from '../../app/directory/actions';
import type { ServerActionResult } from '../../core/actions/server-action';
import type {
  DirectoryEmergencyContact,
  DirectoryPage,
  DirectoryResident,
  DirectoryVehicle,
} from '../../core/directory/validation';
import { Button } from '../ui/button';
import { Card } from '../ui/data-display';
import { EmptyState, ErrorPanel } from '../ui/feedback';
import { SelectInput } from '../ui/select-input';
import { TextInput } from '../ui/text-input';
import { Pagination, type PageSize } from '../ui/table-controls';
import { useUiTranslator } from '../ui/language';
import { DIRECTORY_LABELS } from './labels';

type SocietyUnit = { id: string; number: string };
type ReadRetry = { pageSize: PageSize } & (
  | {
      kind: 'residents';
      input: { search: string; limit: number; offset: number };
    }
  | { kind: 'vehicles'; input: { limit: number; offset: number } }
  | {
      kind: 'contacts';
      unitId: string;
      input: { limit: number; offset: number };
    }
);
type MutationAction = (
  formData: FormData,
) => Promise<ServerActionResult<unknown>>;
export type DirectoryManagementActions = Pick<
  typeof defaultActions,
  | 'deactivateDirectoryEmergencyContactAction'
  | 'deactivateDirectoryVehicleAction'
  | 'getDirectoryEmergencyContactsPageAction'
  | 'getDirectoryResidentsPageAction'
  | 'getDirectoryVehiclesPageAction'
  | 'saveDirectoryEmergencyContactAction'
  | 'saveDirectoryVehicleAction'
  | 'verifyDirectoryVehicleAction'
>;

function useMutation(action: MutationAction) {
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const request = useRef<{ fingerprint: string; id: string } | null>(null);

  function submit(
    event: FormEvent<HTMLFormElement>,
    requestId = false,
    transform?: (data: FormData) => void,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    transform?.(formData);
    if (requestId) {
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
        router.refresh();
      }
    });
  }
  return { pending, result, submit };
}

function Message({ result }: { result: ServerActionResult<unknown> | null }) {
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

function targetOptions(
  members: readonly DirectoryResident[],
  t: (source: string) => string,
) {
  return members
    .filter((member) => member.unit_id !== null)
    .map((member) => ({
      label: `${member.full_name || t('Resident')} · ${member.unit_number ?? t('Unit')}`,
      value: `${member.unit_id}|${member.membership_id}`,
    }));
}

function populateTarget(data: FormData) {
  const [unitId, membershipId] = String(data.get('target') ?? '').split('|');
  data.delete('target');
  data.set('unitId', unitId ?? '');
  data.set('membershipId', membershipId ?? '');
}

function AdminVehicleForm({
  action,
  members,
  vehicle,
}: {
  action: MutationAction;
  members: readonly DirectoryResident[];
  vehicle?: DirectoryVehicle;
}) {
  const { translate: t } = useUiTranslator();
  const { pending, result, submit } = useMutation(action);
  return (
    <form
      className="grid gap-space-3 rounded-md border border-rule p-space-4"
      onSubmit={(event) =>
        submit(event, true, (data) => {
          if (vehicle) {
            data.set('vehicleId', vehicle.id);
            data.set('unitId', vehicle.unit_id);
            data.set('membershipId', vehicle.membership_id);
          } else {
            populateTarget(data);
          }
        })
      }
    >
      {vehicle ? null : (
        <SelectInput
          id="admin-vehicle-target"
          label={t('Resident and unit')}
          name="target"
          options={targetOptions(members, t)}
          placeholder={t('Choose an active occupant')}
          required
        />
      )}
      <SelectInput
        defaultValue={vehicle?.vehicle_type ?? 'car'}
        id={`admin-vehicle-type-${vehicle?.id ?? 'new'}`}
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
        id={`admin-vehicle-registration-${vehicle?.id ?? 'new'}`}
        label={t('Registration number')}
        maxLength={32}
        name="registrationNumber"
        required
      />
      <TextInput
        defaultValue={vehicle?.tag_number ?? ''}
        id={`admin-vehicle-tag-${vehicle?.id ?? 'new'}`}
        label={t('Parking tag (optional)')}
        maxLength={40}
        name="tagNumber"
      />
      <Button disabled={pending} loading={pending} type="submit">
        {t(vehicle ? 'Save vehicle' : 'Add vehicle')}
      </Button>
      <Message result={result} />
    </form>
  );
}

function AdminContactForm({
  action,
  members,
  contact,
}: {
  action: MutationAction;
  members: readonly DirectoryResident[];
  contact?: DirectoryEmergencyContact;
}) {
  const { translate: t } = useUiTranslator();
  const { pending, result, submit } = useMutation(action);
  return (
    <form
      className="grid gap-space-3 rounded-md border border-rule p-space-4"
      onSubmit={(event) =>
        submit(event, true, (data) => {
          if (contact) {
            data.set('unitId', contact.unit_id);
            data.set('membershipId', contact.membership_id);
            data.set('contactId', contact.id);
          } else {
            populateTarget(data);
          }
        })
      }
    >
      {contact ? null : (
        <SelectInput
          id="admin-contact-target"
          label={t('Resident and unit')}
          name="target"
          options={targetOptions(members, t)}
          placeholder={t('Choose an active occupant')}
          required
        />
      )}
      <TextInput
        defaultValue={contact?.full_name}
        id={`admin-contact-name-${contact?.id ?? 'new'}`}
        label={t('Contact name')}
        maxLength={120}
        name="fullName"
        required
      />
      <TextInput
        defaultValue={contact?.relationship}
        id={`admin-contact-relationship-${contact?.id ?? 'new'}`}
        label={t('Relationship')}
        maxLength={80}
        name="relationship"
        required
      />
      <TextInput
        autoComplete="tel"
        defaultValue={contact?.phone}
        id={`admin-contact-phone-${contact?.id ?? 'new'}`}
        label={t('Phone number')}
        name="phone"
        required
        type="tel"
      />
      <Button disabled={pending} loading={pending} type="submit">
        {t(contact ? 'Save contact' : 'Add emergency contact')}
      </Button>
      <Message result={result} />
    </form>
  );
}

export function DirectoryManagementWorkspace({
  actions = defaultActions,
  canManage,
  contacts,
  residents,
  units,
  vehicles,
}: {
  actions?: DirectoryManagementActions;
  canManage: boolean;
  contacts: DirectoryPage<DirectoryEmergencyContact>;
  residents: DirectoryPage<DirectoryResident>;
  units: readonly SocietyUnit[];
  vehicles: DirectoryPage<DirectoryVehicle>;
}) {
  const { locale, translate: t, translateFeedback } = useUiTranslator();
  const [residentPage, setResidentPage] = useState(residents);
  const [residentSearch, setResidentSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [residentPageSize, setResidentPageSize] = useState<PageSize>(10);
  const [vehiclePage, setVehiclePage] = useState(vehicles);
  const [vehiclePageSize, setVehiclePageSize] = useState<PageSize>(10);
  const [contactPage, setContactPage] = useState(contacts);
  const [contactPageSize, setContactPageSize] = useState<PageSize>(10);
  const [contactUnitId, setContactUnitId] = useState(units[0]?.id ?? '');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [retryRead, setRetryRead] = useState<ReadRetry | null>(null);
  const members = residentPage.items;
  const contactUnits = [
    ...new Map([
      ...units.map((unit) => [unit.id, unit] as const),
      ...members.flatMap((resident) =>
        resident.unit_id && resident.unit_number
          ? [
              [
                resident.unit_id,
                { id: resident.unit_id, number: resident.unit_number },
              ] as const,
            ]
          : [],
      ),
    ]).values(),
  ];

  function loadResidents(
    input: { search: string; limit: number; offset: number },
    pageSize: PageSize,
  ) {
    setRetryRead({ kind: 'residents', input, pageSize });
    startTransition(async () => {
      const result = await actions.getDirectoryResidentsPageAction(input);
      if (!result.ok || !result.data) {
        setLoadError(
          result.ok
            ? 'The directory returned an invalid response.'
            : result.message,
        );
        setResidentPage({ items: [], total: 0, limit: pageSize, offset: 0 });
        return;
      }
      setLoadError(null);
      setResidentPage(result.data);
    });
  }

  function loadVehicles(
    input: { limit: number; offset: number },
    pageSize: PageSize,
  ) {
    setRetryRead({ kind: 'vehicles', input, pageSize });
    startTransition(async () => {
      const result = await actions.getDirectoryVehiclesPageAction(input);
      if (!result.ok || !result.data) {
        setLoadError(
          result.ok
            ? 'The directory returned an invalid response.'
            : result.message,
        );
        setVehiclePage({ items: [], total: 0, limit: pageSize, offset: 0 });
        return;
      }
      setLoadError(null);
      setVehiclePage(result.data);
    });
  }

  function loadContacts(
    unitId: string,
    input: { limit: number; offset: number },
    pageSize: PageSize,
  ) {
    setRetryRead({ kind: 'contacts', unitId, input, pageSize });
    startTransition(async () => {
      const result = await actions.getDirectoryEmergencyContactsPageAction({
        unitId,
        page: input,
      });
      if (!result.ok || !result.data) {
        setLoadError(
          result.ok
            ? 'The directory returned an invalid response.'
            : result.message,
        );
        setContactPage({ items: [], total: 0, limit: pageSize, offset: 0 });
        return;
      }
      setLoadError(null);
      setContactPage(result.data);
      setContactPageSize(pageSize);
    });
  }

  const residentPageNumber =
    Math.floor(residentPage.offset / residentPageSize) + 1;
  const vehiclePageNumber =
    Math.floor(vehiclePage.offset / vehiclePageSize) + 1;
  const contactPageNumber =
    Math.floor(contactPage.offset / contactPageSize) + 1;

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">
          {t('Resident & vehicle directory')}
        </h1>
        <p className="text-body text-ink-muted">
          {t(
            'Review active residents, vehicle registrations and household emergency contacts. Committee members have read-only access.',
          )}
        </p>
      </header>
      <fieldset
        aria-label={t('Directory management controls')}
        className="grid min-w-0 gap-space-5"
        disabled={pending}
      >
        {loadError ? (
          <>
            <ErrorPanel
              message={translateFeedback(loadError)}
              title={t('Could not load directory data')}
            />
            {retryRead ? (
              <Button
                onClick={() => {
                  if (retryRead.kind === 'residents')
                    loadResidents(retryRead.input, retryRead.pageSize);
                  else if (retryRead.kind === 'vehicles')
                    loadVehicles(retryRead.input, retryRead.pageSize);
                  else
                    loadContacts(
                      retryRead.unitId,
                      retryRead.input,
                      retryRead.pageSize,
                    );
                }}
                variant="secondary"
              >
                {t('Retry directory read')}
              </Button>
            ) : null}
          </>
        ) : null}
        <Card title={t('Residents')}>
          <p className="text-caption text-ink-muted">
            {t(
              'Search and page through residents to choose a household for the forms below.',
            )}
          </p>
          <form
            className="flex flex-col items-end gap-space-3 medium:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const search = searchInput.trim();
              setResidentSearch(search);
              loadResidents(
                { search, limit: residentPageSize, offset: 0 },
                residentPageSize,
              );
            }}
          >
            <TextInput
              id="admin-directory-search"
              label={t('Search residents by name or unit')}
              onChange={(event) => setSearchInput(event.currentTarget.value)}
              value={searchInput}
            />
            <Button disabled={pending} loading={pending} type="submit">
              {t('Search')}
            </Button>
          </form>
          {residentPage.items.length ? (
            <ul className="grid gap-space-3">
              {residentPage.items.map((resident, index) => (
                <li
                  className="grid gap-space-1 rounded-md border border-rule p-space-4"
                  key={`${resident.membership_id}-${index}`}
                >
                  <p className="text-body-strong">
                    {resident.full_name || t('Resident')}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {resident.unit_number ?? t('Unit not shared')}
                    {resident.phone ? ` · ${resident.phone}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : loadError ? null : (
            <EmptyState
              description={t('Try another name or unit number.')}
              title={t('No residents found')}
            />
          )}
          {residentPage.total > 10 ? (
            <Pagination
              onPageChange={(page) =>
                loadResidents(
                  {
                    search: residentSearch,
                    limit: residentPageSize,
                    offset: (page - 1) * residentPageSize,
                  },
                  residentPageSize,
                )
              }
              onPageSizeChange={(size) => {
                setResidentPageSize(size);
                loadResidents(
                  { search: residentSearch, limit: size, offset: 0 },
                  size,
                );
              }}
              page={residentPageNumber}
              pageSize={residentPageSize}
              total={residentPage.total}
            />
          ) : null}
        </Card>

        <Card title={t('Vehicles')}>
          {vehiclePage.items.length ? (
            <ul className="grid gap-space-3">
              {vehiclePage.items.map((vehicle) => {
                const occupant = members.find(
                  (member) =>
                    member.membership_id === vehicle.membership_id &&
                    member.unit_id === vehicle.unit_id,
                );
                return (
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
                      {occupant?.full_name ||
                        t('Resident outside current results')}{' '}
                      ·{' '}
                      {occupant?.unit_number ??
                        t('Unit outside current results')}{' '}
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
                    {canManage && vehicle.status === 'active' ? (
                      <div className="flex flex-wrap gap-space-3">
                        <details className="w-full">
                          <summary className="min-h-12 cursor-pointer content-center text-brand underline underline-offset-4">
                            {t('Edit vehicle')}
                          </summary>
                          <AdminVehicleForm
                            action={actions.saveDirectoryVehicleAction}
                            members={members}
                            vehicle={vehicle}
                          />
                        </details>
                        <form
                          onSubmit={(event) => {
                            const formData = new FormData(event.currentTarget);
                            event.preventDefault();
                            startTransition(async () => {
                              const result =
                                await actions.verifyDirectoryVehicleAction(
                                  formData,
                                );
                              if (!result.ok) {
                                setLoadError(result.message);
                              } else {
                                setLoadError(null);
                                router.refresh();
                              }
                            });
                          }}
                        >
                          <input
                            name="vehicleId"
                            type="hidden"
                            value={vehicle.id}
                          />
                          <input
                            name="isVerified"
                            type="hidden"
                            value={vehicle.is_verified ? '' : 'on'}
                          />
                          <Button
                            disabled={pending}
                            type="submit"
                            variant="secondary"
                          >
                            {t(
                              vehicle.is_verified
                                ? 'Revoke verification'
                                : 'Verify vehicle',
                            )}
                          </Button>
                        </form>
                        <DeactivateVehicleForm
                          action={actions.deactivateDirectoryVehicleAction}
                          vehicleId={vehicle.id}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              description={t(
                'Vehicle records will appear here when residents register them.',
              )}
              title={t('No vehicles registered')}
            />
          )}
          {vehiclePage.total > 10 ? (
            <Pagination
              onPageChange={(page) =>
                loadVehicles(
                  {
                    limit: vehiclePageSize,
                    offset: (page - 1) * vehiclePageSize,
                  },
                  vehiclePageSize,
                )
              }
              onPageSizeChange={(size) => {
                setVehiclePageSize(size);
                loadVehicles({ limit: size, offset: 0 }, size);
              }}
              page={vehiclePageNumber}
              pageSize={vehiclePageSize}
              total={vehiclePage.total}
            />
          ) : null}
          {canManage ? (
            <details className="mt-space-4">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline underline-offset-4">
                {t('Add a vehicle for an active resident')}
              </summary>
              <div className="mt-space-3">
                <AdminVehicleForm
                  action={actions.saveDirectoryVehicleAction}
                  members={members}
                />
              </div>
            </details>
          ) : null}
        </Card>

        <Card title={t('Emergency contacts')}>
          {contactUnits.length ? (
            <SelectInput
              id="admin-contact-unit"
              label={t('Unit')}
              onChange={(event) => {
                const unitId = event.currentTarget.value;
                setContactUnitId(unitId);
                loadContacts(
                  unitId,
                  { limit: contactPageSize, offset: 0 },
                  contactPageSize,
                );
              }}
              options={contactUnits.map(({ id, number }) => ({
                label: number,
                value: id,
              }))}
              value={contactUnitId}
            />
          ) : (
            <p className="text-body text-ink-muted">
              {t('Add an active unit before managing emergency contacts.')}
            </p>
          )}
          {contactPage.items.length ? (
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
                  {canManage ? (
                    <>
                      <details>
                        <summary className="min-h-12 cursor-pointer content-center text-brand underline underline-offset-4">
                          {t('Edit contact')}
                        </summary>
                        <div className="mt-space-3">
                          <AdminContactForm
                            action={actions.saveDirectoryEmergencyContactAction}
                            contact={contact}
                            members={members}
                          />
                        </div>
                      </details>
                      <DeactivateContactForm
                        action={
                          actions.deactivateDirectoryEmergencyContactAction
                        }
                        contactId={contact.id}
                      />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description={t(
                'Emergency contacts for the selected unit will appear here.',
              )}
              title={t('No emergency contacts')}
            />
          )}
          {contactPage.total > 10 ? (
            <Pagination
              onPageChange={(page) =>
                loadContacts(
                  contactUnitId,
                  {
                    limit: contactPageSize,
                    offset: (page - 1) * contactPageSize,
                  },
                  contactPageSize,
                )
              }
              onPageSizeChange={(size) => {
                setContactPageSize(size);
                loadContacts(contactUnitId, { limit: size, offset: 0 }, size);
              }}
              page={contactPageNumber}
              pageSize={contactPageSize}
              total={contactPage.total}
            />
          ) : null}
          {canManage && contactUnitId ? (
            <details className="mt-space-4">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline underline-offset-4">
                {t('Add an emergency contact')}
              </summary>
              <div className="mt-space-3">
                <AdminContactForm
                  action={actions.saveDirectoryEmergencyContactAction}
                  members={members}
                />
              </div>
            </details>
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
  action: MutationAction;
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
      <Message result={result} />
    </form>
  );
}

function DeactivateContactForm({
  action,
  contactId,
}: {
  action: MutationAction;
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
      <Message result={result} />
    </form>
  );
}
