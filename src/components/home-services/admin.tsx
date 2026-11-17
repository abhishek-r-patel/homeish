// Let administrators curate providers, review committee suggestions and moderate comments; committee members view and suggest.
'use client';
import { useId } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import {
  HOME_SERVICE_TYPE_LABELS,
  homeServicesManagedState,
  homeServicesStarLabel,
} from '@/core/home-services/presentation';
import {
  HOME_SERVICES_AREA_MAX,
  HOME_SERVICES_NAME_MAX,
  HOME_SERVICES_NOTES_MAX,
  HOME_SERVICES_REASON_MAX,
  HOME_SERVICE_TYPES,
  homeServicesProviderInputSchema,
  homeServicesReviewInputSchema,
  homeServicesSuggestionInputSchema,
  type HomeServicesAdminWorkspace,
  type HomeServicesManagedProvider,
} from '@/core/home-services/validation';
import { Card, StatusChip } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  HOME_SERVICES_ACTIONS,
  HOME_SERVICES_LINK_CLASS,
  HomeServicesPhone,
  HomeServicesCommentText,
  HomeServicesQuickAction,
  HomeServicesRating,
  HomeServicesTruncatedNote,
  formatHomeServicesUiDate,
  type HomeServicesActions,
} from './shared';

const SUMMARY_CLASS =
  'min-h-12 cursor-pointer content-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus';

function text(form: FormData, key: string) {
  return String(form.get(key) ?? '');
}

