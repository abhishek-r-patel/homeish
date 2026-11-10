// Render request actions permitted to the current requester or assignee.
'use client';

import { useState } from 'react';
import {
  addServiceRequestCommentAction,
  assignServiceRequestAction,
  confirmServiceRequestCloseAction,
  rateServiceRequestAction,
  rejectServiceRequestAction,
  reopenServiceRequestAction,
  updateServiceRequestStatusAction,
} from '@/app/(resident)/requests/actions';
import { Card } from '@/components/ui/data-display';
import { ServiceRequestActionForm } from './action-form';
import type { ServiceRequestStatus } from '@/core/service-requests/validation';

type Assignee = {
  membership_id: string;
  name: string | null;
  roles: string[];
};

const fieldClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus';

export function ServiceRequestDetailControls({
  assignees,
  canManage,
  canUpdate,
  isRequester,
  requestId,
  status,
  rated,
}: {
  assignees: Assignee[];
  canManage: boolean;
  canUpdate: boolean;
  isRequester: boolean;
  requestId: string;
  status: ServiceRequestStatus;
  rated: boolean;
}) {
  const [commentId, setCommentId] = useState('');
  function ensureCommentId() {
    if (commentId) return commentId;
    const id = crypto.randomUUID();
    setCommentId(id);
    return id;
  }
  const canComment = canManage || canUpdate || isRequester;

  return (
    <div className="grid gap-space-4">
      {canManage &&
      ['open', 'assigned', 'in_progress', 'reopened'].includes(status) ? (
        <Card className="min-w-0" title="Assign request">
          <ServiceRequestActionForm
            action={assignServiceRequestAction}
            input={(formData) => {
              const membershipId = String(formData.get('membershipId') ?? '');
              const vendorName = String(
                formData.get('vendorName') ?? '',
              ).trim();
              const vendorPhone = String(
                formData.get('vendorPhone') ?? '',
              ).trim();
              const isVendor = Boolean(vendorName || vendorPhone);
              return {
                requestId,
                membershipId: isVendor ? null : membershipId || null,
                vendorName: isVendor ? vendorName || null : null,
                vendorPhone: isVendor ? vendorPhone || null : null,
                note: String(formData.get('note') ?? '').trim() || null,
              };
            }}
            submitLabel="Save assignment"
          >
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="request-assignee"
            >
              Assign to member
              <select
                className={fieldClass}
                defaultValue=""
                id="request-assignee"
                name="membershipId"
              >
                <option value="">Choose a member or use a vendor</option>
                {assignees.map((assignee) => (
                  <option
                    key={assignee.membership_id}
                    value={assignee.membership_id}
                  >
                    {assignee.name ?? 'Unnamed member'} (
                    {assignee.roles.join(', ')})
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="grid gap-space-3 border-0 p-0">
              <legend className="text-body-strong">
                Or assign to a vendor
              </legend>
              <label className="grid gap-space-1" htmlFor="request-vendor-name">
                Vendor name
                <input
                  className={fieldClass}
                  id="request-vendor-name"
                  maxLength={120}
                  name="vendorName"
                />
              </label>
              <label
                className="grid gap-space-1"
                htmlFor="request-vendor-phone"
              >
                Vendor phone
                <input
                  className={fieldClass}
                  id="request-vendor-phone"
                  maxLength={20}
                  name="vendorPhone"
                />
              </label>
            </fieldset>
            <label
              className="grid gap-space-1"
              htmlFor="request-assignment-note"
            >
              Note (optional)
              <textarea
                className={fieldClass}
                id="request-assignment-note"
                maxLength={500}
                name="note"
              />
            </label>
          </ServiceRequestActionForm>
        </Card>
      ) : null}
      {canUpdate && ['assigned', 'in_progress', 'reopened'].includes(status) ? (
        <Card className="min-w-0" title="Update status">
          <div className="flex flex-wrap gap-space-3">
            {status !== 'in_progress' ? (
              <ServiceRequestActionForm
                action={updateServiceRequestStatusAction}
                className="inline-grid"
                input={() => ({ requestId, status: 'in_progress' })}
                submitLabel="Mark in progress"
              >
                {null}
              </ServiceRequestActionForm>
            ) : null}
            <ServiceRequestActionForm
              action={updateServiceRequestStatusAction}
              className="inline-grid"
              input={() => ({ requestId, status: 'resolved' })}
              submitLabel="Mark resolved"
            >
              {null}
            </ServiceRequestActionForm>
          </div>
        </Card>
      ) : null}
      {canManage &&
      ['open', 'assigned', 'in_progress', 'reopened'].includes(status) ? (
        <Card className="min-w-0" title="Reject request">
          <ServiceRequestActionForm
            action={rejectServiceRequestAction}
            input={(formData) => ({
              requestId,
              reason: String(formData.get('reason') ?? ''),
            })}
            submitLabel="Reject request"
          >
            <label className="grid gap-space-1" htmlFor="request-reject-reason">
              Reason
              <textarea
                className={fieldClass}
                id="request-reject-reason"
                maxLength={500}
                minLength={2}
                name="reason"
                required
              />
            </label>
          </ServiceRequestActionForm>
        </Card>
      ) : null}
      {isRequester && status === 'resolved' ? (
        <Card className="min-w-0" title="Confirm resolution">
          <div className="flex flex-wrap gap-space-3">
            <ServiceRequestActionForm
              action={confirmServiceRequestCloseAction}
              className="inline-grid"
              input={() => ({ requestId })}
              submitLabel="Close request"
            >
              {null}
            </ServiceRequestActionForm>
            <ServiceRequestActionForm
              action={reopenServiceRequestAction}
              input={(formData) => ({
                requestId,
                reason: String(formData.get('reason') ?? ''),
              })}
              submitLabel="Reopen request"
            >
              <label
                className="grid gap-space-1"
                htmlFor="request-reopen-resolved"
              >
                Not resolved? Tell us why
                <textarea
                  className={fieldClass}
                  id="request-reopen-resolved"
                  maxLength={500}
                  minLength={2}
                  name="reason"
                  required
                />
              </label>
            </ServiceRequestActionForm>
          </div>
        </Card>
      ) : null}
      {isRequester && status === 'closed' ? (
        <>
          {!rated ? (
            <Card className="min-w-0" title="Rate the resolution">
              <ServiceRequestActionForm
                action={rateServiceRequestAction}
                input={(formData) => ({
                  requestId,
                  rating: Number(formData.get('rating')),
                  comment: String(formData.get('comment') ?? '').trim() || null,
                })}
                submitLabel="Submit rating"
              >
                <label className="grid gap-space-1" htmlFor="request-rating">
                  Rating
                  <select
                    className={fieldClass}
                    defaultValue="5"
                    id="request-rating"
                    name="rating"
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} star{value === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="grid gap-space-1"
                  htmlFor="request-rating-comment"
                >
                  Comment (optional)
                  <textarea
                    className={fieldClass}
                    id="request-rating-comment"
                    maxLength={500}
                    name="comment"
                  />
                </label>
              </ServiceRequestActionForm>
            </Card>
          ) : null}
          <Card className="min-w-0" title="Reopen request">
            <ServiceRequestActionForm
              action={reopenServiceRequestAction}
              input={(formData) => ({
                requestId,
                reason: String(formData.get('reason') ?? ''),
              })}
              submitLabel="Reopen request"
            >
              <label
                className="grid gap-space-1"
                htmlFor="request-reopen-closed"
              >
                Tell us why this needs more work
                <textarea
                  className={fieldClass}
                  id="request-reopen-closed"
                  maxLength={500}
                  minLength={2}
                  name="reason"
                  required
                />
              </label>
            </ServiceRequestActionForm>
          </Card>
        </>
      ) : null}
      {canComment ? (
        <Card className="min-w-0" title="Add a comment">
          <ServiceRequestActionForm
            action={addServiceRequestCommentAction}
            input={(formData) => ({
              requestId,
              body: String(formData.get('body') ?? ''),
              clientRequestId: ensureCommentId(),
            })}
            onSuccess={() => setCommentId(crypto.randomUUID())}
            submitLabel="Add comment"
          >
            <input name="clientRequestId" type="hidden" value={commentId} />
            <label className="grid gap-space-1" htmlFor="request-comment">
              Comment
              <textarea
                className={fieldClass}
                id="request-comment"
                maxLength={2000}
                minLength={1}
                name="body"
                required
              />
            </label>
          </ServiceRequestActionForm>
        </Card>
      ) : null}
    </div>
  );
}
