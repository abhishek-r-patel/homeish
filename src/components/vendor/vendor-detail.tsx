// Show one vendor with its private documents, ratings and quotes to the admin and committee.
'use client';
import { useId, useState } from 'react';
import {
  VENDOR_REQUEST_STATUS_LABELS,
  formatPaise,
  ratingText,
} from '@/core/vendor/presentation';
import {
  vendorDocumentInputSchema,
  vendorRatingInputSchema,
  type VendorDetail,
} from '@/core/vendor/validation';
import { Card } from '@/components/ui/data-display';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  VENDOR_ACTIONS,
  VENDOR_BASE_HREF,
  VendorFileLink,
  VendorFilePicker,
  VendorQuickAction,
  type VendorActions,
} from './shared';
import { VendorForm } from './workspace';

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeZone: 'Asia/Kolkata',
});
const formatDate = (value: string) => dateFormat.format(new Date(value));

function DocumentForm({
  vendorId,
  actions,
}: {
  vendorId: string;
  actions: VendorActions;
}) {
  const id = useId();
  const [path, setPath] = useState<string | null>(null);
  return (
    <ModuleActionForm
      action={actions.addDocument}
      idempotent
      submitLabel="Attach document"
      submitDisabled={!path}
      input={(form, clientRequestId) =>
        vendorDocumentInputSchema.parse({
          vendorId,
          title: String(form.get('title') ?? ''),
          path,
          clientRequestId,
        })
      }
    >
      <TextInput
        id={`${id}-title`}
        name="title"
        label="Document title"
        helpText="For example Trade licence or Insurance certificate."
        required
        maxLength={120}
        autoComplete="off"
      />
      <VendorFilePicker
        label="Document file"
        prepareUpload={actions.prepareDocumentUpload}
        request={actions.uploadRequest}
        onChange={setPath}
      />
    </ModuleActionForm>
  );
}

function RatingForm({
  detail,
  actions,
}: {
  detail: VendorDetail;
  actions: VendorActions;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.saveRating}
      submitLabel={detail.my_rating ? 'Update my rating' : 'Save my rating'}
      input={(form) =>
        vendorRatingInputSchema.parse({
          vendorId: detail.vendor.id,
          stars: Number(form.get('stars')),
          comment: String(form.get('comment') ?? ''),
        })
      }
    >
      <SelectInput
        id={`${id}-stars`}
        name="stars"
        label="Stars"
        required
        defaultValue={String(detail.my_rating?.stars ?? 5)}
        options={[5, 4, 3, 2, 1].map((stars) => ({
          value: String(stars),
          label: `${stars} ${stars === 1 ? 'star' : 'stars'}`,
        }))}
      />
      <TextAreaInput
        id={`${id}-comment`}
        name="comment"
        label="Comment (optional)"
        maxLength={500}
        defaultValue={detail.my_rating?.comment ?? ''}
      />
    </ModuleActionForm>
  );
}

export function VendorDetailView({
  detail,
  actions = VENDOR_ACTIONS,
}: {
  detail: VendorDetail;
  actions?: VendorActions;
}) {
  const vendor = detail.vendor;
  const documents = detail.documents.filter(
    (document) => document.archived_at === null,
  );
  const archived = detail.documents.length - documents.length;
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <a
          href={VENDOR_BASE_HREF}
          className="inline-flex min-h-12 w-fit items-center text-brand underline"
        >
          Back to vendors and purchases
        </a>
        <h1 className="text-title font-semibold">{vendor.name}</h1>
        <p className="text-body text-ink-muted">
          {vendor.category}
          {vendor.active ? '' : ' · Inactive, cannot receive new quotes'}
        </p>
      </header>
      <Card title="Contact">
        <dl className="grid gap-space-2 text-body">
          {(
            [
              ['Contact person', vendor.contact_person],
              ['Phone', vendor.phone],
              ['Email', vendor.email],
              ['GSTIN', vendor.gstin],
              ['Notes', vendor.notes],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="grid gap-space-1">
              <dt className="text-caption text-ink-muted">{label}</dt>
              <dd className="break-words">{value ?? 'Not recorded'}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card
        title="Ratings"
        description={ratingText(detail.rating_average, detail.rating_count)}
      >
        <div className="grid gap-space-4">
          {detail.ratings.length > 0 ? (
            <ul className="grid gap-space-2">
              {detail.ratings.map((rating) => (
                <li key={rating.id} className="text-body">
                  {rating.stars} of 5 ·{' '}
                  {rating.mine ? 'You' : (rating.rater_name ?? 'A member')}
                  {rating.comment ? `: ${rating.comment}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          <RatingForm detail={detail} actions={actions} />
        </div>
      </Card>
      <Card
        title="Documents"
        description={
          archived > 0
            ? `${archived} archived ${archived === 1 ? 'document is' : 'documents are'} kept but hidden.`
            : 'Private to the admin and committee.'
        }
      >
        <div className="grid gap-space-4">
          {documents.length > 0 ? (
            <ul className="grid gap-space-3">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="grid gap-space-2 rounded-md border border-rule p-space-3"
                >
                  <p className="text-body-strong">{document.title}</p>
                  <p className="text-caption text-ink-muted">
                    Added {formatDate(document.created_at)}
                  </p>
                  <VendorFileLink
                    path={document.path}
                    label={document.title}
                    fileLink={actions.fileLink}
                  />
                  {detail.can_manage ? (
                    <VendorQuickAction
                      action={actions.archiveDocument}
                      input={{ documentId: document.id }}
                      label={`Archive ${document.title}`}
                      confirmMessage="Archive this document? It is kept but hidden."
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-ink-muted">No documents attached.</p>
          )}
          {detail.can_manage ? (
            <DocumentForm vendorId={vendor.id} actions={actions} />
          ) : null}
        </div>
      </Card>
      <Card title="Quotes from this vendor">
        {detail.quotes.length > 0 ? (
          <ul className="grid gap-space-2">
            {detail.quotes.map((quote) => (
              <li key={quote.id} className="text-body">
                <a
                  href={`${VENDOR_BASE_HREF}/requests/${quote.request_id}`}
                  className="text-brand underline"
                >
                  {quote.request_title}
                </a>{' '}
                · {formatPaise(quote.amount_paise)} ·{' '}
                {VENDOR_REQUEST_STATUS_LABELS[quote.request_status]}
                {quote.selected ? ' · Selected' : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">No quotes yet.</p>
        )}
      </Card>
      {detail.can_manage ? (
        <>
          <Card title="Edit vendor">
            <VendorForm vendor={vendor} actions={actions} />
          </Card>
          <Card title={vendor.active ? 'Deactivate' : 'Reactivate'}>
            <VendorQuickAction
              action={actions.setActive}
              input={{
                vendorId: vendor.id,
                active: !vendor.active,
                expectedVersion: vendor.version,
              }}
              label={vendor.active ? 'Mark inactive' : 'Mark active'}
              confirmMessage={
                vendor.active
                  ? 'Mark this vendor inactive? Existing quotes stay; new quotes are blocked.'
                  : undefined
              }
            />
          </Card>
        </>
      ) : null}
    </section>
  );
}