function ProviderFields({
  provider,
}: {
  provider: HomeServicesManagedProvider | null;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <>
      <TextInput
        id={`${id}-name`}
        name="name"
        label={t('Provider or business name')}
        required
        maxLength={HOME_SERVICES_NAME_MAX}
        defaultValue={provider?.name}
        autoComplete="off"
      />
      <SelectInput
        id={`${id}-type`}
        name="serviceType"
        label={t('Service type')}
        required
        defaultValue={provider?.service_type ?? 'plumber'}
        options={HOME_SERVICE_TYPES.map((value) => ({
          value,
          label: t(HOME_SERVICE_TYPE_LABELS[value]),
        }))}
      />
      <TextInput
        id={`${id}-phone`}
        name="phone"
        label={t('Phone number')}
        type="tel"
        inputMode="tel"
        required
        maxLength={20}
        helpText={t(
          '6 to 20 digits. Spaces, dashes and a leading + are allowed.',
        )}
        defaultValue={provider?.phone}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-area`}
        name="area"
        label={t('Area served (optional)')}
        helpText={t('For example Sector 5 or nearby societies.')}
        maxLength={HOME_SERVICES_AREA_MAX}
        defaultValue={provider?.area ?? ''}
        autoComplete="off"
      />
      <TextAreaInput
        id={`${id}-notes`}
        name="notes"
        label={t('Notes (optional)')}
        helpText={t(
          'Timings, specialities or how to book. Residents can see these notes.',
        )}
        maxLength={HOME_SERVICES_NOTES_MAX}
        defaultValue={provider?.notes ?? ''}
      />
    </>
  );
}

function ProviderForm({
  provider,
  actions,
}: {
  provider: HomeServicesManagedProvider | null;
  actions: HomeServicesActions;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={actions.saveProvider}
      idempotent
      submitLabel={
        provider ? t('Save {name}', { name: provider.name }) : t('Add provider')
      }
      input={(form, clientRequestId) =>
        homeServicesProviderInputSchema.parse({
          providerId: provider?.id ?? null,
          name: text(form, 'name'),
          serviceType: form.get('serviceType'),
          phone: text(form, 'phone'),
          area: text(form, 'area'),
          notes: text(form, 'notes'),
          expectedVersion: provider?.version ?? null,
          clientRequestId: clientRequestId ?? crypto.randomUUID(),
        })
      }
    >
      <ProviderFields provider={provider} />
    </ModuleActionForm>
  );
}

function SuggestForm({ actions }: { actions: HomeServicesActions }) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={actions.suggestProvider}
      idempotent
      submitLabel={t('Send suggestion')}
      input={(form, clientRequestId) =>
        homeServicesSuggestionInputSchema.parse({
          name: text(form, 'name'),
          serviceType: form.get('serviceType'),
          phone: text(form, 'phone'),
          area: text(form, 'area'),
          notes: text(form, 'notes'),
          clientRequestId: clientRequestId ?? crypto.randomUUID(),
        })
      }
    >
      <ProviderFields provider={null} />
    </ModuleActionForm>
  );
}

function ReviewForms({
  provider,
  actions,
}: {
  provider: HomeServicesManagedProvider;
  actions: HomeServicesActions;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <div className="grid gap-space-2">
      <HomeServicesQuickAction
        action={actions.reviewSuggestion}
        input={homeServicesReviewInputSchema.parse({
          providerId: provider.id,
          approve: true,
          reason: null,
          expectedVersion: provider.version,
        })}
        label={t('Approve {name}', { name: provider.name })}
      />
      <details>
        <summary className={SUMMARY_CLASS}>{t('Do not approve')}</summary>
        <ModuleActionForm
          action={actions.reviewSuggestion}
          submitLabel={t('Do not approve {name}', { name: provider.name })}
          input={(form) =>
            homeServicesReviewInputSchema.parse({
              providerId: provider.id,
              approve: false,
              reason: text(form, 'reason'),
              expectedVersion: provider.version,
            })
          }
        >
          <TextAreaInput
            id={`${id}-reason`}
            name="reason"
            label={t('Reason (optional)')}
            helpText={t(
              'The committee member who suggested it can see this reason.',
            )}
            maxLength={HOME_SERVICES_REASON_MAX}
          />
        </ModuleActionForm>
      </details>
    </div>
  );
}

function ManagedProviderItem({
  provider,
  canManage,
  actions,
}: {
  provider: HomeServicesManagedProvider;
  canManage: boolean;
  actions: HomeServicesActions;
}) {
  const { locale, translate: t } = useUiTranslator();
  const date = (value: string) => formatHomeServicesUiDate(value, locale);
  const state = homeServicesManagedState(provider);
  return (
    <li className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4">
      <div className="flex flex-wrap items-start justify-between gap-space-2">
        <div className="grid min-w-0 gap-space-1">
          <h3 className="text-body-strong break-words">{provider.name}</h3>
          <p className="text-caption text-ink-muted">
            {t(HOME_SERVICE_TYPE_LABELS[provider.service_type])}
            {provider.area ? ` · ${provider.area}` : ''}
          </p>
        </div>
        <StatusChip status={`home_services.${state}`} />
      </div>
      <HomeServicesPhone name={provider.name} phone={provider.phone} />
      {state === 'listed' || state === 'archived' ? (
        <HomeServicesRating
          average={provider.average_stars}
          count={provider.rating_count}
        />
      ) : null}
      {provider.notes ? (
        <p className="text-body break-words whitespace-pre-line">
          {provider.notes}
        </p>
      ) : null}
      {provider.origin === 'suggestion' ? (
        <p className="text-caption text-ink-muted">
          {t('Suggested by {name} on {date}', {
            name: provider.suggested_by_name ?? t('a former member'),
            date: date(provider.created_at),
          })}
        </p>
      ) : null}
      {state === 'rejected' ? (
        <p className="text-caption text-ink-muted break-words">
          {provider.reviewed_at
            ? t('Not approved on {date}', { date: date(provider.reviewed_at) })
            : t('Not approved')}
          {provider.review_reason
            ? `: ${provider.review_reason}`
            : t('. No reason given.')}
        </p>
      ) : null}
      {state === 'archived' && provider.archived_at ? (
        <p className="text-caption text-ink-muted">
          {t('Archived on {date}. Ratings are kept.', {
            date: date(provider.archived_at),
          })}
        </p>
      ) : null}
      <a
        href={`/admin/home-services/${provider.id}`}
        className={HOME_SERVICES_LINK_CLASS}
        aria-label={t('Details and comments for {name}', {
          name: provider.name,
        })}
      >
        {t('Details and comments')}
      </a>
      {canManage && state === 'pending' ? (
        <ReviewForms provider={provider} actions={actions} />
      ) : null}
      {canManage && state === 'listed' ? (
        <>
          <details>
            <summary className={SUMMARY_CLASS}>
              {t('Edit {name}', { name: provider.name })}
            </summary>
            <ProviderForm provider={provider} actions={actions} />
          </details>
          <HomeServicesQuickAction
            action={actions.archiveProvider}
            input={{
              providerId: provider.id,
              expectedVersion: provider.version,
            }}
            label={t('Archive {name}', { name: provider.name })}
            confirmMessage={t(
              'Archive this provider? Residents will no longer see or rate it. This cannot be undone; add the provider again if needed.',
            )}
          />
        </>
      ) : null}
    </li>
  );
}

function ProviderList({
  title,
  description,
  providers,
  empty,
  canManage,
  actions,
}: {
  title: string;
  description?: string;
  providers: readonly HomeServicesManagedProvider[];
  empty: string;
  canManage: boolean;
  actions: HomeServicesActions;
}) {
  return (
    <Card title={title} description={description}>
      {providers.length === 0 ? (
        <p className="text-body text-ink-muted">{empty}</p>
      ) : (
        <ul className="grid gap-space-3 medium:grid-cols-2">
          {providers.map((provider) => (
            <ManagedProviderItem
              key={provider.id}
              provider={provider}
              canManage={canManage}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function HomeServicesAdminView({
  workspace,
  actions = HOME_SERVICES_ACTIONS,
}: {
  workspace: HomeServicesAdminWorkspace;
  actions?: HomeServicesActions;
}) {
  const { locale, translate: t } = useUiTranslator();
  const { can_manage: canManage, can_suggest: canSuggest } = workspace;
  const pending = workspace.providers.filter(
    (item) => homeServicesManagedState(item) === 'pending',
  );
  const listed = workspace.providers.filter(
    (item) => homeServicesManagedState(item) === 'listed',
  );
  const past = workspace.providers.filter((item) => {
    const state = homeServicesManagedState(item);
    return state === 'archived' || state === 'rejected';
  });
  return (
    <section className="grid min-w-0 gap-space-4">
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">{t('Home services')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Curate the local providers residents can call. Residents rate them; there are no provider logins or bookings.',
          )}
        </p>
      </div>
      {!canManage ? (
        <Banner title={t('Committee view')}>
          {t(
            'You can see every provider and suggest new ones. An administrator approves suggestions before residents see them.',
          )}
        </Banner>
      ) : null}
      {canManage ? (
        <Card title={t('Add a provider')}>
          <details>
            <summary className={SUMMARY_CLASS}>{t('Add a provider')}</summary>
            <ProviderForm provider={null} actions={actions} />
          </details>
        </Card>
      ) : null}
      {canSuggest ? (
        <Card
          title={t('Suggest a provider')}
          description={t(
            'An administrator reviews your suggestion before residents see it.',
          )}
        >
          <details>
            <summary className={SUMMARY_CLASS}>
              {t('Suggest a provider')}
            </summary>
            <SuggestForm actions={actions} />
          </details>
        </Card>
      ) : null}
      <HomeServicesTruncatedNote truncated={workspace.truncated} />
      {workspace.providers.length === 0 ? (
        <EmptyState
          title={t('No providers yet')}
          description={t(
            canManage
              ? 'Add the first provider so residents can find trusted local help.'
              : 'No providers have been listed or suggested yet.',
          )}
        />
      ) : (
        <>
          <ProviderList
            title={t('Awaiting approval')}
            description={t(
              'Committee suggestions are hidden from residents until approved.',
            )}
            providers={pending}
            empty={t('No suggestions are waiting.')}
            canManage={canManage}
            actions={actions}
          />
          <ProviderList
            title={t('Listed providers')}
            providers={listed}
            empty={t('No providers are listed for residents.')}
            canManage={canManage}
            actions={actions}
          />
          {past.length > 0 ? (
            <ProviderList
              title={t('Archived and not approved')}
              providers={past}
              empty=""
              canManage={canManage}
              actions={actions}
            />
          ) : null}
        </>
      )}
      <Card
        title={t('Recent comments')}
        description={t(
          "Hiding a comment removes it from residents' view. The stars still count in the average.",
        )}
      >
        {workspace.comments.length === 0 ? (
          <p className="text-body text-ink-muted">{t('No comments yet.')}</p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.comments.map((comment) => (
              <li
                key={comment.id}
                className="grid min-w-0 gap-space-1 border-b border-rule pb-space-3 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-space-2">
                  <span className="text-body-strong break-words">
                    {comment.provider_name}
                  </span>
                  <span className="text-caption text-ink-muted">
                    {t(homeServicesStarLabel(comment.stars))}
                  </span>
                  {comment.comment_hidden ? (
                    <StatusChip status="home_services.comment_hidden" />
                  ) : null}
                </div>
                <HomeServicesCommentText comment={comment.comment} />
                <p className="text-caption text-ink-muted">
                  {comment.rater_name ? `${comment.rater_name} · ` : ''}
                  {formatHomeServicesUiDate(comment.updated_at, locale)}
                </p>
                {canManage ? (
                  <HomeServicesQuickAction
                    action={actions.setCommentVisibility}
                    input={{
                      ratingId: comment.id,
                      hidden: !comment.comment_hidden,
                    }}
                    label={t(
                      comment.comment_hidden ? 'Show comment' : 'Hide comment',
                    )}
                    confirmMessage={
                      comment.comment_hidden
                        ? undefined
                        : t(
                            'Hide this comment from residents? The stars still count.',
                          )
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
