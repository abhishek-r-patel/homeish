// Service request mutations shared by resident and administration screens.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  addServiceRequestComment,
  assignServiceRequest,
  confirmServiceRequestClose,
  createServiceRequest,
  rateServiceRequest,
  rejectServiceRequest,
  reopenServiceRequest,
  saveServiceRequestCategory,
  updateServiceRequestStatus,
} from '@/core/service-requests/operations';

function refreshRequestViews(requestId?: string) {
  revalidatePath('/requests');
  revalidatePath('/admin/requests');
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
