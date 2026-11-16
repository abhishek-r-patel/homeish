// Verify asset register privacy, roles, module gating, AMC links, validation, idempotency and audit.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';
import {
  assetDetailSchema,
  assetFormOptionsSchema,
  assetWorkspaceSchema,
} from '../../src/core/asset/validation';

const ACTORS = [
  'admin',
  'committee',
  'guard',
  'resident',
  'foreignAdmin',
] as const;
type Actor = (typeof ACTORS)[number];

describe.skipIf(!hasDatabase)('asset register database contracts', () => {
  let database: TestDatabase;
  const users = new Map<Actor, string>();
  let society = '';
  let foreignSociety = '';
  let lifts = '';

  const user = (actor: Actor) => {
    const id = users.get(actor);
    if (!id) throw new Error(`Missing synthetic ${actor}.`);
    return id;
  };
  const asActor = <T>(actor: Actor, run: (client: Client) => Promise<T>) =>
    database.asRole('authenticated', { sub: user(actor) }, run, {
      commit: true,
    });
  const call = async (actor: Actor, name: string, args: unknown[]) => {
    const placeholders = args.map((_, index) => `$${index + 1}`).join(',');
    const result = await asActor(actor, (client) =>
      client.query<{ value: unknown }>(
        `select public.${name}(${placeholders}) as value`,
        args,
      ),
    );
    return result.rows[0]?.value;
  };
  const code = async (action: Promise<unknown>) => (await dbError(action)).code;
  const superuser = <T>(run: (client: Client) => Promise<T>) =>
    database.asSuperuser(run);
  const setModule = (target: string, moduleKey: string, enabled: boolean) =>
    superuser((client) =>
      client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,$2,$3,'{}')
         on conflict(society_id,module_key) do update set enabled=excluded.enabled`,
        [target, moduleKey, enabled],
      ),
    );
  const saveCategory = async (
    name: string,
    options: {
      actor?: Actor;
      categoryId?: string | null;
      version?: number | null;
      clientRequestId?: string;
      targetSociety?: string;
    } = {},
  ) =>
    (await call(options.actor ?? 'admin', 'asset_category_save', [
      options.targetSociety ?? society,
      options.categoryId ?? null,
      name,
      options.version ?? null,
      options.clientRequestId ?? crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
  type AssetFields = {
    assetId: string | null;
    categoryId: string;
    name: string;
    location: string;
    purchaseDate: string | null;
    warrantyEndDate: string | null;
    status: string;
    amcContractId: string | null;
    expectedAmcEnabled: boolean;
    expectedVersion: number | null;
    clientRequestId: string;
    targetSociety: string;
  };
  const saveAsset = async (
    fields: Partial<AssetFields> = {},
    actor: Actor = 'admin',
  ) => {
    const value: AssetFields = {
      assetId: null,
      categoryId: lifts,
      name: 'Lift A1',
      location: 'Tower A lobby',
      purchaseDate: '2021-12-01',
      warrantyEndDate: '2031-12-01',
      status: 'active',
      amcContractId: null,
      expectedAmcEnabled: true,
      expectedVersion: null,
      clientRequestId: crypto.randomUUID(),
      targetSociety: society,
      ...fields,
    };
    return (await call(actor, 'asset_save', [
      value.targetSociety,
      value.assetId,
      value.categoryId,
      value.name,
      value.location,
      'Otis',
      null,
      'SN-1',
      value.purchaseDate,
      18_500_000,
      null,
      value.warrantyEndDate,
      value.status,
      null,
      value.amcContractId,
      value.expectedAmcEnabled,
      value.expectedVersion,
      value.clientRequestId,
      crypto.randomUUID(),
    ])) as string;
  };
  const detail = async (asset: string, actor: Actor = 'admin') =>
    assetDetailSchema.parse(await call(actor, 'asset_get', [society, asset]));
  const addMaintenance = async (
    asset: string,
    performedOn: string,
    clientRequestId = crypto.randomUUID(),
    actor: Actor = 'admin',
  ) =>
    (await call(actor, 'asset_maintenance_add', [
      society,
      asset,
      performedOn,
      'Replaced door sensor',
      45_000,
      'Society electrician',
      clientRequestId,
      crypto.randomUUID(),
    ])) as string;
  const createContract = (
    target: string,
    owner: Actor,
    label: string,
    predecessor: string | null = null,
  ) =>
    superuser(
      async (client) =>
        (
          await client.query<{ id: string }>(
            `insert into public.amc_contracts(society_id,asset_label,vendor_name,vendor_contact,
               start_date,end_date,cost_paise,payment_terms,visit_frequency,predecessor_id,
               created_by,updated_by,client_request_id)
             values($1,$2,'Lift Service Co','+91 98765 43210','2026-01-01','2026-12-31',
               100000,'Quarterly','Quarterly',$3,$4,$4,gen_random_uuid())
             returning id`,
            [target, label, predecessor, user(owner)],
          )
        ).rows[0]!.id,
    );
  const addVisit = (contract: string, date: string, summary: string) =>
    superuser((client) =>
      client.query(
        `insert into public.amc_visits(society_id,contract_id,visit_date,summary,technician,
           created_by,updated_by,client_request_id)
         values($1,$2,$3,$4,'S. Kulkarni',$5,$5,gen_random_uuid())`,
        [society, contract, date, summary, user('admin')],
      ),
    );
  const audits = (entity: string) =>
    superuser(async (client) =>
      (
        await client.query<{ action: string; actor_role: string }>(
          `select action,actor_role from public.audit_logs
             where society_id=$1 and entity_id=$2 order by created_at`,
          [society, entity],
        )
      ).rows.map((row) => row.action),
    );
  const auditRows = (entity: string) =>
    superuser(
      async (client) =>
        (
          await client.query<{
            action: string;
            before: Record<string, unknown> | null;
            after: Record<string, unknown> | null;
          }>(
            `select action,"before","after" from public.audit_logs
               where society_id=$1 and entity_id=$2 order by created_at`,
            [society, entity],
          )
        ).rows,
    );

  beforeAll(async () => {
    database = await createTestDatabase();
    await superuser(async (client) => {
      for (const actor of ACTORS) {
        const email = `asset-${actor.toLowerCase()}@example.test`;
        const id = await newAuthUser(client, email);
        users.set(actor, id);
        await client.query(
          `insert into public.profiles(id,email,full_name) values($1,$2,$3)
           on conflict(id) do update set full_name=excluded.full_name`,
          [id, email, `Synthetic ${actor}`],
        );
      }
      society = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Asset A',$1) returning id`,
          [user('admin')],
        )
      ).rows[0]!.id;
      foreignSociety = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Asset B',$1) returning id`,
          [user('foreignAdmin')],
        )
      ).rows[0]!.id;
      for (const actor of ACTORS) {
        const role = actor === 'foreignAdmin' ? 'admin' : actor;
        await client.query(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,array[$3]::text[],'active')`,
          [
            actor === 'foreignAdmin' ? foreignSociety : society,
            user(actor),
            role,
          ],
        );
      }
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'asset',true,'{}'),($1,'amc',true,'{}'),
           ($2,'core',true,'{}'),($2,'asset',true,'{}'),($2,'amc',true,'{}')`,
        [society, foreignSociety],
      );
    });
    lifts = await saveCategory('Lifts');
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('ships disabled by default and refuses every call while disabled', async () => {
    const fresh = await superuser(async (client) => {
      const id = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Asset C',$1) returning id`,
          [user('admin')],
        )
      ).rows[0]!.id;
      return (
        await client.query<{ enabled: boolean | null }>(
          `select (select enabled from public.module_configs
             where society_id=$1 and module_key='asset') as enabled`,
          [id],
        )
      ).rows[0]!.enabled;
    });
    expect(fresh ?? false).toBe(false);

    await setModule(society, 'asset', false);
    try {
      expect(await code(call('admin', 'asset_workspace_get', [society]))).toBe(
        '42501',
      );
      expect(await code(saveCategory('Pumps'))).toBe('42501');
    } finally {
      await setModule(society, 'asset', true);
    }
  });

  it('keeps tables private and limits access to the admin and committee of the society', async () => {
    for (const table of [
      'asset_categories',
      'assets',
      'asset_maintenance_entries',
    ]) {
      expect(
        await code(
          asActor('admin', (client) =>
            client.query(`select * from public.${table}`),
          ),
        ),
      ).toBe('42501');
    }
    const asset = await saveAsset({ name: 'Role matrix lift' });

    const committee = assetWorkspaceSchema.parse(
      await call('committee', 'asset_workspace_get', [society]),
    );
    expect(committee.can_manage).toBe(false);
    expect(committee.assets.some((item) => item.id === asset)).toBe(true);
    const committeeDetail = await detail(asset, 'committee');
    expect(committeeDetail.can_manage).toBe(false);
    expect(committeeDetail.amc_contracts).toEqual([]);

    for (const actor of ['guard', 'resident', 'foreignAdmin'] as const) {
      expect(await code(call(actor, 'asset_workspace_get', [society]))).toBe(
        '42501',
      );
      expect(await code(call(actor, 'asset_get', [society, asset]))).toBe(
        '42501',
      );
    }
    for (const actor of ['committee', 'guard', 'resident'] as const) {
      expect(await code(saveCategory('Nope', { actor }))).toBe('42501');
      expect(await code(saveAsset({}, actor))).toBe('42501');
      expect(
        await code(addMaintenance(asset, '2026-01-01', undefined, actor)),
      ).toBe('42501');
      expect(await code(call(actor, 'asset_form_options_get', [society]))).toBe(
        '42501',
      );
    }
    // A foreign admin cannot reach this society's asset through their own society.
    expect(
      await code(call('foreignAdmin', 'asset_get', [foreignSociety, asset])),
    ).toBe('P0002');
  });

  it('manages categories with unique names, versions, idempotency and inactive rules', async () => {
    const retry = crypto.randomUUID();
    const pumps = await saveCategory('Pumps', { clientRequestId: retry });
    expect(await saveCategory('Pumps', { clientRequestId: retry })).toBe(pumps);
    expect(await code(saveCategory(' pumps '))).toBe('23505');
    expect(await code(saveCategory('   '))).toBe('22023');

    await saveCategory('Water pumps', { categoryId: pumps, version: 1 });
    expect(
      await code(saveCategory('Old name', { categoryId: pumps, version: 1 })),
    ).toBe('40001');

    const asset = await saveAsset({ categoryId: pumps, name: 'Pump 1' });
    await call('admin', 'asset_category_set_active', [
      society,
      pumps,
      false,
      2,
      crypto.randomUUID(),
    ]);
    expect(await code(saveAsset({ categoryId: pumps }))).toBe('22023');
    // The asset's current inactive category may still be kept on edit.
    await saveAsset({
      assetId: asset,
      categoryId: pumps,
      name: 'Pump 1 renamed',
      expectedVersion: 1,
    });
    const options = assetFormOptionsSchema.parse(
      await call('admin', 'asset_form_options_get', [society]),
    );
    expect(options.categories.some((item) => item.id === pumps)).toBe(false);
    expect(await audits(pumps)).toEqual([
      'asset.category.create',
      'asset.category.rename',
      'asset.category.deactivate',
    ]);
  });

  it('validates assets and keeps versions and retries safe', async () => {
    expect(await code(saveAsset({ name: '' }))).toBe('22023');
    expect(await code(saveAsset({ location: ' ' }))).toBe('22023');
    expect(await code(saveAsset({ status: 'lost' }))).toBe('22023');
    expect(await code(saveAsset({ purchaseDate: '2999-01-01' }))).toBe('22023');
    expect(
      await code(
        saveAsset({
          purchaseDate: '2022-01-01',
          warrantyEndDate: '2021-01-01',
        }),
      ),
    ).toBe('22023');
    const foreignCategory = await saveCategory('Foreign lifts', {
      actor: 'foreignAdmin',
      targetSociety: foreignSociety,
    });
    expect(await code(saveAsset({ categoryId: foreignCategory }))).toBe(
      'P0002',
    );

    const retry = crypto.randomUUID();
    const asset = await saveAsset({
      clientRequestId: retry,
      purchaseDate: null,
      warrantyEndDate: null,
    });
    expect(await saveAsset({ clientRequestId: retry })).toBe(asset);
    await saveAsset({ assetId: asset, expectedVersion: 1, status: 'retired' });
    expect(await code(saveAsset({ assetId: asset, expectedVersion: 1 }))).toBe(
      '40001',
    );
    const saved = await detail(asset);
    expect(saved.asset.status).toBe('retired');
    expect(saved.asset.version).toBe(2);
    expect(await audits(asset)).toEqual(['asset.create', 'asset.update']);
    const update = (await auditRows(asset))[1]!;
    const businessFields = [
      'category_id',
      'name',
      'location',
      'make',
      'model',
      'serial_number',
      'purchase_date',
      'purchase_cost_paise',
      'supplier',
      'warranty_end_date',
      'status',
      'notes',
      'amc_contract_id',
      'version',
    ];
    for (const snapshot of [update.before, update.after]) {
      expect(Object.keys(snapshot ?? {})).toEqual(
        expect.arrayContaining(businessFields),
      );
      expect(snapshot).not.toHaveProperty('client_request_id');
    }
    expect(update.before).toMatchObject({
      status: 'active',
      location: 'Tower A lobby',
      make: 'Otis',
      serial_number: 'SN-1',
      purchase_cost_paise: 18_500_000,
    });
    expect(update.after).toMatchObject({ status: 'retired', version: 2 });
  });

  it('caps categories per society at 200 and flags a truncated asset list', async () => {
    const owner = user('foreignAdmin');
    const existing = await superuser(
      async (client) =>
        (
          await client.query<{ count: string }>(
            `select count(*) from public.asset_categories where society_id=$1`,
            [foreignSociety],
          )
        ).rows[0]!.count,
    );
    await superuser((client) =>
      client.query(
        `insert into public.asset_categories(society_id,name,client_request_id,created_by,updated_by)
         select $1,'Cap '||n,gen_random_uuid(),$2,$2 from generate_series(1,$3::int) as n`,
        [foreignSociety, owner, 199 - Number(existing)],
      ),
    );
    const last = await saveCategory('Cap last', {
      actor: 'foreignAdmin',
      targetSociety: foreignSociety,
    });
    expect(
      await code(
        saveCategory('Cap over', {
          actor: 'foreignAdmin',
          targetSociety: foreignSociety,
        }),
      ),
    ).toBe('22023');

    const list = () =>
      call('foreignAdmin', 'asset_workspace_get', [foreignSociety]).then(
        (value) => assetWorkspaceSchema.parse(value),
      );
    expect((await list()).truncated).toBe(false);
    await superuser((client) =>
      client.query(
        `insert into public.assets(society_id,category_id,name,location,client_request_id,
           created_by,updated_by)
         select $1,$2,'Bulk '||n,'Store',gen_random_uuid(),$3,$3 from generate_series(1,1001) as n`,
        [foreignSociety, last, owner],
      ),
    );
    const truncated = await list();
    expect(truncated.truncated).toBe(true);
    expect(truncated.assets).toHaveLength(1000);
  });

  it('records manual maintenance, removes it softly and audits both', async () => {
    const asset = await saveAsset({ name: 'Maintenance lift' });
    expect(await code(addMaintenance(asset, '2999-01-01'))).toBe('22023');
    const retry = crypto.randomUUID();
    const entry = await addMaintenance(asset, '2026-03-05', retry);
    expect(await addMaintenance(asset, '2026-03-05', retry)).toBe(entry);
    const workspace = assetWorkspaceSchema.parse(
      await call('admin', 'asset_workspace_get', [society]),
    );
    expect(
      workspace.assets.find((item) => item.id === asset)?.last_maintenance_on,
    ).toBe('2026-03-05');
    expect((await detail(asset)).maintenance.map((item) => item.id)).toEqual([
      entry,
    ]);

    expect(
      await code(
        call('committee', 'asset_maintenance_remove', [
          society,
          entry,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    await call('admin', 'asset_maintenance_remove', [
      society,
      entry,
      crypto.randomUUID(),
    ]);
    expect((await detail(asset)).maintenance).toEqual([]);
    // A retried removal is a no-op and is not audited twice.
    await call('admin', 'asset_maintenance_remove', [
      society,
      entry,
      crypto.randomUUID(),
    ]);
    expect(
      await code(
        call('admin', 'asset_maintenance_remove', [
          society,
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('P0002');
    expect(await audits(entry)).toEqual([
      'asset.maintenance.add',
      'asset.maintenance.remove',
    ]);
    expect(
      await code(
        database.asDeployment((client) =>
          client.query('delete from public.asset_maintenance_entries'),
        ),
      ),
    ).toBe('55000');
  });

  it('links AMC contracts read-only when AMC is on and hides them when it is off', async () => {
    const first = await createContract(society, 'admin', 'Lifts 2025');
    const renewal = await createContract(society, 'admin', 'Lifts 2026', first);
    await addVisit(first, '2025-06-01', 'First-term service');
    await addVisit(renewal, '2026-06-01', 'Second-term service');
    const foreign = await createContract(
      foreignSociety,
      'foreignAdmin',
      'Foreign lifts',
    );

    expect(await code(saveAsset({ amcContractId: foreign }))).toBe('P0002');
    const asset = await saveAsset({ amcContractId: first });
    const linked = await detail(asset);
    expect(linked.amc_contract?.id).toBe(first);
    expect(linked.amc_contract?.renewed).toBe(true);
    expect(linked.amc_visits.map((visit) => visit.summary).sort()).toEqual([
      'First-term service',
      'Second-term service',
    ]);
    expect(linked.amc_contracts.some((item) => item.id === renewal)).toBe(true);
    expect(
      assetWorkspaceSchema
        .parse(await call('admin', 'asset_workspace_get', [society]))
        .assets.find((item) => item.id === asset)?.amc_linked,
    ).toBe(true);

    await setModule(society, 'amc', false);
    try {
      const hidden = await detail(asset);
      expect(hidden.amc_enabled).toBe(false);
      expect(hidden.asset.amc_contract_id).toBeNull();
      expect(hidden.amc_contract).toBeNull();
      expect(hidden.amc_visits).toEqual([]);
      expect(hidden.amc_contracts).toEqual([]);
      // Editing while AMC is off keeps the stored link and refuses a new one.
      await saveAsset({
        assetId: asset,
        expectedVersion: 1,
        expectedAmcEnabled: false,
        name: 'Lift X',
      });
      expect(
        await code(
          saveAsset({
            assetId: asset,
            expectedVersion: 2,
            expectedAmcEnabled: false,
            amcContractId: renewal,
          }),
        ),
      ).toBe('22023');
    } finally {
      await setModule(society, 'amc', true);
    }
    expect((await detail(asset)).amc_contract?.id).toBe(first);
    // A form loaded while AMC was off sends no link; saving after AMC is turned on must not unlink.
    expect(
      await code(
        saveAsset({
          assetId: asset,
          expectedVersion: 2,
          expectedAmcEnabled: false,
          amcContractId: null,
        }),
      ),
    ).toBe('40001');
    expect((await detail(asset)).amc_contract?.id).toBe(first);
    expect((await detail(asset)).asset.version).toBe(2);

    // The linked contract stays in the picker even when it sorts beyond the 200-contract cap.
    const old = await superuser(
      async (client) =>
        (
          await client.query<{ id: string }>(
            `insert into public.amc_contracts(society_id,asset_label,vendor_name,vendor_contact,
               start_date,end_date,cost_paise,payment_terms,visit_frequency,
               created_by,updated_by,client_request_id)
             values($1,'Old lift','Lift Service Co','+91 98765 43210','2010-01-01','2010-12-31',
               100000,'Quarterly','Quarterly',$2,$2,gen_random_uuid())
             returning id`,
            [society, user('admin')],
          )
        ).rows[0]!.id,
    );
    const capped = await saveAsset({ name: 'Old lift', amcContractId: old });
    await superuser((client) =>
      client.query(
        `insert into public.amc_contracts(society_id,asset_label,vendor_name,vendor_contact,
           start_date,end_date,cost_paise,payment_terms,visit_frequency,
           created_by,updated_by,client_request_id)
         select $1,'Lift '||n,'Lift Service Co','+91 98765 43210','2026-01-01','2030-12-31',
           100000,'Quarterly','Quarterly',$2,$2,gen_random_uuid()
         from generate_series(1,205) as n`,
        [society, user('admin')],
      ),
    );
    const cappedDetail = await detail(capped);
    expect(cappedDetail.amc_contracts).toHaveLength(201);
    expect(cappedDetail.amc_contracts.some((item) => item.id === old)).toBe(
      true,
    );
    expect(
      assetFormOptionsSchema
        .parse(await call('admin', 'asset_form_options_get', [society]))
        .amc_contracts.some((item) => item.id === old),
    ).toBe(false);

    await saveAsset({
      assetId: asset,
      expectedVersion: 2,
      amcContractId: null,
    });
    expect((await detail(asset)).amc_contract).toBeNull();
  });
});
