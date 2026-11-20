// Notice board mutations for administrators and committee members.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  createNotice,
  publishNoticeDraft,
  saveNoticeDraft,
  saveNoticePlan,
  proposeNoticePlan,
  reviewNoticePlan,
  setNoticePinned,
  updateNotice,
  withdrawNotice,
} from '@/core/notices/operations';

function refreshNoticeViews(noticeId?: string) {
  revalidatePath('/notices');
  revalidatePath('/admin/notices');
  if (noticeId) {
    revalidatePath(`/notices/${noticeId}`);
    revalidatePath(`/admin/notices/${noticeId}`);
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

export async function createNoticeAction(formData: FormData) {
  return runServerAction('notice.create', async (requestId) => {
    const result = await createNotice(parseInput(formData), requestId);
    refreshNoticeViews(result.id);
    return { data: result, message: 'The notice was published.' };
  });
}

export async function updateNoticeAction(formData: FormData) {
  return runServerAction('notice.update', async (requestId) => {
    const result = await updateNotice(parseInput(formData), requestId);
    refreshNoticeViews(result.id);
    return { data: result, message: 'The notice was updated.' };
  });
}

export async function setNoticePinnedAction(formData: FormData) {
  return runServerAction('notice.pin', async (requestId) => {
    const result = await setNoticePinned(parseInput(formData), requestId);
    refreshNoticeViews(result.id);
    return {
      data: result,
      message: result.pinned
        ? 'The notice was pinned.'
        : 'The notice was unpinned.',
    };
  });
}

export async function withdrawNoticeAction(formData: FormData) {
  return runServerAction('notice.withdraw', async (requestId) => {
    const result = await withdrawNotice(parseInput(formData), requestId);
    refreshNoticeViews(result.id);
    return { data: result, message: 'The notice was withdrawn.' };
  });
}

export async function saveNoticeDraftAction(formData: FormData) {
  return runServerAction('notice.draft_save', async (requestId) => {
    const result = await saveNoticeDraft(parseInput(formData), requestId);
    refreshNoticeViews(result.id);
    return {
      data: result,
      message:
        result.status === 'scheduled'
          ? 'The notice was scheduled.'
          : 'The draft was saved.',
    };
  });
}

export async function publishNoticeDraftAction(formData: FormData) {
  return runServerAction('notice.draft_publish', async (requestId) => {
    const result = await publishNoticeDraft(parseInput(formData), requestId);
    refreshNoticeViews(result.id);
    return { data: result, message: 'The notice was published.' };
  });
}

export async function saveNoticePlanAction(formData: FormData) {
  return runServerAction('notice.plan_save', async (requestId) => {
    const result = await saveNoticePlan(parseInput(formData), requestId);
    refreshNoticeViews(result.id);
    return { data: result, message: 'The planning details were saved.' };
  });
}

export async function proposeNoticePlanAction(formData: FormData) {
  return runServerAction('notice.plan_propose', async (requestId) => {
    const result = await proposeNoticePlan(parseInput(formData), requestId);
    refreshNoticeViews(result.notice_id);
    return {
      data: result,
      message: 'Planning proposal submitted. An admin must review it.',
    };
  });
}

export async function reviewNoticePlanAction(formData: FormData) {
  return runServerAction('notice.plan_review', async (requestId) => {
    const result = await reviewNoticePlan(parseInput(formData), requestId);
    refreshNoticeViews(result.notice_id);
    return {
      data: result,
      message:
        result.status === 'accepted'
          ? 'Proposal accepted. The official planning details were updated.'
          : 'Proposal rejected. The official planning details are unchanged.',
    };
  });
}
