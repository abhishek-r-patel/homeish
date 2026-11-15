// Expose validated directory mutations through the shared server-action boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import { getDirectoryResidents } from '@/core/directory/operations';
import type {
  DirectoryPage,
  DirectoryResident,
} from '@/core/directory/validation';
import {
  getDirectoryEmergencyContacts,
  getDirectoryMyHouseholds,
  getDirectoryMyPreferences,
  deactivateDirectoryEmergencyContact,
  deactivateDirectoryVehicle,
  getDirectoryVehicles,
  lookupDirectoryVehicle,
  saveDirectoryEmergencyContact,
  saveDirectoryVehicle,
  setDirectoryVisibility,
  verifyDirectoryVehicle,
} from '@/core/directory/operations';

function value(formData: FormData, key: string) {
  const result = formData.get(key);
  return typeof result === 'string' ? result : '';
}

function optionalId(formData: FormData, key: string) {
  return value(formData, key) || null;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

export async function getDirectoryResidentsPageAction(input: unknown) {
  return runServerAction<DirectoryPage<DirectoryResident>>(
    'directory.resident.list',
    async () => ({ data: await getDirectoryResidents(input) }),
  );
}

export async function getDirectoryVehiclesPageAction(input: unknown) {
  return runServerAction('directory.vehicle.list', async () => ({
    data: await getDirectoryVehicles(input),
  }));
}

export async function getDirectoryEmergencyContactsPageAction(input: unknown) {
  return runServerAction('directory.emergency_contact.list', async () => {
    if (
      typeof input !== 'object' ||
      input === null ||
      !('unitId' in input) ||
      !('page' in input)
    ) {
      throw new ValidationError({
        page: 'Check the directory contact page request.',
      });
    }
    return {
      data: await getDirectoryEmergencyContacts(input.unitId, input.page),
    };
  });
}

export async function getDirectoryPreferencesAction() {
  return runServerAction('directory.visibility.read', async () => ({
    data: await getDirectoryMyPreferences(),
  }));
}

export async function getDirectoryHouseholdsAction() {
  return runServerAction('directory.household.list', async () => ({
    data: await getDirectoryMyHouseholds(),
  }));
}

export async function lookupDirectoryVehicleAction(formData: FormData) {
  return runServerAction('directory.vehicle.lookup', async (requestId) => ({
    data: await lookupDirectoryVehicle(
      value(formData, 'registrationNumber'),
      requestId,
    ),
  }));
}

export async function setDirectoryVisibilityAction(formData: FormData) {
  return runServerAction('directory.visibility.update', async (requestId) => {
    await setDirectoryVisibility(
      {
        nameVisible: checked(formData, 'nameVisible'),
        unitVisible: checked(formData, 'unitVisible'),
        phoneVisible: checked(formData, 'phoneVisible'),
      },
      requestId,
    );
    revalidatePath('/directory');
    return 'Directory visibility saved.';
  });
}

export async function saveDirectoryVehicleAction(formData: FormData) {
  return runServerAction('directory.vehicle.save', async (requestId) => {
    await saveDirectoryVehicle(
      {
        vehicleId: optionalId(formData, 'vehicleId'),
        unitId: value(formData, 'unitId'),
        membershipId: optionalId(formData, 'membershipId'),
        vehicleType: value(formData, 'vehicleType'),
        registrationNumber: value(formData, 'registrationNumber'),
        tagNumber: value(formData, 'tagNumber'),
        clientRequestId: value(formData, 'clientRequestId'),
      },
      requestId,
    );
    revalidatePath('/directory');
    revalidatePath('/admin/directory');
    return 'Vehicle saved.';
  });
}

export async function verifyDirectoryVehicleAction(formData: FormData) {
  return runServerAction('directory.vehicle.verify', async (requestId) => {
    await verifyDirectoryVehicle(
      {
        vehicleId: value(formData, 'vehicleId'),
        isVerified: checked(formData, 'isVerified'),
      },
      requestId,
    );
    revalidatePath('/admin/directory');
    return 'Vehicle verification updated.';
  });
}

export async function deactivateDirectoryVehicleAction(formData: FormData) {
  return runServerAction('directory.vehicle.deactivate', async (requestId) => {
    await deactivateDirectoryVehicle(
      { vehicleId: value(formData, 'vehicleId') },
      requestId,
    );
    revalidatePath('/directory');
    revalidatePath('/admin/directory');
    return 'Vehicle deactivated.';
  });
}

export async function saveDirectoryEmergencyContactAction(formData: FormData) {
  return runServerAction(
    'directory.emergency_contact.save',
    async (requestId) => {
      await saveDirectoryEmergencyContact(
        {
          contactId: optionalId(formData, 'contactId'),
          unitId: value(formData, 'unitId'),
          membershipId: optionalId(formData, 'membershipId'),
          fullName: value(formData, 'fullName'),
          relationship: value(formData, 'relationship'),
          phone: value(formData, 'phone'),
          clientRequestId: value(formData, 'clientRequestId'),
        },
        requestId,
      );
      revalidatePath('/directory');
      revalidatePath('/admin/directory');
      return 'Emergency contact saved.';
    },
  );
}

export async function deactivateDirectoryEmergencyContactAction(
  formData: FormData,
) {
  return runServerAction(
    'directory.emergency_contact.deactivate',
    async (requestId) => {
      await deactivateDirectoryEmergencyContact(
        { contactId: value(formData, 'contactId') },
        requestId,
      );
      revalidatePath('/directory');
      revalidatePath('/admin/directory');
      return 'Emergency contact deactivated.';
    },
  );
}
