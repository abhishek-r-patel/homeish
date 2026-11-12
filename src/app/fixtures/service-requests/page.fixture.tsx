// Exercise the service request create, update and rating journey with synthetic data.
'use client';

import { useState } from 'react';
import { ServiceRequestCreateForm } from '@/components/service-requests/create-form';
import { ServiceRequestActionForm } from '@/components/service-requests/action-form';
import { Card, StatusChip } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { publicEnvironment } from '@/core/config/public-env';
import type { ServerActionResult } from '@/core/actions/server-action';
import { serviceRequestCreateInputSchema } from '@/core/service-requests/validation';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const unitId = '5a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const category = {
  id: '6a696d6f-774c-41d1-ae47-6254d4a8f4cf',
  society_id: societyId,
  created_at: '2026-11-10T09:00:00.000Z',
  created_by: null,
  updated_at: '2026-11-10T09:00:00.000Z',
  updated_by: null,
  name: 'Plumbing',
  sla_hours: 24,
  sort_order: 0,
  active: true,
};

type FixtureRequest = {
  category: string;
  description: string;
  status: 'open' | 'resolved' | 'closed';
  rating: number | null;
};

function failure(message: string): ServerActionResult<unknown> {
  return { ok: false, code: 'VALIDATION_FAILED', message };
}

export default function ServiceRequestsFixturePage() {
  const [request, setRequest] = useState<FixtureRequest | null>(null);
  const [comments, setComments] = useState<string[]>([]);

  async function createAction(
    formData: FormData,
  ): Promise<ServerActionResult<unknown>> {
    let input: unknown;
    try {
      input = JSON.parse(String(formData.get('input') ?? ''));
    } catch {
      return failure('The fixture request was invalid.');
    }
    const parsed = serviceRequestCreateInputSchema.safeParse(input);
    if (!parsed.success) return failure('Check the request details.');
    setRequest({
      category: 'Plumbing',
      description: parsed.data.description,
      status: 'open',
      rating: null,
    });
    return { ok: true, message: 'Your request was submitted.' };
  }

  async function statusAction(
    formData: FormData,
  ): Promise<ServerActionResult<unknown>> {
    const input = JSON.parse(String(formData.get('input') ?? '{}')) as {
      status?: 'resolved' | 'closed';
    };
    if (!request || !input.status) return failure('The status update failed.');
    setRequest({ ...request, status: input.status });
    return {
      ok: true,
      message:
        input.status === 'resolved' ? 'Request resolved.' : 'Request closed.',
    };
  }

  async function commentAction(
    formData: FormData,
  ): Promise<ServerActionResult<unknown>> {
    const input = JSON.parse(String(formData.get('input') ?? '{}')) as {
      body?: string;
    };
    const body = input.body?.trim();
    if (!body) return failure('Enter a comment.');
    setComments((current) => [...current, body]);
    return { ok: true, message: 'Your comment was added.' };
  }

  async function ratingAction(
    formData: FormData,
  ): Promise<ServerActionResult<unknown>> {
    const input = JSON.parse(String(formData.get('input') ?? '{}')) as {
      rating?: number;
    };
    if (!request || !input.rating) return failure('Choose a rating.');
    setRequest({ ...request, rating: input.rating });
    return { ok: true, message: 'Thank you for rating this request.' };
  }

  return (
    <main
      className="mx-auto grid min-h-dvh w-full min-w-0 max-w-content-default grid-cols-1 gap-space-5 px-space-4 py-space-6 text-ink"
      data-storage-origin={
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      }
    >
      <Banner title="Synthetic service requests fixture" tone="info">
        Development-only in-memory data. No request or comment is written to a
        database. Reload to reset.
      </Banner>
      <h1 className="text-title font-semibold">Service requests</h1>
      <Card className="min-w-0" title="New service request">
        <ServiceRequestCreateForm
          action={createAction}
          categories={[category]}
          refresh={false}
          units={[{ id: unitId, number: 'A-101', block: 'A' }]}
        />
      </Card>
      {request ? (
        <>
          <Card className="min-w-0" title={request.category}>
            <div className="grid gap-space-3">
              <StatusChip status={`request.${request.status}`} />
              <p>{request.description}</p>
            </div>
          </Card>
          {request.status === 'open' ? (
            <ServiceRequestActionForm
              action={statusAction}
              input={() => ({ status: 'resolved' })}
              refresh={false}
              submitLabel="Mark resolved"
            >
              {null}
            </ServiceRequestActionForm>
          ) : null}
          {request.status === 'resolved' ? (
            <ServiceRequestActionForm
              action={statusAction}
              input={() => ({ status: 'closed' })}
              refresh={false}
              submitLabel="Close request"
            >
              {null}
            </ServiceRequestActionForm>
          ) : null}
          {request.status === 'closed' && request.rating === null ? (
            <ServiceRequestActionForm
              action={ratingAction}
              input={(formData) => ({
                rating: Number(formData.get('rating')),
              })}
              refresh={false}
              submitLabel="Submit rating"
            >
              <label className="grid gap-space-1" htmlFor="fixture-rating">
                Rating
                <select
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                  defaultValue="5"
                  id="fixture-rating"
                  name="rating"
                >
                  <option value="5">5 stars</option>
                  <option value="4">4 stars</option>
                  <option value="3">3 stars</option>
                  <option value="2">2 stars</option>
                  <option value="1">1 star</option>
                </select>
              </label>
            </ServiceRequestActionForm>
          ) : null}
          {request.rating !== null ? (
            <p role="status">Rated {request.rating} stars.</p>
          ) : null}
          <Card className="min-w-0" title="Comments">
            <ul aria-label="Request comments" className="grid gap-space-2">
              {comments.map((comment, index) => (
                <li key={`${index}-${comment}`}>{comment}</li>
              ))}
            </ul>
            <ServiceRequestActionForm
              action={commentAction}
              input={(formData) => ({
                body: String(formData.get('body') ?? ''),
              })}
              refresh={false}
              submitLabel="Add comment"
            >
              <label className="grid gap-space-1" htmlFor="fixture-comment">
                Comment
                <textarea
                  className="min-h-24 rounded-md border border-rule-strong bg-surface p-space-3"
                  id="fixture-comment"
                  maxLength={2000}
                  name="body"
                  required
                />
              </label>
            </ServiceRequestActionForm>
          </Card>
        </>
      ) : null}
    </main>
  );
}
