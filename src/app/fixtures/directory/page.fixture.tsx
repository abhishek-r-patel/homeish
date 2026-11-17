// Exercise the read-only directory using synthetic, already privacy-filtered rows.
'use client';

import { useState } from 'react';
import { ResidentDirectory } from '@/components/directory/resident-directory';
import {
  HouseholdDirectoryControls,
  type HouseholdDirectoryActions,
} from '@/components/directory/household-controls';
import {
  DirectoryManagementWorkspace,
  type DirectoryManagementActions,
} from '@/components/directory/management-workspace';
import { GuardVehicleLookup } from '@/components/directory/guard-vehicle-lookup';
import { SelectInput } from '@/components/ui/select-input';
import type {
  DirectoryEmergencyContact,
  DirectoryPage,
  DirectoryResident,
  DirectoryVehicle,
} from '@/core/directory/validation';
import {
  directoryEmergencyContactInputSchema,
  directoryPageInputSchema,
  directoryVehicleInputSchema,
} from '@/core/directory/validation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { LanguageProvider } from '@/components/language-provider';
import { LanguageSelector } from '@/components/language-selector';

const residents: DirectoryResident[] = [
  {
    membership_id: 'a0d55fc3-0751-4b79-86c1-5b3e25942392',
    unit_id: 'a0d55fc3-0751-4b79-86c1-5b3e25942393',
    full_name: 'Resident Alpha',
    unit_number: 'A-101',
    phone: null,
  },
  {
    membership_id: 'b0d55fc3-0751-4b79-86c1-5b3e25942392',
    unit_id: 'b0d55fc3-0751-4b79-86c1-5b3e25942393',
    full_name: 'Resident Bravo',
    unit_number: 'B-204',
    phone: '+12025550123',
  },
  {
    membership_id: 'c0d55fc3-0751-4b79-86c1-5b3e25942392',
    unit_id: null,
    full_name: 'Resident Charlie With A Longer Display Name',
    unit_number: null,
    phone: null,
  },
];

const largerResidents: DirectoryResident[] = [
  ...residents,
  ...Array.from({ length: 40 }, (_, index) => ({
    membership_id: `d0d55fc3-0751-4b79-86c1-${String(index + 1).padStart(12, '0')}`,
    unit_id: `d0d55fc3-0751-4b79-86c2-${String(index + 1).padStart(12, '0')}`,
    full_name: `Sample Resident ${String(index + 1).padStart(2, '0')}`,
    unit_number: `C-${String(index + 1).padStart(3, '0')}`,
    phone: null,
  })),
];

export default function DirectoryFixturePage() {
  return (
    <LanguageProvider initialLocale="en" mode="device">
      <DirectoryFixture />
    </LanguageProvider>
  );
}

function DirectoryFixture() {
  const [useLargerSample, setUseLargerSample] = useState(false);
  const [failReads, setFailReads] = useState(false);
  const sample = useLargerSample ? largerResidents : residents;
  const loadResidents = async ({
    search,
    limit,
    offset,
  }: {
    search: string;
    limit: number;
    offset: number;
  }) => {
    if (failReads)
      return {
        ok: false as const,
        message: 'Synthetic directory read failed.',
        referenceId: 'directory-read-reference',
      };
    const needle = search.toLowerCase();
    const matches = sample.filter(
      (resident) =>
        !needle ||
        resident.full_name?.toLowerCase().includes(needle) ||
        resident.unit_number?.toLowerCase().includes(needle),
    );
    return {
      ok: true as const,
      data: {
        items: matches.slice(offset, offset + limit),
        total: matches.length,
        limit,
        offset,
      },
    };
  };
  const initialPage: DirectoryPage<DirectoryResident> = {
    items: sample.slice(0, 10),
    total: sample.length,
    limit: 10,
    offset: 0,
  };
  return (
    <main className="mx-auto grid min-h-dvh w-full min-w-0 max-w-content-default content-start gap-space-5 px-space-4 py-space-6 text-ink">
      <LanguageSelector />
      <Banner title="Synthetic resident directory" tone="info">
        Development-only sample data. No resident data is read from or written
        to a database.
      </Banner>
      <Button
        className="w-fit"
        onClick={() => setUseLargerSample((current) => !current)}
        variant="secondary"
      >
        {useLargerSample ? 'Use small sample' : 'Use larger sample'}
      </Button>
      <label className="inline-flex min-h-12 items-center gap-space-2">
        <input
          type="checkbox"
          checked={failReads}
          onChange={(event) => setFailReads(event.currentTarget.checked)}
        />
        Simulate directory read failure
      </label>
      <ResidentDirectory
        key={String(useLargerSample)}
        loadResidents={loadResidents}
        residents={initialPage}
      />
      <details>
        <summary className="min-h-12 cursor-pointer content-center">
          Test household and management workflows
        </summary>
        <DirectoryWorkflowFixture />
      </details>
    </main>
  );
}

