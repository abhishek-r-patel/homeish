// Notice board mutations for administrators and committee members.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  createNotice,
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
