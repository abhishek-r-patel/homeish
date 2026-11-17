// Let admins add, rename and deactivate the society's asset categories; committee views them.
'use client';
import { useId } from 'react';
import {
  assetCategoryActiveInputSchema,
  assetCategoryInputSchema,
  type AssetWorkspace,
} from '@/core/asset/validation';
import { Card } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';
import { formatLocalizedNumber } from '@/core/i18n/format';
import {
  ASSET_ACTIONS,
  ASSET_BASE_HREF,
  ASSET_LINK_CLASS,
  AssetQuickAction,
  useAssetCopy,
  type AssetActions,
} from './shared';

type Category = AssetWorkspace['categories'][number];

function CategoryForm({
  category,
  actions,
}: {
  category: Category | null;
  actions: AssetActions;
}) {
  const { t } = useAssetCopy();
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.saveCategory}
      idempotent
      submitLabel={t(category ? 'Rename category' : 'Add category')}
      input={(form, clientRequestId) =>
        assetCategoryInputSchema.parse({
          categoryId: category?.id ?? null,
          name: String(form.get('name') ?? ''),
          expectedVersion: category?.version ?? null,
          clientRequestId,
        })
      }
    >
      <TextInput
        id={`${id}-name`}
        name="name"
        label={
          category
            ? t('New name for {name}', { name: category.name })
            : t('Category name')
        }
        helpText={category ? undefined : t('For example Lifts, Pumps or CCTV.')}
        required
        maxLength={60}
        defaultValue={category?.name}
        autoComplete="off"
      />
    </ModuleActionForm>
  );
}

export function AssetCategoriesView({
  workspace,
  actions = ASSET_ACTIONS,
}: {
  workspace: AssetWorkspace;
  actions?: AssetActions;
}) {
  const { locale, t } = useAssetCopy();
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <a href={ASSET_BASE_HREF} className={ASSET_LINK_CLASS}>
          {t('Back to the register')}
        </a>
        <h1 className="text-title font-semibold">{t('Asset categories')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Categories group the register. Inactive categories stay on existing assets but cannot be chosen for new ones.',
          )}
        </p>
      </header>
      {workspace.can_manage ? (
        <Card title={t('Add a category')}>
          <CategoryForm category={null} actions={actions} />
        </Card>
      ) : null}
      <Card title={t('Categories')}>
        {workspace.categories.length === 0 ? (
          <EmptyState
            title={t('No categories yet')}
            description={
              workspace.can_manage
                ? t('Add the first category above.')
                : t('An admin adds categories.')
            }
          />
        ) : (
          <ul className="grid gap-space-3">
            {workspace.categories.map((category) => (
              <li
                key={category.id}
                className="grid min-w-0 gap-space-3 rounded-md border border-rule p-space-4"
              >
                <div className="grid gap-space-1">
                  <p className="text-body-strong break-words">
                    {category.name}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {t(category.active ? 'Active' : 'Inactive')} ·{' '}
                    {t('Assets: {count}', {
                      count: formatLocalizedNumber(
                        category.asset_count,
                        locale,
                      ),
                    })}
                  </p>
                </div>
                {workspace.can_manage ? (
                  <>
                    <CategoryForm category={category} actions={actions} />
                    <AssetQuickAction
                      action={actions.setCategoryActive}
                      input={assetCategoryActiveInputSchema.parse({
                        categoryId: category.id,
                        active: !category.active,
                        expectedVersion: category.version,
                      })}
                      label={
                        category.active
                          ? t('Deactivate category')
                          : t('Activate category')
                      }
                    />
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