const memberId = residents[0]!.membership_id;
const unitId = residents[0]!.unit_id!;
const initialVehicle: DirectoryVehicle = {
  id: 'a0d55fc3-0751-4b79-86c1-5b3e25942394',
  membership_id: memberId,
  unit_id: unitId,
  registration_number: 'MH01AB1234',
  vehicle_type: 'car',
  tag_number: null,
  status: 'active',
  is_verified: false,
};
const initialContact: DirectoryEmergencyContact = {
  id: 'a0d55fc3-0751-4b79-86c1-5b3e25942395',
  membership_id: memberId,
  unit_id: unitId,
  full_name: 'Synthetic Emergency Contact',
  relationship: 'Sibling',
  phone: '+12025550124',
};

function directoryPage<T>(items: T[], input: unknown): DirectoryPage<T> {
  const { limit, offset } = directoryPageInputSchema.parse(input);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}

function DirectoryWorkflowFixture() {
  const [role, setRole] = useState('resident');
  const [vehicles, setVehicles] = useState([initialVehicle]);
  const [contacts, setContacts] = useState([
    initialContact,
    {
      ...initialContact,
      id: 'b0d55fc3-0751-4b79-86c1-5b3e25942395',
      membership_id: residents[1]!.membership_id,
      full_name: 'Co-occupant Contact',
    },
  ]);
  const [preferences, setPreferences] = useState({
    name_visible: true,
    unit_visible: true,
    phone_visible: false,
  });
  const [fail, setFail] = useState(false);
  const [lastRequest, setLastRequest] = useState('');
  const failure = {
    ok: false as const,
    code: 'INTERNAL_ERROR' as const,
    message: 'Synthetic action failed. Try again.',
    referenceId: 'directory-fixture-reference',
  };
  const success = { ok: true as const, message: 'Directory details saved.' };
  const actions: HouseholdDirectoryActions & DirectoryManagementActions = {
    async getDirectoryResidentsPageAction(input) {
      if (fail) return failure;
      const { search } = directoryPageInputSchema.parse(input);
      const needle = search?.toLowerCase() ?? '';
      return {
        ...success,
        data: directoryPage(
          residents.filter(
            (resident) =>
              !needle ||
              resident.full_name?.toLowerCase().includes(needle) ||
              resident.unit_number?.toLowerCase().includes(needle),
          ),
          input,
        ),
      };
    },
    async getDirectoryVehiclesPageAction(input) {
      return fail
        ? failure
        : { ...success, data: directoryPage(vehicles, input) };
    },
    async getDirectoryEmergencyContactsPageAction(input) {
      if (fail) return failure;
      const parsed = z
        .object({ unitId: z.uuid(), page: directoryPageInputSchema })
        .parse(input);
      return {
        ...success,
        data: directoryPage(
          contacts.filter((contact) => contact.unit_id === parsed.unitId),
          parsed.page,
        ),
      };
    },
    async setDirectoryVisibilityAction(data) {
      if (fail) return failure;
      setPreferences({
        name_visible: data.get('nameVisible') === 'on',
        unit_visible: data.get('unitVisible') === 'on',
        phone_visible: data.get('phoneVisible') === 'on',
      });
      return success;
    },
    async saveDirectoryVehicleAction(data) {
      setLastRequest(String(data.get('clientRequestId')));
      if (fail) return failure;
      const parsed = directoryVehicleInputSchema.safeParse({
        vehicleId: data.get('vehicleId') || null,
        unitId: data.get('unitId'),
        membershipId: data.get('membershipId'),
        vehicleType: data.get('vehicleType'),
        registrationNumber: data.get('registrationNumber'),
        tagNumber: data.get('tagNumber'),
        clientRequestId: data.get('clientRequestId'),
      });
      if (!parsed.success)
        return {
          ok: false,
          code: 'VALIDATION_FAILED',
          message: 'Check the vehicle details.',
        };
      const value = parsed.data;
      const record: DirectoryVehicle = {
        id: value.vehicleId ?? crypto.randomUUID(),
        unit_id: value.unitId,
        membership_id: value.membershipId ?? memberId,
        registration_number: value.registrationNumber,
        vehicle_type: value.vehicleType,
        tag_number: value.tagNumber,
        status: 'active',
        is_verified: false,
      };
      setVehicles((current) => [
        ...current.filter(({ id }) => id !== record.id),
        record,
      ]);
      return success;
    },
    async deactivateDirectoryVehicleAction(data) {
      if (fail) return failure;
      setVehicles((current) =>
        current.map((vehicle) =>
          vehicle.id === data.get('vehicleId')
            ? { ...vehicle, status: 'inactive', is_verified: false }
            : vehicle,
        ),
      );
      return success;
    },
    async verifyDirectoryVehicleAction(data) {
      if (fail) return failure;
      setVehicles((current) =>
        current.map((vehicle) =>
          vehicle.id === data.get('vehicleId')
            ? { ...vehicle, is_verified: data.get('isVerified') === 'on' }
            : vehicle,
        ),
      );
      return success;
    },
    async saveDirectoryEmergencyContactAction(data) {
      setLastRequest(String(data.get('clientRequestId')));
      if (fail) return failure;
      const parsed = directoryEmergencyContactInputSchema.safeParse({
        contactId: data.get('contactId') || null,
        unitId: data.get('unitId'),
        membershipId: data.get('membershipId'),
        fullName: data.get('fullName'),
        relationship: data.get('relationship'),
        phone: data.get('phone'),
        clientRequestId: data.get('clientRequestId'),
      });
      if (!parsed.success)
        return {
          ok: false,
          code: 'VALIDATION_FAILED',
          message: 'Check the contact details.',
        };
      const value = parsed.data;
      const record = {
        id: value.contactId ?? crypto.randomUUID(),
        unit_id: value.unitId,
        membership_id: value.membershipId ?? memberId,
        full_name: value.fullName,
        relationship: value.relationship,
        phone: value.phone,
      };
      setContacts((current) => [
        ...current.filter(({ id }) => id !== record.id),
        record,
      ]);
      return success;
    },
    async deactivateDirectoryEmergencyContactAction(data) {
      if (fail) return failure;
      setContacts((current) =>
        current.filter(({ id }) => id !== data.get('contactId')),
      );
      return success;
    },
  };
  const vehiclePage = directoryPage(vehicles, { limit: 10 });
  const contactPage = directoryPage(contacts, { limit: 10 });
  return (
    <section
      aria-label="Synthetic directory workflows"
      className="grid min-w-0 gap-space-5"
    >
      <SelectInput
        id="directory-fixture-role"
        label="Fixture role"
        value={role}
        onChange={(event) => setRole(event.currentTarget.value)}
        options={['resident', 'admin', 'committee', 'guard'].map((value) => ({
          label: value,
          value,
        }))}
      />
      <label className="inline-flex min-h-12 items-center gap-space-2">
        <input
          type="checkbox"
          checked={fail}
          onChange={(event) => setFail(event.currentTarget.checked)}
        />
        Simulate action failure
      </label>
      <p data-testid="directory-request-id">Last request: {lastRequest}</p>
      <p data-testid="directory-phone-preference">
        Phone sharing: {preferences.phone_visible ? 'enabled' : 'disabled'}
      </p>
      {role === 'resident' ? (
        <HouseholdDirectoryControls
          key={JSON.stringify({ vehicles, contacts, preferences })}
          actions={actions}
          vehicles={vehiclePage}
          preferences={preferences}
          contacts={[{ unitId, page: contactPage }]}
          households={[
            { unit_id: unitId, membership_id: memberId, unit_number: 'A-101' },
          ]}
        />
      ) : role === 'guard' ? (
        <GuardVehicleLookup
          action={async (data) => {
            if (fail) return failure;
            const plate = String(data.get('registrationNumber'))
              .replace(/[\s-]/g, '')
              .toUpperCase();
            return {
              ...success,
              data: vehicles
                .filter(
                  (vehicle) =>
                    vehicle.status === 'active' &&
                    vehicle.is_verified &&
                    vehicle.registration_number === plate,
                )
                .map((vehicle) => ({
                  vehicle_type: vehicle.vehicle_type,
                  unit_number: 'A-101',
                })),
            };
          }}
        />
      ) : (
        <DirectoryManagementWorkspace
          key={JSON.stringify({ role, vehicles, contacts })}
          actions={actions}
          canManage={role === 'admin'}
          vehicles={vehiclePage}
          contacts={contactPage}
          residents={directoryPage(residents, { limit: 10 })}
          units={[{ id: unitId, number: 'A-101' }]}
        />
      )}
    </section>
  );
}
