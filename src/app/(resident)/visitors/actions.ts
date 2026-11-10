// Handle resident approval decisions and one-time visitor pre-approvals.
'use server';

import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import {
  cancelVisitorPreApproval,
  createVisitorPreApproval,
  decideVisitor,
  getVisitorSocietyTimezone,
} from '@/core/visitor/operations';

function value(formData: FormData, key: string) {
  const result = formData.get(key);
  return typeof result === 'string' ? result : '';
}

function localTimeToIso(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new ValidationError({ time: 'Enter a valid local time.' });
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const target = Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    Number(hourText),
    Number(minuteText),
  );
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  function part(date: Date, type: Intl.DateTimeFormatPartTypes) {
    return Number(
      formatter.formatToParts(date).find((item) => item.type === type)?.value,
    );
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const represented = Date.UTC(
      part(new Date(timestamp), 'year'),
      part(new Date(timestamp), 'month') - 1,
      part(new Date(timestamp), 'day'),
      part(new Date(timestamp), 'hour'),
      part(new Date(timestamp), 'minute'),
    );
    timestamp += target - represented;
  }
  const result = new Date(timestamp);
  if (
    !Number.isFinite(result.getTime()) ||
    part(result, 'year') !== Number(yearText) ||
    part(result, 'month') !== Number(monthText) ||
    part(result, 'day') !== Number(dayText) ||
    part(result, 'hour') !== Number(hourText) ||
    part(result, 'minute') !== Number(minuteText)
  ) {
    throw new ValidationError({
      time: 'That local time does not exist in the society time zone.',
    });
  }
  return result.toISOString();
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
    const qrCode = await QRCode.toDataURL(approval.code, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    });
    revalidatePath('/visitors');
    return {
      message: 'Pre-approval created. Share the code with your visitor.',
      data: { ...approval, qrCode, timezone },
    };
  });
}

export async function cancelVisitorPreApprovalAction(formData: FormData) {
  return runServerAction('visitor.preApproval.cancel', async (requestId) => {
    await cancelVisitorPreApproval(value(formData, 'approvalId'), requestId);
    revalidatePath('/visitors');
    return 'Pre-approval cancelled.';
  });
}
