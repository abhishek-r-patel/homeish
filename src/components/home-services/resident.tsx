// Let residents browse listed home-service providers by type or search, open one and rate it.
'use client';
import { useId, useState } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedNumber } from '@/core/i18n/format';
import {
  HOME_SERVICES_STAR_LABELS,
  HOME_SERVICE_TYPE_LABELS,
  filterHomeServicesProviders,
  homeServicesStarLabel,
} from '@/core/home-services/presentation';
import {
  HOME_SERVICES_COMMENT_MAX,
  HOME_SERVICE_TYPES,
  homeServicesRatingInputSchema,
  type HomeServiceType,
  type HomeServicesDirectory,
  type HomeServicesProvider,
  type HomeServicesProviderDetail,
} from '@/core/home-services/validation';
import { RadioGroup } from '@/components/ui/choice-controls';
import { Card, StatusChip } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { SearchInput, TextAreaInput } from '@/components/ui/specialized-inputs';
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

function ProviderCard({ provider }: { provider: HomeServicesProvider }) {
  const { translate: t } = useUiTranslator();
  return (
    <li className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4">
      <div className="grid gap-space-1">
        <h2 className="text-subheading break-words">{provider.name}</h2>
        <p className="text-caption text-ink-muted">
          {t(HOME_SERVICE_TYPE_LABELS[provider.service_type])}
          {provider.area ? ` · ${provider.area}` : ''}
        </p>
      </div>
      <HomeServicesRating
        average={provider.average_stars}
        count={provider.rating_count}
      />
      {provider.my_stars ? (
        <p className="text-caption text-ink-muted">
          {t('You rated {rating}.', {
            rating: t(homeServicesStarLabel(provider.my_stars)),
          })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-x-space-4">
        <HomeServicesPhone name={provider.name} phone={provider.phone} />
        <a
          href={`/home-services/${provider.id}`}
          className={HOME_SERVICES_LINK_CLASS}
          aria-label={t('Details and ratings for {name}', {
            name: provider.name,
          })}
        >
          {t('Details and ratings')}
        </a>
      </div>
    </li>
  );
}

export function HomeServicesDirectoryView({
  directory,
}: {
  directory: HomeServicesDirectory;
}) {
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  const [serviceType, setServiceType] = useState<HomeServiceType | 'all'>(
    'all',
  );
  const [query, setQuery] = useState('');
  const shown = filterHomeServicesProviders(
    directory.providers,
    serviceType,
    query,
  );
  return (
    <section className="grid min-w-0 gap-space-4">
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">{t('Home services')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Plumbers, electricians and other local help recommended by your society. Call providers directly; Homeish does not take bookings.',
          )}
        </p>
      </div>
      {directory.providers.length === 0 ? (
        <EmptyState
          title={t('No providers listed yet')}
          description={t(
            'Your society administrators have not listed any home-service providers yet. Check back later.',
          )}
        />
      ) : (
        <>
          <div className="grid gap-space-3 medium:grid-cols-2">
            <SelectInput
              id={`${id}-type`}
              label={t('Service type')}
              value={serviceType}
              onChange={(event) =>
                setServiceType(event.target.value as HomeServiceType | 'all')
              }
              options={[
                { value: 'all', label: t('All service types') },
                ...HOME_SERVICE_TYPES.map((value) => ({
                  value,
                  label: t(HOME_SERVICE_TYPE_LABELS[value]),
                })),
              ]}
            />
            <SearchInput
              id={`${id}-search`}
              label={t('Search by name, area or notes')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery('')}
            />
          </div>
          <p role="status" className="text-caption text-ink-muted">
            {t(
              directory.providers.length === 1
                ? 'Showing {count} of {total} provider.'
                : 'Showing {count} of {total} providers.',
              {
                count: formatLocalizedNumber(shown.length, locale ?? 'en'),
                total: formatLocalizedNumber(
                  directory.providers.length,
                  locale ?? 'en',
                ),
              },
            )}
          </p>
          <HomeServicesTruncatedNote truncated={directory.truncated} />
          {shown.length === 0 ? (
            <EmptyState
              title={t('No providers match')}
              description={t('Try another service type or clear the search.')}
            />
          ) : (
            <ul className="grid gap-space-3 medium:grid-cols-2">
              {shown.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function RatingForm({
  detail,
  actions,
}: {
  detail: HomeServicesProviderDetail;
  actions: HomeServicesActions;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const mine = detail.my_rating;
  const [stars, setStars] = useState(mine ? String(mine.stars) : '');
  return (
    <Card
      title={t(mine ? 'Your rating' : 'Rate this provider')}
      description={t(
        'One rating per resident. You can change it at any time. Other residents see your comment without your name; administrators and committee members can see who wrote it.',
      )}
    >
      {mine?.comment_hidden ? (
        <Banner tone="warning" title={t('Your comment is hidden')}>
          {t(
            'An administrator hid your comment. Your stars still count. Only you and the administrators can see the comment.',
          )}
        </Banner>
      ) : null}
      <ModuleActionForm
        action={actions.saveRating}
        submitLabel={t(mine ? 'Update rating' : 'Save rating')}
        input={(form) =>
          homeServicesRatingInputSchema.parse({
            providerId: detail.provider.id,
            stars: Number(form.get('stars')),
            comment: String(form.get('comment') ?? ''),
          })
        }
      >
        <RadioGroup
          id={`${id}-stars`}
          name="stars"
          label={t('Stars')}
          required
          value={stars}
          onChange={setStars}
          options={([5, 4, 3, 2, 1] as const).map((value) => ({
            value: String(value),
            label: t(HOME_SERVICES_STAR_LABELS[value]),
          }))}
        />
        <TextAreaInput
          id={`${id}-comment`}
          name="comment"
          label={t('Comment (optional)')}
          helpText={t(
            'Keep it short and about the work. Do not include phone numbers or personal details.',
          )}
          maxLength={HOME_SERVICES_COMMENT_MAX}
          defaultValue={mine?.comment ?? ''}
        />
      </ModuleActionForm>
    </Card>
  );
}

export function HomeServicesProviderView({
  detail,
  actions = HOME_SERVICES_ACTIONS,
  backHref = '/home-services',
}: {
  detail: HomeServicesProviderDetail;
  actions?: HomeServicesActions;
  backHref?: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const { provider } = detail;
  return (
    <section className="grid min-w-0 gap-space-4">
      <a href={backHref} className={HOME_SERVICES_LINK_CLASS}>
        {t('Back to home services')}
      </a>
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold break-words">
          {provider.name}
        </h1>
        <p className="text-body text-ink-muted">
          {t(HOME_SERVICE_TYPE_LABELS[provider.service_type])}
          {provider.area ? ` · ${provider.area}` : ''}
        </p>
      </div>
      {!detail.is_listed ? (
        <Banner tone="warning" title={t('Not listed for residents')}>
          {t(
            'Residents cannot see or rate this provider. It is awaiting approval, was not approved or has been archived.',
          )}
        </Banner>
      ) : null}
      <Card title={t('Contact')}>
        <div className="grid gap-space-2">
          <HomeServicesPhone name={provider.name} phone={provider.phone} />
          <HomeServicesRating
            average={provider.average_stars}
            count={provider.rating_count}
          />
          {provider.notes ? (
            <p className="text-body break-words whitespace-pre-line">
              {provider.notes}
            </p>
          ) : null}
        </div>
      </Card>
      {detail.can_rate ? (
        <RatingForm
          key={detail.my_rating?.updated_at ?? 'new'}
          detail={detail}
          actions={actions}
        />
      ) : null}
      <Card
        title={t('Comments')}
        description={
          detail.can_moderate
            ? t('Hiding a comment keeps its stars in the average.')
            : undefined
        }
      >
        {detail.comments.length === 0 ? (
          <p className="text-body text-ink-muted">{t('No comments yet.')}</p>
        ) : (
          <ul className="grid gap-space-3">
            {detail.comments.map((comment) => (
              <li
                key={comment.id}
                className="grid min-w-0 gap-space-1 border-b border-rule pb-space-3 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-space-2">
                  <span className="text-body-strong">
                    {t(homeServicesStarLabel(comment.stars))}
                  </span>
                  {comment.is_mine ? (
                    <span className="text-caption text-ink-muted">
                      {t('Your comment')}
                    </span>
                  ) : null}
                  {comment.comment_hidden ? (
                    <StatusChip status="home_services.comment_hidden" />
                  ) : null}
                </div>
                <HomeServicesCommentText comment={comment.comment} />
                <p className="text-caption text-ink-muted">
                  {comment.rater_name ? `${comment.rater_name} · ` : ''}
                  {formatHomeServicesUiDate(comment.updated_at, locale)}
                </p>
                {detail.can_moderate ? (
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
