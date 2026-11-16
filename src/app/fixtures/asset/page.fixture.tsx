// Exercise Asset Register screens with synthetic records and injected actions; never call hosted Auth or data.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  assetCategoryActiveInputSchema,
  assetCategoryInputSchema,
  assetInputSchema,
  assetMaintenanceInputSchema,
  assetMaintenanceRemoveInputSchema,
  type AssetDetail,
  type AssetFormOptions,
  type AssetWorkspace,
} from '@/core/asset/validation';
import { AssetFormView } from '@/components/asset/asset-form';
import { AssetCategoriesView } from '@/components/asset/categories';
import { AssetDetailView } from '@/components/asset/detail';
import {
  AssetRouteState,
  type AssetActions,
  type AssetRouteStateKind,
} from '@/components/asset/shared';
import { AssetWorkspaceView } from '@/components/asset/workspace';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';

const LIFTS = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const PUMPS = 'a1d55fc3-0751-4b79-86c1-5b3e25942392';
const OLD = 'a2d55fc3-0751-4b79-86c1-5b3e25942392';
const LIFT_A = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const PUMP_1 = 'b1d55fc3-0751-4b79-86c1-5b3e25942392';
const DG_SET = 'b2d55fc3-0751-4b79-86c1-5b3e25942392';
const CONTRACT = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const TODAY = '2026-11-16';

const roleSchema = z.enum(['admin', 'committee']);
type FixtureRole = z.infer<typeof roleSchema>;
const viewSchema = z.enum(['register', 'categories', 'asset', 'new', 'edit']);
const ROUTE_STATES = [
  'loading',
  'error',
  'disabled',
  'denied',
  'not_found',
] as const satisfies readonly AssetRouteStateKind[];
const scenarioSchema = z.enum([
  'populated',
  'empty',
  'amc_off',
  ...ROUTE_STATES,
]);
type Scenario = z.infer<typeof scenarioSchema>;

const CATEGORIES: AssetWorkspace['categories'] = [
  { id: LIFTS, name: 'Lifts', active: true, version: 1, asset_count: 1 },
  { id: PUMPS, name: 'Pumps', active: true, version: 2, asset_count: 1 },
  {
    id: OLD,
    name: 'Generators and other long-named backup equipment',
    active: false,
    version: 3,
    asset_count: 1,
  },
];

function workspace(scenario: Scenario, role: FixtureRole): AssetWorkspace {
  const empty = scenario === 'empty';
  return {
    can_manage: role === 'admin',
    amc_enabled: scenario !== 'amc_off',
    today: TODAY,
    truncated: false,
    categories: empty ? [] : CATEGORIES,
    assets: empty
      ? []
      : [
          {
            id: LIFT_A,
            name: 'Lift A1',
            category_id: LIFTS,
            category_name: 'Lifts',
            location: 'Tower A lobby',
            make: 'Otis',
            model: 'Gen2',
            serial_number: 'OT-2291-A',
            status: 'active',
            warranty_end_date: '2026-12-01',
            amc_linked: true,
            last_maintenance_on: '2026-10-20',
          },
          {
            id: PUMP_1,
            name: 'Borewell pump 1',
            category_id: PUMPS,
            category_name: 'Pumps',
            location: 'Basement plant room',
            make: null,
            model: null,
            serial_number: null,
            status: 'under_repair',
            warranty_end_date: '2025-03-31',
            amc_linked: false,
            last_maintenance_on: null,
          },
          {
            id: DG_SET,
            name: 'Diesel generator with an unusually long descriptive name for wrapping',
            category_id: OLD,
            category_name: 'Generators and other long-named backup equipment',
            location: 'Behind Tower C near the service gate',
            make: 'Kirloskar',
            model: null,
            serial_number: null,
            status: 'retired',
            warranty_end_date: null,
            amc_linked: false,
            last_maintenance_on: '2024-01-15',
          },
        ],
  };
}

