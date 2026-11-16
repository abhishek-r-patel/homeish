// Shared Asset Register route states, action wiring and small helpers.
'use client';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import {
  addAssetMaintenanceAction,
  removeAssetMaintenanceAction,
  saveAssetAction,
  saveAssetCategoryAction,
  setAssetCategoryActiveAction,
} from '@/app/(admin)/admin/assets/actions';
import { ErrorPanel, Skeleton } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';

export type AssetActions = {
  saveCategory: ModuleFormAction;
  setCategoryActive: ModuleFormAction;
  saveAsset: ModuleFormAction;
  addMaintenance: ModuleFormAction;
  removeMaintenance: ModuleFormAction;
};

export const ASSET_ACTIONS: AssetActions = {
  saveCategory: saveAssetCategoryAction,
  setCategoryActive: setAssetCategoryActiveAction,
  saveAsset: saveAssetAction,
  addMaintenance: addAssetMaintenanceAction,
  removeMaintenance: removeAssetMaintenanceAction,
};

export const ASSET_BASE_HREF = '/admin/assets';

export const ASSET_LINK_CLASS =
  'inline-flex min-h-12 items-center text-brand underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export type AssetRouteStateKind =
  'loading' | 'error' | 'disabled' | 'denied' | 'not_found';

export function AssetRouteState({
  kind,
  title = 'Asset Register',
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: AssetRouteStateKind;
  title?: string;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  if (kind === 'disabled')
    return (
      <ModuleDisabledPage embedded moduleKey="asset" returnHref={returnHref} />
    );
  const copy = {
    loading: {
      title: 'Loading the asset register',
      message: 'Loading the asset register.',
    },
    denied: {
      title: 'The Asset Register is for the admin and committee',
      message:
        'You do not have access to this view. Return to your workspace or ask an administrator to review your access.',
    },
    not_found: {
      title: 'Not found',
      message: 'This asset does not exist in your society.',
    },
    error: {
      title: 'Could not load the asset register',
      message: 'Nothing has changed. Retry in a moment.',
    },
  }[kind];
  return (
    <section className="grid min-w-0 gap-space-4">
      <h1 className="text-title font-semibold">{title}</h1>
      {kind === 'loading' ? (
        <Skeleton label={copy.title} rows={5} />
      ) : (
        <ErrorPanel
          title={copy.title}
          message={message ?? copy.message}
          referenceId={referenceId}
          action={
            <div className="flex flex-wrap gap-space-3">
              {retryHref ? (
                <a href={retryHref} className={ASSET_LINK_CLASS}>
                  Retry
                </a>
              ) : null}
              <a href={returnHref} className={ASSET_LINK_CLASS}>
                Back
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

/** Keeps a one-button action, such as deactivate or remove, consistent everywhere. */
export function AssetQuickAction({
  action,
  input,
  label,
  confirmMessage,
}: {
  action: ModuleFormAction;
  input: unknown;
  label: string;
  confirmMessage?: string;
}) {
  return (
    <ModuleActionForm
      action={action}
      input={() => input}
      submitLabel={label}
      confirmMessage={confirmMessage}
    >
      {null}
    </ModuleActionForm>
  );
}
