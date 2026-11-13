// Handle resident approval decisions, pre-approvals and frequent visitors.
'use server';

import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { runServerAction } from '@/core/actions/server-action';
import {
  cancelVisitorPreApproval,
  createVisitorPreApproval,
  decideVisitor,
  getVisitorSocietyTimezone,
  preApproveFrequentVisitor,
  removeFrequentVisitor,
  saveFrequentVisitor,
  type VisitorPreApproval,
} from '@/core/visitor/operations';
import { localTimeToIso } from '@/lib/local-time';

function value(formData: FormData, key: string) {
  const result = formData.get(key);
  return typeof result === 'string' ? result : '';
}

async function approvalResult(approval: VisitorPreApproval, timezone: string) {
  const qrCode = await QRCode.toDataURL(approval.code, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
  return {
    message: 'Pre-approval created. Share the code with your visitor.',
    data: { ...approval, qrCode, timezone },
  };
}

export async function decideVisitorAction(formData: FormData) {
  return runServerAction('visitor.decide', async (requestId) => {
    await decideVisitor(
      value(formData, 'entryId'),
      value(formData, 'decision') === 'approve',
      requestId,
    );
    revalidatePath('/visitors');
    revalidatePath('/guard/visitors');
    return 'Your response was recorded.';
  });
}

export async function createVisitorPreApprovalAction(formData: FormData) {
  return runServerAction('visitor.preApproval.create', async (requestId) => {
    const timezone = await getVisitorSocietyTimezone();
    const approval = await createVisitorPreApproval(
      {
        unitId: value(formData, 'unitId'),
        visitorName: value(formData, 'visitorName'),
        validFrom: localTimeToIso(value(formData, 'validFrom'), timezone),
        validTo: localTimeToIso(value(formData, 'validTo'), timezone),
        vehicleNo: value(formData, 'vehicleNo') || null,
      },
      requestId,
    );
    revalidatePath('/visitors');
    return approvalResult(approval, timezone);
  });
}

export async function cancelVisitorPreApprovalAction(formData: FormData) {
  return runServerAction('visitor.preApproval.cancel', async (requestId) => {
    await cancelVisitorPreApproval(value(formData, 'approvalId'), requestId);
    revalidatePath('/visitors');
    return 'Pre-approval cancelled.';
  });
}

export async function saveFrequentVisitorAction(formData: FormData) {
  return runServerAction('visitor.frequent.save', async (requestId) => {
    await saveFrequentVisitor(
      {
        unitId: value(formData, 'unitId'),
        visitorName: value(formData, 'visitorName'),
        vehicleNo: value(formData, 'vehicleNo') || null,
      },
      requestId,
    );
    revalidatePath('/visitors');
    return 'Frequent visitor saved.';
  });
}

export async function removeFrequentVisitorAction(formData: FormData) {
  return runServerAction('visitor.frequent.remove', async (requestId) => {
    await removeFrequentVisitor(
      value(formData, 'frequentVisitorId'),
      requestId,
    );
    revalidatePath('/visitors');
    return 'Frequent visitor removed.';
  });
}

export async function preApproveFrequentVisitorAction(formData: FormData) {
  return runServerAction('visitor.frequent.preApprove', async (requestId) => {
    const timezone = await getVisitorSocietyTimezone();
    const approval = await preApproveFrequentVisitor(
      {
        frequentVisitorId: value(formData, 'frequentVisitorId'),
        validFrom: localTimeToIso(value(formData, 'validFrom'), timezone),
        validTo: localTimeToIso(value(formData, 'validTo'), timezone),
      },
      requestId,
    );
    revalidatePath('/visitors');
    return approvalResult(approval, timezone);
  });
}
