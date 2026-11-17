// Show one vendor with its private documents, ratings and quotes to the admin and committee.
'use client';
import { useId, useState } from 'react';
import { VENDOR_REQUEST_STATUS_LABELS } from '@/core/vendor/presentation';
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
import { useVendorPresentation } from './presentation';

function DocumentForm({
  vendorId,
  actions,
}: {
  vendorId: string;
  actions: VendorActions;
}) {
  const { t } = useVendorPresentation();
  const id = useId();
  const [path, setPath] = useState<string | null>(null);
  return (
    <ModuleActionForm
      action={actions.addDocument}
      idempotent
      submitLabel={t('Attach document')}
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
        label={t('Document title')}
        helpText={t('For example Trade licence or Insurance certificate.')}
        required
        maxLength={120}
        autoComplete="off"
      />
      <VendorFilePicker
        label={t('Document file')}
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
  const { t } = useVendorPresentation();
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.saveRating}
      submitLabel={t(detail.my_rating ? 'Update my rating' : 'Save my rating')}
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
        label={t('Stars')}
        required
        defaultValue={String(detail.my_rating?.stars ?? 5)}
        options={[5, 4, 3, 2, 1].map((stars) => ({
          value: String(stars),
          label: t(stars === 1 ? '{count} star' : '{count} stars', {
            count: stars,
          }),
        }))}
      />
      <TextAreaInput
        id={`${id}-comment`}
        name="comment"
        label={t('Comment (optional)')}
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
  const { t, money, date, rating: ratingSummary } = useVendorPresentation();
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
          {t('Back to vendors and purchases')}
        </a>
        <h1 className="text-title font-semibold">{vendor.name}</h1>
        <p className="text-body text-ink-muted">
          {vendor.category}
          {vendor.active ? '' : t(' · Inactive, cannot receive new quotes')}
        </p>
      </header>
      <Card title={t('Contact')}>
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
              <dt className="text-caption text-ink-muted">{t(label)}</dt>
              <dd className="break-words">{value ?? t('Not recorded')}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card
        title={t('Ratings')}
        description={ratingSummary(detail.rating_average, detail.rating_count)}
      >
        <div className="grid gap-space-4">
          {detail.ratings.length > 0 ? (
            <ul className="grid gap-space-2">
              {detail.ratings.map((rating) => (
                <li key={rating.id} className="text-body">
                  {t('{count} of 5', { count: rating.stars })} ·{' '}
                  {rating.mine
                    ? t('You')
                    : (rating.rater_name ?? t('A member'))}
                  {rating.comment ? `: ${rating.comment}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          <RatingForm detail={detail} actions={actions} />
        </div>
      </Card>
      <Card
        title={t('Documents')}
        description={
          archived > 0
            ? t(
                archived === 1
                  ? '{count} archived document is kept but hidden.'
                  : '{count} archived documents are kept but hidden.',
                { count: archived },
              )
            : t('Private to the admin and committee.')
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
                    {t('Added {date}', { date: date(document.created_at) })}
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
                      label={t('Archive {title}', { title: document.title })}
                      confirmMessage={t(
                        'Archive this document? It is kept but hidden.',
                      )}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-ink-muted">
              {t('No documents attached.')}
            </p>
          )}
          {detail.can_manage ? (
            <DocumentForm vendorId={vendor.id} actions={actions} />
          ) : null}
        </div>
      </Card>
      <Card title={t('Quotes from this vendor')}>
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
                · {money(quote.amount_paise)} ·{' '}
                {t(VENDOR_REQUEST_STATUS_LABELS[quote.request_status])}
                {quote.selected ? t(' · Selected') : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">{t('No quotes yet.')}</p>
        )}
      </Card>
      {detail.can_manage ? (
        <>
          <Card title={t('Edit vendor')}>
            <VendorForm vendor={vendor} actions={actions} />
          </Card>
          <Card title={t(vendor.active ? 'Deactivate' : 'Reactivate')}>
            <VendorQuickAction
              action={actions.setActive}
              input={{
                vendorId: vendor.id,
                active: !vendor.active,
                expectedVersion: vendor.version,
              }}
              label={t(vendor.active ? 'Mark inactive' : 'Mark active')}
              confirmMessage={
                vendor.active
                  ? t(
                      'Mark this vendor inactive? Existing quotes stay; new quotes are blocked.',
                    )
                  : undefined
              }
            />
          </Card>
        </>
      ) : null}
    </section>
  );
}
