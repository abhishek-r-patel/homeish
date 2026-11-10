// Keep visitor guard actions behind the shared action error and logging boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  checkInVisitor,
  checkOutVisitor,
  checkInPreApprovedVisitor,
  createVisitorEntry,
  overrideVisitor,
  validateVisitorCode,
} from '@/core/visitor/operations';

function value(formData: FormData, key: string) {
  const result = formData.get(key);
  return typeof result === 'string' ? result : '';
}

export async function createVisitorEntryAction(formData: FormData) {
  return runServerAction('visitor.createEntry', async (requestId) => {
    const result = await createVisitorEntry(
      {
        unitId: value(formData, 'unitId'),
        visitorName: value(formData, 'visitorName'),
        visitorPhone: value(formData, 'visitorPhone') || null,
        purpose: value(formData, 'purpose'),
        peopleCount: Number(value(formData, 'peopleCount')),
        vehicleNo: value(formData, 'vehicleNo') || null,
        photoPath: value(formData, 'photoPath') || null,
        clientRequestId: value(formData, 'clientRequestId'),
      },
      requestId,
    );
    revalidatePath('/guard/visitors');
    revalidatePath('/visitors');
    revalidatePath('/admin/visitors');
    return {
      message: result.blacklisted
        ? 'Entry created. Warning: this phone number is on the society blacklist.'
        : 'Resident notified.',
      data: result.entry.id,
    };
  });
}

export async function checkInVisitorAction(formData: FormData) {
  return runServerAction('visitor.checkIn', async (requestId) => {
    await checkInVisitor(value(formData, 'entryId'), requestId);
    revalidatePath('/guard/visitors');
    revalidatePath('/admin/visitors');
    return 'Visitor checked in.';
  });
}

export async function checkOutVisitorAction(formData: FormData) {
  return runServerAction('visitor.checkOut', async (requestId) => {
    await checkOutVisitor(value(formData, 'entryId'), requestId);
    revalidatePath('/guard/visitors');
    revalidatePath('/admin/visitors');
    return 'Visitor checked out.';
  });
}

export async function overrideVisitorAction(formData: FormData) {
  return runServerAction('visitor.override', async (requestId) => {
    await overrideVisitor(
      value(formData, 'entryId'),
      value(formData, 'reason'),
      requestId,
    );
    revalidatePath('/guard/visitors');
    revalidatePath('/visitors');
    return 'Visitor allowed by guard. The action was recorded.';
  });
}

export async function validateVisitorCodeAction(formData: FormData) {
  return runServerAction('visitor.preApproval.validate', async () => ({
    data: await validateVisitorCode(value(formData, 'code')),
  }));
}

export async function checkInPreApprovedVisitorAction(formData: FormData) {
  return runServerAction('visitor.preApproval.checkIn', async (requestId) => {
    await checkInPreApprovedVisitor(value(formData, 'code'), requestId);
    revalidatePath('/guard/visitors');
    revalidatePath('/visitors');
    return 'Pre-approved visitor checked in.';
  });
}
