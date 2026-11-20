// Service request mutations shared by resident and administration screens.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  addServiceRequestComment,
  assignServiceRequest,
  changeServiceRequestPriority,
  confirmServiceRequestClose,
  createServiceRequest,
  holdServiceRequest,
  logServiceRequest,
  rateServiceRequest,
  recordServiceRequestRoundCheck,
  rejectServiceRequest,
  releaseServiceRequest,
  reopenServiceRequest,
  respondToServiceRequestEscalation,
  saveServiceRequestCategory,
  saveServiceRequestEscalationSettings,
  saveServiceRequestInspectionPoint,
  saveServiceRequestTargets,
  setServiceRequestFollowUp,
  setServiceRequestUpvote,
  updateServiceRequestStatus,
} from '@/core/service-requests/operations';

function refreshRequestViews(requestId?: string) {
  revalidatePath('/requests');
  revalidatePath('/admin/requests');
  revalidatePath('/housekeeping/rounds');
  revalidatePath('/guard/rounds');
  if (requestId) {
    revalidatePath(`/requests/${requestId}`);
    revalidatePath(`/admin/requests/${requestId}`);
  }
}

function parseInput(formData: FormData): unknown {
  const raw = formData.get('input');
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createServiceRequestAction(formData: FormData) {
  return runServerAction('request.create', async (requestId) => {
    const result = await createServiceRequest(parseInput(formData), requestId);
    refreshRequestViews(result.id);
    return { data: result, message: 'Your request was submitted.' };
  });
}

export async function saveServiceRequestCategoryAction(formData: FormData) {
  return runServerAction('request.categories.save', async (requestId) => {
    const result = await saveServiceRequestCategory(
      parseInput(formData),
      requestId,
    );
    refreshRequestViews();
    return { data: result, message: 'The request category was saved.' };
  });
}

export async function saveServiceRequestEscalationSettingsAction(
  formData: FormData,
) {
  return runServerAction(
    'request.escalation_settings.save',
    async (requestId) => {
      const result = await saveServiceRequestEscalationSettings(
        parseInput(formData),
        requestId,
      );
      refreshRequestViews();
      return { data: result, message: 'The escalation settings were saved.' };
    },
  );
}

export async function assignServiceRequestAction(formData: FormData) {
  return runServerAction('request.assign', async (requestId) => {
    const input = parseInput(formData);
    const result = await assignServiceRequest(input, requestId);
    refreshRequestViews(
      typeof input === 'object' && input !== null && 'requestId' in input
        ? String(input.requestId)
        : undefined,
    );
    return { data: result, message: 'The request assignment was updated.' };
  });
}

export async function updateServiceRequestStatusAction(formData: FormData) {
  return runServerAction('request.updateStatus', async (requestId) => {
    const input = parseInput(formData);
    const result = await updateServiceRequestStatus(input, requestId);
    refreshRequestViews(result.id);
    return { data: result, message: 'The request status was updated.' };
  });
}

export async function rejectServiceRequestAction(formData: FormData) {
  return runServerAction('request.reject', async (requestId) => {
    const input = parseInput(formData);
    const result = await rejectServiceRequest(input, requestId);
    refreshRequestViews(result.id);
    return { data: result, message: 'The request was rejected.' };
  });
}

export async function confirmServiceRequestCloseAction(formData: FormData) {
  return runServerAction('request.confirmClose', async (requestId) => {
    const input = parseInput(formData);
    const result = await confirmServiceRequestClose(input, requestId);
    refreshRequestViews(result.id);
    return { data: result, message: 'You closed the request.' };
  });
}

export async function reopenServiceRequestAction(formData: FormData) {
  return runServerAction('request.reopen', async (requestId) => {
    const input = parseInput(formData);
    const result = await reopenServiceRequest(input, requestId);
    refreshRequestViews(result.id);
    return { data: result, message: 'The request was reopened.' };
  });
}

export async function rateServiceRequestAction(formData: FormData) {
  return runServerAction('request.rate', async (requestId) => {
    const input = parseInput(formData);
    const result = await rateServiceRequest(input, requestId);
    refreshRequestViews(result.id);
    return { data: result, message: 'Thank you for rating this request.' };
  });
}

export async function addServiceRequestCommentAction(formData: FormData) {
  return runServerAction('request.addComment', async (requestId) => {
    const input = parseInput(formData);
    const result = await addServiceRequestComment(input, requestId);
    refreshRequestViews(result.request_id);
    return { data: result, message: 'Your comment was added.' };
  });
}

export async function setServiceRequestUpvoteAction(formData: FormData) {
  return runServerAction('request.upvote', async (requestId) => {
    const result = await setServiceRequestUpvote(
      parseInput(formData),
      requestId,
    );
    refreshRequestViews(result.request_id);
    return {
      data: result,
      message: result.has_upvoted ? 'Upvote added.' : 'Upvote removed.',
    };
  });
}

export async function logServiceRequestAction(formData: FormData) {
  return runServerAction('request.log', async (requestId) => {
    const result = await logServiceRequest(parseInput(formData), requestId);
    refreshRequestViews(result.id);
    return { data: result, message: 'The request was logged.' };
  });
}

export async function changeServiceRequestPriorityAction(formData: FormData) {
  return runServerAction('request.priority', async (requestId) => {
    const result = await changeServiceRequestPriority(
      parseInput(formData),
      requestId,
    );
    refreshRequestViews(result.id);
    return { data: result, message: 'The priority was changed.' };
  });
}

export async function holdServiceRequestAction(formData: FormData) {
  return runServerAction('request.hold', async (requestId) => {
    const result = await holdServiceRequest(parseInput(formData), requestId);
    refreshRequestViews(result.id);
    return { data: result, message: 'The request is on hold.' };
  });
}

export async function releaseServiceRequestAction(formData: FormData) {
  return runServerAction('request.release', async (requestId) => {
    const result = await releaseServiceRequest(parseInput(formData), requestId);
    refreshRequestViews(result.id);
    return { data: result, message: 'The request is no longer on hold.' };
  });
}

export async function setServiceRequestFollowUpAction(formData: FormData) {
  return runServerAction('request.followUp', async (requestId) => {
    const result = await setServiceRequestFollowUp(
      parseInput(formData),
      requestId,
    );
    refreshRequestViews(result.id);
    return { data: result, message: 'The feedback follow-up was updated.' };
  });
}

export async function saveServiceRequestTargetsAction(formData: FormData) {
  return runServerAction('request.targets.save', async (requestId) => {
    const result = await saveServiceRequestTargets(
      parseInput(formData),
      requestId,
    );
    refreshRequestViews();
    return { data: result, message: 'The target days were saved.' };
  });
}

export async function respondToServiceRequestEscalationAction(
  formData: FormData,
) {
  return runServerAction('request.escalation.respond', async (requestId) => {
    const input = parseInput(formData);
    const result = await respondToServiceRequestEscalation(input, requestId);
    refreshRequestViews(
      typeof input === 'object' && input !== null && 'requestId' in input
        ? String(input.requestId)
        : undefined,
    );
    return { data: result, message: 'Your response was recorded.' };
  });
}

export async function saveServiceRequestInspectionPointAction(
  formData: FormData,
) {
  return runServerAction('request.rounds.point.save', async (requestId) => {
    const result = await saveServiceRequestInspectionPoint(
      parseInput(formData),
      requestId,
    );
    refreshRequestViews();
    return { data: result, message: 'The check point was saved.' };
  });
}

export async function recordServiceRequestRoundCheckAction(formData: FormData) {
  return runServerAction('request.rounds.check', async (requestId) => {
    const result = await recordServiceRequestRoundCheck(
      parseInput(formData),
      requestId,
    );
    refreshRequestViews(result.request_id ?? undefined);
    return { data: result, message: 'The check was recorded.' };
  });
}
