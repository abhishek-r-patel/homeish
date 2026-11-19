// Show one vendor with its private documents, ratings and quotes to the admin and committee.
'use client';
import { useId, useState } from 'react';
import { VENDOR_REQUEST_STATUS_LABELS } from '@/core/vendor/presentation';
import {
  vendorBlacklistInputSchema,
  vendorDocumentInputSchema,
  vendorRatingInputSchema,
  type VendorDetail,
} from '@/core/vendor/validation';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
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
import {
  VENDOR_REGISTER_ANCHORS,
  VendorRegisters,
  VendorSummaryStrip,
  type VendorRegisterLoads,
} from './registers';

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

function BlacklistForm({
  detail,
  actions,
}: {
  detail: VendorDetail;
  actions: VendorActions;
}) {
  const { t } = useVendorPresentation();
  const id = useId();
  const vendor = detail.vendor;
  return (
    <ModuleActionForm
      action={actions.setBlacklisted}
      submitLabel={t(
        vendor.blacklisted ? 'Remove blacklist' : 'Blacklist vendor',
      )}
      confirmMessage={t(
        vendor.blacklisted
          ? 'Remove this vendor from the blacklist? The reason will be recorded.'
          : 'Blacklist this vendor? New purchases and assignments will show a warning but will not be blocked.',
      )}
      input={(form) =>
        vendorBlacklistInputSchema.parse({
          vendorId: vendor.id,
          blacklisted: !vendor.blacklisted,
          reason: String(form.get('reason') ?? ''),
          expectedVersion: vendor.version,
        })
      }
    >
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label={t('Reason for blacklist change')}
        helpText={t('This reason is recorded in the audit log.')}
        required
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

export function VendorDetailView({
  detail,
  registers,
  actions = VENDOR_ACTIONS,
}: {
  detail: VendorDetail;
  registers?: VendorRegisterLoads;
  actions?: VendorActions;
}) {
  const { t, money, date, rating: ratingSummary } = useVendorPresentation();
  const vendor = detail.vendor;
  const documents = detail.documents.filter(
    (document) => document.archived_at === null,
  );
  const archived = detail.documents.length - documents.length;
  const contactRows: { label: string; value: string | null }[] = [
    { label: 'Contact person', value: vendor.contact_person },
    { label: 'Phone', value: vendor.phone },
    { label: 'Email', value: vendor.email },
    { label: 'GSTIN', value: vendor.gstin },
    ...(detail.can_manage ? [{ label: 'PAN', value: vendor.pan }] : []),
    {
      label: 'Payment terms',
      value:
        vendor.payment_terms_days === null
          ? null
          : vendor.payment_terms_days === 0
            ? t('Due immediately')
            : t('{count} days', { count: vendor.payment_terms_days }),
    },
    {
      label: 'Onboarded date',
      value: vendor.onboarded_date ? date(vendor.onboarded_date) : null,
    },
    { label: 'Notes', value: vendor.notes },
  ];
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
          {vendor.blacklisted ? ` · ${t('Blacklisted vendor')}` : ''}
        </p>
      </header>
      {vendor.blacklisted ? (
        <Banner tone="warning" title={t('Blacklisted vendor')}>
          <p>
            {t(
              'New purchases and service-request assignments show a warning but are not blocked.',
            )}
          </p>
          <p>{vendor.blacklist_reason}</p>
        </Banner>
      ) : null}
      {registers ? (
        <VendorSummaryStrip load={registers.summary} scoped />
      ) : null}
      <Card title={t('Contact')}>
        <dl className="grid gap-space-2 text-body">
          {contactRows.map(({ label, value }) => (
            <div key={label} className="grid gap-space-1">
              <dt className="text-caption text-ink-muted">{t(label)}</dt>
              <dd className="break-words">{value ?? t('Not recorded')}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div id={VENDOR_REGISTER_ANCHORS.ratings} className="min-w-0">
        <Card
          title={t('Ratings')}
          description={ratingSummary(
            detail.rating_average,
            detail.rating_count,
          )}
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
      </div>
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
      {registers ? (
        <VendorRegisters
          registers={registers}
          vendorId={vendor.id}
          actions={actions}
        />
      ) : null}
      {detail.can_manage ? (
        <>
          <Card title={t('Edit vendor')}>
            <VendorForm vendor={vendor} actions={actions} />
          </Card>
          <Card
            title={t(
              vendor.blacklisted ? 'Blacklist status' : 'Blacklist vendor',
            )}
          >
            <BlacklistForm detail={detail} actions={actions} />
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
