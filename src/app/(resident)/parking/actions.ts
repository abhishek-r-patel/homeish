// Run Parking mutations through current-role operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  allocateParkingSlot,
  archiveParkingSlot,
  cancelParkingPass,
  cancelParkingRequest,
  createParkingPass,
  createParkingReport,
  createParkingRequest,
  endParkingAllocation,
  resolveParkingReport,
  saveParkingSettings,
  saveParkingSlot,
  setParkingCondition,
  setParkingVehicleLink,
} from '@/core/parking/operations';

export async function saveParkingSettingsAction(form: FormData) {
  return runServerAction('/admin/parking', async (requestId) => {
    await saveParkingSettings(readModuleActionInput(form), requestId);
    return 'Photo retention saved.';
  });
}

export async function saveParkingSlotAction(form: FormData) {
  return runServerAction<string>('/admin/parking', async (requestId) => ({
    data: await saveParkingSlot(readModuleActionInput(form), requestId),
    message: 'Slot saved.',
  }));
}

export async function archiveParkingSlotAction(form: FormData) {
  return runServerAction('/admin/parking', async (requestId) => {
    await archiveParkingSlot(readModuleActionInput(form), requestId);
    return 'Slot archived. Its history is kept.';
  });
}

export async function setParkingConditionAction(form: FormData) {
  return runServerAction('/admin/parking', async (requestId) => {
    await setParkingCondition(readModuleActionInput(form), requestId);
    return 'Slot condition saved.';
  });
}

export async function allocateParkingSlotAction(form: FormData) {
  return runServerAction<string>('/admin/parking', async (requestId) => ({
    data: await allocateParkingSlot(readModuleActionInput(form), requestId),
    message: 'Slot allocated. The unit has been told.',
  }));
}

export async function endParkingAllocationAction(form: FormData) {
  return runServerAction('/admin/parking', async (requestId) => {
    await endParkingAllocation(readModuleActionInput(form), requestId);
    return 'Allocation ended. The slot is free.';
  });
}

export async function resolveParkingReportAction(form: FormData) {
  return runServerAction('/admin/parking', async (requestId) => {
    await resolveParkingReport(readModuleActionInput(form), requestId);
    return 'Report resolved. The reporter has been told.';
  });
}

export async function createParkingRequestAction(form: FormData) {
  return runServerAction<string>('/parking', async (requestId) => ({
    data: await createParkingRequest(readModuleActionInput(form), requestId),
    message: 'You are on the waitlist.',
  }));
}

export async function cancelParkingRequestAction(form: FormData) {
  return runServerAction('/parking', async (requestId) => {
    await cancelParkingRequest(readModuleActionInput(form), requestId);
    return 'Waitlist request cancelled.';
  });
}

export async function setParkingVehicleLinkAction(form: FormData) {
  return runServerAction('/parking', async (requestId) => {
    await setParkingVehicleLink(readModuleActionInput(form), requestId);
    return 'Vehicle list updated.';
  });
}

export async function createParkingPassAction(form: FormData) {
  return runServerAction<string>('/parking', async (requestId) => ({
    data: await createParkingPass(readModuleActionInput(form), requestId),
    message: 'Visitor pass created. Guards can see it at the gate.',
  }));
}

export async function cancelParkingPassAction(form: FormData) {
  return runServerAction('/parking', async (requestId) => {
    await cancelParkingPass(readModuleActionInput(form), requestId);
    return 'Visitor pass cancelled.';
  });
}

export async function createParkingReportAction(form: FormData) {
  return runServerAction<string>('/parking', async (requestId) => ({
    data: await createParkingReport(readModuleActionInput(form), requestId),
    message: 'Report sent. The unit and administrators have been told.',
  }));
}