function detail(scenario: Scenario, role: FixtureRole): AssetDetail {
  const amc = scenario !== 'amc_off';
  const empty = scenario === 'empty';
  return {
    can_manage: role === 'admin',
    amc_enabled: amc,
    today: TODAY,
    asset: {
      id: LIFT_A,
      category_id: LIFTS,
      category_name: 'Lifts',
      name: 'Lift A1',
      location: 'Tower A lobby',
      make: 'Otis',
      model: 'Gen2',
      serial_number: 'OT-2291-A',
      purchase_date: '2021-12-01',
      purchase_cost_paise: 185_000_000,
      supplier: 'Otis Elevator Company',
      warranty_end_date: '2026-12-01',
      status: 'active',
      notes: 'Serves floors 1 to 14.',
      amc_contract_id: amc ? CONTRACT : null,
      version: 4,
      created_at: '2026-01-10T05:30:00.000Z',
      updated_at: '2026-10-20T05:30:00.000Z',
    },
    categories: CATEGORIES.slice(0, 2).map(({ id, name, active }) => ({
      id,
      name,
      active,
    })),
    maintenance: empty
      ? []
      : [
          {
            id: 'd0d55fc3-0751-4b79-86c1-5b3e25942392',
            performed_on: '2026-10-20',
            description: 'Replaced door sensor and tested emergency alarm.',
            cost_paise: 450_000,
            done_by: 'Ravi (society electrician)',
            created_at: '2026-10-20T08:00:00.000Z',
          },
        ],
    amc_contract:
      amc && !empty
        ? {
            id: CONTRACT,
            asset_label: 'Lifts A and B',
            vendor_name: 'Otis Service',
            start_date: '2026-04-01',
            end_date: '2027-03-31',
            renewed: true,
          }
        : null,
    amc_visits:
      amc && !empty
        ? [
            {
              id: 'e0d55fc3-0751-4b79-86c1-5b3e25942392',
              visit_date: '2026-09-12',
              summary: 'Quarterly service: lubricated rails, checked brakes.',
              technician: 'S. Kulkarni',
            },
          ]
        : [],
    amc_contracts:
      amc && role === 'admin'
        ? [
            {
              id: CONTRACT,
              asset_label: 'Lifts A and B',
              vendor_name: 'Otis Service',
              end_date: '2027-03-31',
            },
          ]
        : [],
  };
}

function formOptions(scenario: Scenario): AssetFormOptions {
  const item = detail(scenario, 'admin');
  return {
    amc_enabled: item.amc_enabled,
    today: TODAY,
    categories: scenario === 'empty' ? [] : item.categories,
    amc_contracts: item.amc_contracts,
  };
}

function stub(
  schema: z.ZodType,
  message: string,
): (data: FormData) => Promise<ServerActionResult<unknown>> {
  return async (data) => {
    const raw = data.get('input');
    const parsed = schema.safeParse(
      typeof raw === 'string' ? JSON.parse(raw) : null,
    );
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0]?.message ?? 'Check the form.',
      };
    return { ok: true, message: `${message} (synthetic, nothing saved)` };
  };
}

const ACTIONS: AssetActions = {
  saveCategory: stub(assetCategoryInputSchema, 'Category saved.'),
  setCategoryActive: stub(assetCategoryActiveInputSchema, 'Category updated.'),
  saveAsset: stub(assetInputSchema, 'Asset saved.'),
  addMaintenance: stub(assetMaintenanceInputSchema, 'Maintenance added.'),
  removeMaintenance: stub(
    assetMaintenanceRemoveInputSchema,
    'Maintenance entry removed.',
  ),
};

export default function AssetFixturePage() {
  const [role, setRole] = useState<FixtureRole>('admin');
  const [view, setView] = useState<z.infer<typeof viewSchema>>('register');
  const [scenario, setScenario] = useState<Scenario>('populated');
  const routeState = ROUTE_STATES.find((state) => state === scenario);

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic asset register fixture" tone="info">
          Development-only assets, categories and maintenance with injected
          actions. No hosted Auth, database writes or notifications.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-3">
          <SelectInput
            id="fixture-role"
            label="Fixture role"
            value={role}
            options={roleSchema.options.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) =>
              setRole(roleSchema.parse(event.currentTarget.value))
            }
          />
          <SelectInput
            id="fixture-view"
            label="Fixture screen"
            value={view}
            options={viewSchema.options.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) =>
              setView(viewSchema.parse(event.currentTarget.value))
            }
          />
          <SelectInput
            id="fixture-scenario"
            label="Fixture scenario"
            value={scenario}
            options={scenarioSchema.options.map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            }))}
            onChange={(event) =>
              setScenario(scenarioSchema.parse(event.currentTarget.value))
            }
          />
        </div>
      </header>
      <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
        {routeState ? (
          <AssetRouteState
            kind={routeState}
            returnHref="/fixtures/asset"
            retryHref={routeState === 'error' ? '/fixtures/asset' : undefined}
            referenceId={routeState === 'error' ? 'ERR-A55E7C0DE1' : undefined}
          />
        ) : view === 'categories' ? (
          <AssetCategoriesView
            workspace={workspace(scenario, role)}
            actions={ACTIONS}
          />
        ) : view === 'asset' ? (
          <AssetDetailView detail={detail(scenario, role)} actions={ACTIONS} />
        ) : view === 'new' || view === 'edit' ? (
          role === 'admin' ? (
            <AssetFormView
              key={`${view}-${scenario}`}
              asset={view === 'edit' ? detail(scenario, role).asset : null}
              options={formOptions(scenario)}
              actions={ACTIONS}
            />
          ) : (
            <AssetRouteState kind="denied" returnHref="/fixtures/asset" />
          )
        ) : (
          <AssetWorkspaceView workspace={workspace(scenario, role)} />
        )}
      </main>
    </>
  );
}
