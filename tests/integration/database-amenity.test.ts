// Verify exclusive amenity bookings, household privacy, immutable snapshots and atomic credits.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

type DepositWorkspace = {
  amenities: { id: string; updated_at: string }[];
  slots: { id: string }[];
  bookings: {
    id: string;
    status: string;
    deposit: {
      current_amount_paise: number;
      held_paise: number;
      remaining_paise: number;
      received_paise: number;
      refunded_paise: number;
      deducted_paise: number;
    } | null;
  }[];
};
describe.skipIf(!hasDatabase)('database amenity booking', () => {
  it.each([
    ['current schema (IST only)', undefined],
    ['legacy schema (DST gap)', '20261125110000'],
  ])(
    'serializes reservations and preserves charge snapshots: %s',
    async (_label, throughMigration) => {
      const db = await createTestDatabase({ throughMigration });
      try {
        const f = await db.asSuperuser(async (client) => {
          const users = new Map<string, string>();
          for (const name of [
            'admin',
            'committee',
            'a',
            'b',
            'family',
            'outsider',
          ]) {
            const id = await newAuthUser(
              client,
              `amenity-${name}@example.test`,
            );
            users.set(name, id);
            await client.query(
              'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
              [id, `amenity-${name}@example.test`, `Amenity ${name}`],
            );
          }
          const societyId = (
            await client.query<{ id: string }>(
              "insert into public.societies(name,created_by) values('Amenity society',$1) returning id",
              [users.get('admin')],
            )
          ).rows[0]!.id;
          const members = new Map<string, string>();
          for (const [name, id] of users) {
            const roles = [
              name === 'admin' || name === 'committee' ? name : 'resident',
            ];
            const membershipId = (
              await client.query<{ id: string }>(
                "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,$3,'active') returning id",
                [societyId, id, roles],
              )
            ).rows[0]!.id;
            members.set(name, membershipId);
          }
          await client.query(
            "insert into public.module_configs(society_id,module_key,enabled,settings) values($1,'core',true,'{}'),($1,'amenity',true,'{}'),($1,'billing',false,'{}')",
            [societyId],
          );
          const units = new Map<string, string>();
          for (const name of ['a', 'b']) {
            const unitId = (
              await client.query<{ id: string }>(
                'insert into public.units(society_id,number,created_by) values($1,$2,$3) returning id',
                [societyId, name, users.get('admin')],
              )
            ).rows[0]!.id;
            units.set(name, unitId);
            await client.query(
              "insert into public.unit_occupants(society_id,unit_id,membership_id,relationship,is_primary,is_approver,status,created_by) values($1,$2,$3,'owner',true,true,'active',$4)",
              [societyId, unitId, members.get(name), users.get('admin')],
            );
          }
          const dates = (
            await client.query<{
              date: string;
              weekday: number;
              tomorrow: string;
              tomorrow_day: number;
            }>(
              'select (private.housekeeping_local_date($1)+3)::text as date,extract(dow from private.housekeeping_local_date($1)+3)::integer as weekday,(private.housekeeping_local_date($1)+1)::text as tomorrow,extract(dow from private.housekeeping_local_date($1)+1)::integer as tomorrow_day',
              [societyId],
            )
          ).rows[0]!;
          return { users, members, units, societyId, ...dates };
        });
        const asUser = <T>(
          name: string,
          query: Parameters<typeof db.asSuperuser<T>>[0],
        ) => {
          const userId = f.users.get(name);
          if (!userId) throw new Error('Missing amenity user.');
          return db.asRole('authenticated', { sub: userId }, query, {
            commit: true,
          });
        };
        const slots = [
          { weekday: f.weekday, start: '12:00', end: '14:00' },
          { weekday: f.weekday, start: '14:00', end: '15:00' },
        ];
        const save = (
          id: string | null = null,
          version: string | null = null,
          fee = 5000,
          capacity = 4,
          schedule = slots,
          name = 'Hall',
          rules = 'Keep the hall clean',
        ) =>
          asUser(
            'admin',
            async (client) =>
              (
                await client.query<{ id: string }>(
                  "select public.amenity_save($1,$2,$3,$4,$5,$9,true,$6,$7,$8,'amenity-save') as id",
                  [
                    f.societyId,
                    id,
                    name,
                    capacity,
                    fee,
                    JSON.stringify(schedule),
                    version,
                    crypto.randomUUID(),
                    rules,
                  ],
                )
              ).rows[0]!.id,
          );
        expect((await dbError(save())).code).toBe('23514');
        await db.asSuperuser((client) =>
          client.query(
            "update public.module_configs set enabled=true where society_id=$1 and module_key='billing'",
            [f.societyId],
          ),
        );
        const amenityId = await save();
        type Workspace = {
          amenities: { id: string; updated_at: string }[];
          slots: { id: string; amenity_id: string; start: string }[];
          busy: Record<string, unknown>[];
          bookings: {
            id: string;
            fee_paise: number;
            rules_snapshot: string;
            can_cancel: boolean;
          }[];
        };
        const workspace = (user: string, date = f.date) =>
          asUser(
            user,
            async (client) =>
              (
                await client.query<{ data: Workspace }>(
                  'select public.amenity_workspace($1,$2) as data',
                  [f.societyId, date],
                )
              ).rows[0]!.data,
          );
        const w = await workspace('admin');
        const version = w.amenities.find((a) => a.id === amenityId)!.updated_at;
        const slotId = w.slots.find(
          (s) => s.amenity_id === amenityId && s.start === '12:00',
        )!.id;
        const secondSlot = w.slots.find(
          (s) => s.amenity_id === amenityId && s.start === '14:00',
        )!.id;
        const book = (
          user: string,
          slot = slotId,
          requestId = crypto.randomUUID(),
          guests = 2,
          rules = true,
          date = f.date,
          updated = version,
          unit = f.units.get(user),
        ) =>
          asUser(
            user,
            async (client) =>
              (
                await client.query<{ id: string }>(
                  "select public.amenity_book($1,$2,$3,$4,$5,$6,$7,$8,$9,'amenity-book') as id",
                  [
                    f.societyId,
                    amenityId,
                    slot,
                    date,
                    unit,
                    guests,
                    rules,
                    updated,
                    requestId,
                  ],
                )
              ).rows[0]!.id,
          );
        expect(
          (await dbError(book('a', slotId, crypto.randomUUID(), 5))).code,
        ).toBe('23514');
        expect(
          (await dbError(book('a', slotId, crypto.randomUUID(), 2, false)))
            .code,
        ).toBe('23514');
        expect(
          (
            await dbError(
              book(
                'outsider',
                slotId,
                crypto.randomUUID(),
                2,
                true,
                f.date,
                version,
                f.units.get('a'),
              ),
            )
          ).code,
        ).toBe('42501');
        const retryIds = [crypto.randomUUID(), crypto.randomUUID()];
        const race = await Promise.allSettled([
          book('a', slotId, retryIds[0]),
          book('b', slotId, retryIds[1]),
        ]);
        const win = race.findIndex((result) => result.status === 'fulfilled');
        expect(
          race.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        const failed = race.find((result) => result.status === 'rejected');
        expect(
          failed?.status === 'rejected' &&
            (failed.reason as { code: string }).code,
        ).toBe('23P01');
        const winner = win === 0 ? 'a' : 'b';
        const loser = win === 0 ? 'b' : 'a';
        const won = race[win];
        if (!won || won.status !== 'fulfilled')
          throw new Error('Missing winning booking.');
        const bookingId = won.value;
        expect(await book(winner, slotId, retryIds[win])).toBe(bookingId);
        await db.asSuperuser((client) =>
          client.query(
            "insert into public.unit_occupants(society_id,unit_id,membership_id,relationship,is_primary,is_approver,status,created_by) values($1,$2,$3,'family',false,false,'active',$4)",
            [
              f.societyId,
              f.units.get(winner),
              f.members.get('family'),
              f.users.get('admin'),
            ],
          ),
        );
        expect((await workspace('family')).bookings).toHaveLength(1);
        expect((await workspace('family')).bookings[0]!.can_cancel).toBe(false);
        const privateView = await workspace(loser);
        expect(privateView.bookings).toEqual([]);
        expect(Object.keys(privateView.busy[0]!).sort()).toEqual([
          'amenity_id',
          'ends_at',
          'starts_at',
        ]);
        const cancel = (
          user: string,
          id = bookingId,
          reason: string | null = null,
        ) =>
          asUser(
            user,
            async (client) =>
              (
                await client.query<{ id: string }>(
                  "select public.amenity_cancel($1,$2,$3,'amenity-cancel') as id",
                  [f.societyId, id, reason],
                )
              ).rows[0]!.id,
          );
        expect((await dbError(cancel('family'))).code).toBe('42501');
        const secondBooking = await book(winner, secondSlot);
        expect(await cancel(winner, secondBooking)).toBe(secondBooking);
        expect(await cancel(winner, secondBooking)).toBe(secondBooking);
        await save(
          amenityId,
          version,
          0,
          1,
          [{ weekday: f.weekday, start: '12:30', end: '14:30' }],
          'Hall',
          'New rules',
        );
        const changed = await workspace('admin');
        const latest = changed.amenities.find((a) => a.id === amenityId)!;
        const newSlot = changed.slots.find(
          (s) => s.amenity_id === amenityId,
        )!.id;
        expect(
          (
            await dbError(
              book(
                winner,
                newSlot,
                crypto.randomUUID(),
                1,
                true,
                f.date,
                version,
              ),
            )
          ).code,
        ).toBe('23505');
        expect(
          (
            await dbError(
              book(
                winner,
                newSlot,
                crypto.randomUUID(),
                1,
                true,
                f.date,
                latest.updated_at,
              ),
            )
          ).code,
        ).toBe('23P01');
        expect(
          changed.bookings.find((b) => b.id === bookingId)?.fee_paise,
        ).toBe(5000);
        expect(
          changed.bookings.find((b) => b.id === bookingId)?.rules_snapshot,
        ).toBe('Keep the hall clean');
        expect((await dbError(cancel('admin'))).code).toBe('22023');
        await db.asSuperuser((client) =>
          client.query(
            "update public.module_configs set enabled=false where society_id=$1 and module_key='billing'",
            [f.societyId],
          ),
        );
        expect(
          await Promise.all([
            cancel('admin', bookingId, 'Maintenance closure'),
            cancel('admin', bookingId, 'Maintenance closure'),
          ]),
        ).toEqual([bookingId, bookingId]);
        await db.asSuperuser(async (client) => {
          const ledger = (
            await client.query<{ direction: string; amount_paise: string }>(
              'select direction,amount_paise from public.billing_ledger_entries where society_id=$1',
              [f.societyId],
            )
          ).rows;
          expect(ledger).toHaveLength(4);
          expect(
            ledger.reduce(
              (sum, r) =>
                sum +
                (r.direction === 'debit'
                  ? Number(r.amount_paise)
                  : -Number(r.amount_paise)),
              0,
            ),
          ).toBe(0);
          expect(
            (
              await client.query(
                'select id from public.notifications where society_id=$1 and entity_id=$2',
                [f.societyId, bookingId],
              )
            ).rows.length,
          ).toBeGreaterThan(0);
        });
        const earlyId = await save(
          null,
          null,
          0,
          1,
          [{ weekday: f.tomorrow_day, start: '00:00', end: '01:00' }],
          'Early slot',
        );
        const early = (await workspace('admin', f.tomorrow)).slots.find(
          (s) => s.amenity_id === earlyId,
        )!;
        const earlyVersion = (await workspace('admin')).amenities.find(
          (a) => a.id === earlyId,
        )!.updated_at;
        expect(
          (
            await dbError(
              asUser(winner, (client) =>
                client.query(
                  "select public.amenity_book($1,$2,$3,$4,$5,1,true,$6,$7,'too-early')",
                  [
                    f.societyId,
                    earlyId,
                    early.id,
                    f.tomorrow,
                    f.units.get(winner),
                    earlyVersion,
                    crypto.randomUUID(),
                  ],
                ),
              ),
            )
          ).code,
        ).toBe('23514');
        const horizon = await db.asSuperuser(
          async (client) =>
            (
              await client.query<{ date: string }>(
                'select ((current_date+3650)+(($1-extract(dow from current_date+3650)::integer+7)%7))::text as date',
                [f.weekday],
              )
            ).rows[0]!.date,
        );
        expect(
          await book(
            winner,
            newSlot,
            crypto.randomUUID(),
            1,
            true,
            horizon,
            latest.updated_at,
          ),
        ).toEqual(expect.any(String));
        const historical = await db.asSuperuser(async (client) => {
          const result = new Map<string, string>();
          for (const [label, offset] of [
            ['begun', '-30 minutes'],
            ['upcoming', '30 minutes'],
          ]) {
            const record = (
              await client.query<{ id: string }>(
                "insert into public.amenity_bookings(society_id,amenity_id,slot_id,unit_id,booked_by,starts_at,ends_at,amenity_name,capacity,guest_count,fee_paise,rules_snapshot,rules_accepted,created_at,client_request_id) values($1,$2,$3,$4,$5,now()+$6::interval,now()+$6::interval+interval '1 hour','Historical hall',4,1,0,'',false,now()-interval '2 days',$7) returning id",
                [
                  f.societyId,
                  amenityId,
                  slotId,
                  f.units.get(winner),
                  f.users.get(winner),
                  offset,
                  crypto.randomUUID(),
                ],
              )
            ).rows[0]!.id;
            result.set(label, record);
          }
          return result;
        });
        expect(
          (await dbError(cancel(winner, historical.get('begun')))).code,
        ).toBe('23514');
        expect(await cancel(winner, historical.get('upcoming'))).toBe(
          historical.get('upcoming'),
        );
        expect(
          await cancel(
            'admin',
            historical.get('begun'),
            'Retrospective closure',
          ),
        ).toBe(historical.get('begun'));
        if (throughMigration) {
          const dstDate = await db.asSuperuser(
            async (client) =>
              (
                await client.query<{ date: string }>(
                  'with base as (select make_date(extract(year from current_date)::integer+1,3,1) as day) select (day+((7-extract(dow from day)::integer)%7)+7)::text as date from base',
                )
              ).rows[0]!.date,
          );
          const dstId = await save(
            null,
            null,
            0,
            1,
            [{ weekday: 0, start: '02:30', end: '03:00' }],
            'DST slot',
          );
          await db.asSuperuser((client) =>
            client.query(
              "update public.societies set timezone='America/New_York' where id=$1",
              [f.societyId],
            ),
          );
          const dstWorkspace = await workspace('admin', dstDate);
          const dstSlot = dstWorkspace.slots.find(
            (s) => s.amenity_id === dstId,
          )!;
          const dstVersion = dstWorkspace.amenities.find(
            (a) => a.id === dstId,
          )!.updated_at;
          expect(
            (
              await dbError(
                asUser(winner, (client) =>
                  client.query(
                    "select public.amenity_book($1,$2,$3,$4,$5,1,true,$6,$7,'dst-test')",
                    [
                      f.societyId,
                      dstId,
                      dstSlot.id,
                      dstDate,
                      f.units.get(winner),
                      dstVersion,
                      crypto.randomUUID(),
                    ],
                  ),
                ),
              )
            ).code,
          ).toBe('23514');
          await db.asSuperuser((client) =>
            client.query(
              "update public.societies set timezone='Asia/Kolkata' where id=$1",
              [f.societyId],
            ),
          );
        } else {
          expect(
            (
              await dbError(
                db.asSuperuser((client) =>
                  client.query(
                    "update public.societies set timezone='America/New_York' where id=$1",
                    [f.societyId],
                  ),
                ),
              )
            ).message,
          ).toContain('societies_india_timezone_check');
        }

        if (!throughMigration) {
          const calendarSettings = await asUser('committee', (client) =>
            client.query<{ data: unknown }>(
              'select public.amenity_calendar_settings_get($1) as data',
              [f.societyId],
            ),
          );
          expect(calendarSettings.rows[0]!.data).toEqual({
            resident_calendar_identity: 'availability_only',
            deposit_confirmation_policy: 'per_amenity',
            directory_enabled: false,
            can_manage: false,
          });
          expect(
            (
              await dbError(
                asUser('a', (client) =>
                  client.query(
                    'select public.amenity_calendar_settings_get($1)',
                    [f.societyId],
                  ),
                ),
              )
            ).code,
          ).toBe('42501');
          await asUser('admin', (client) =>
            client.query(
              'select public.amenity_calendar_visibility_save($1,$2,$3)',
              [f.societyId, 'booker_name_and_unit', 'calendar-settings'],
            ),
          );
          await db.asSuperuser((client) =>
            client.query(
              `insert into public.module_configs(society_id,module_key,enabled,settings)
             values($1,'directory',true,'{}'),($1,'asset',true,'{}')
             on conflict(society_id,module_key) do update
               set enabled=excluded.enabled`,
              [f.societyId],
            ),
          );

          const calendarMonth = await asUser('a', (client) =>
            client.query<{ data: Record<string, unknown> }>(
              'select public.amenity_calendar_month($1,$2,$3) as data',
              [f.societyId, `${horizon.slice(0, 7)}-01`, 500],
            ),
          );
          expect(calendarMonth.rows[0]!.data.month).toMatch(/^\d{4}-\d{2}$/);
          const calendarItems = calendarMonth.rows[0]!.data.items as Record<
            string,
            unknown
          >[];
          expect(calendarItems.length).toBeGreaterThan(0);
          expect(calendarItems.some((item) => item.booker_name)).toBe(true);
          expect(calendarItems.some((item) => item.unit_number)).toBe(true);
          expect(JSON.stringify(calendarItems)).not.toMatch(
            /guest_count|rules_snapshot|cancel_reason|email|phone/i,
          );

          await db.asSuperuser(async (client) => {
            await client.query(
              `insert into public.directory_preferences
             (society_id,membership_id,name_visible,unit_visible,phone_visible,updated_by)
             values($1,$2,false,true,false,$3)`,
              [f.societyId, f.members.get(winner), f.users.get('admin')],
            );
            await client.query(
              "update public.module_configs set enabled=false where society_id=$1 and module_key='directory'",
              [f.societyId],
            );
          });
          const hiddenCalendar = await asUser('a', (client) =>
            client.query<{ data: Record<string, unknown> }>(
              'select public.amenity_calendar_month($1,$2,500) as data',
              [f.societyId, `${horizon.slice(0, 7)}-01`],
            ),
          );
          const hiddenItems = hiddenCalendar.rows[0]!.data.items as Record<
            string,
            unknown
          >[];
          expect(
            hiddenItems.every(
              (item) => item.booker_name === null && item.unit_number === null,
            ),
          ).toBe(true);
          await db.asSuperuser((client) =>
            client.query(
              "update public.module_configs set enabled=true where society_id=$1 and module_key='directory'",
              [f.societyId],
            ),
          );
          const preferenceHidden = await asUser('a', (client) =>
            client.query<{ data: Record<string, unknown> }>(
              'select public.amenity_calendar_month($1,$2,500) as data',
              [f.societyId, `${horizon.slice(0, 7)}-01`],
            ),
          );
          expect(
            (
              preferenceHidden.rows[0]!.data.items as Record<string, unknown>[]
            ).some((item) => item.booker_name === null && item.unit_number),
          ).toBe(true);

          const source = await db.asSuperuser(async (client) => {
            const categoryId = (
              await client.query<{ id: string }>(
                `insert into public.asset_categories
               (society_id,name,client_request_id,created_by,updated_by)
               values($1,'P52 category',gen_random_uuid(),$2,$2) returning id`,
                [f.societyId, f.users.get('admin')],
              )
            ).rows[0]!.id;
            return (
              await client.query<{ id: string }>(
                `insert into public.assets
               (society_id,category_id,name,location,client_request_id,created_by,updated_by)
               values($1,$2,'P52 lift','Tower A',gen_random_uuid(),$3,$3) returning id`,
                [f.societyId, categoryId, f.users.get('admin')],
              )
            ).rows[0]!.id;
          });
          const localTime = await asUser('admin', (client) =>
            client.query<{ value: string }>(
              `select to_char(clock_timestamp() at time zone 'Asia/Kolkata'
              - interval '1 minute','YYYY-MM-DD"T"HH24:MI') as value`,
            ),
          );
          const activityRequest = crypto.randomUUID();
          const activity = await asUser('admin', (client) =>
            client.query<{ id: string }>(
              `select public.amenity_activity_record(
              $1,'asset',$2,'use',$3,'Synthetic facility use',$4,'activity-record'
            ) as id`,
              [f.societyId, source, localTime.rows[0]!.value, activityRequest],
            ),
          );
          expect(
            (
              await asUser('admin', (client) =>
                client.query<{ id: string }>(
                  `select public.amenity_activity_record(
                  $1,'asset',$2,'use',$3,'Synthetic facility use',$4,'activity-record-retry'
                ) as id`,
                  [
                    f.societyId,
                    source,
                    localTime.rows[0]!.value,
                    activityRequest,
                  ],
                ),
              )
            ).rows[0]!.id,
          ).toBe(activity.rows[0]!.id);
          expect(
            (
              await dbError(
                asUser('a', (client) =>
                  client.query(
                    `select public.amenity_activity_record(
                    $1,'asset',$2,'issue','2026-01-01T09:00','Synthetic',$3,$4
                  )`,
                    [
                      f.societyId,
                      source,
                      crypto.randomUUID(),
                      crypto.randomUUID(),
                    ],
                  ),
                ),
              )
            ).code,
          ).toBe('42501');
          expect(
            (
              await dbError(
                asUser('admin', (client) =>
                  client.query(
                    `select public.amenity_activity_record(
                    $1,'asset',$2,'issue','2026-1-1T09:00','Synthetic',$3,$4
                  )`,
                    [
                      f.societyId,
                      source,
                      crypto.randomUUID(),
                      crypto.randomUUID(),
                    ],
                  ),
                ),
              )
            ).code,
          ).toBe('22023');

          const report = await asUser('admin', (client) =>
            client.query<{ data: Record<string, unknown> }>(
              'select public.amenity_facilities_report($1,25,0) as data',
              [f.societyId],
            ),
          );
          expect(report.rows[0]!.data).toMatchObject({
            timezone: 'Asia/Kolkata',
            can_record: true,
          });
          expect(
            (
              report.rows[0]!.data.source_choices as {
                source_kind: string;
                source_id: string;
              }[]
            ).some(
              (choice) =>
                choice.source_kind === 'asset' && choice.source_id === source,
            ),
          ).toBe(true);
          const committeeReport = await asUser('committee', (client) =>
            client.query<{ data: Record<string, unknown> }>(
              'select public.amenity_facilities_report($1,25,0) as data',
              [f.societyId],
            ),
          );
          expect(committeeReport.rows[0]!.data.can_record).toBe(false);
          expect(committeeReport.rows[0]!.data.source_choices).toEqual([]);
          expect(
            (
              await dbError(
                asUser('admin', (client) =>
                  client.query('select * from public.amenity_activity_records'),
                ),
              )
            ).code,
          ).toBe('42501');
          expect(
            (
              await dbError(
                db.asSuperuser((client) =>
                  client.query(
                    'update public.amenity_activity_records set note=$2 where id=$1',
                    [activity.rows[0]!.id, 'Changed'],
                  ),
                ),
              )
            ).code,
          ).toBe('55000');

          await db.asSuperuser((client) =>
            client.query(
              "update public.module_configs set enabled=false where society_id=$1 and module_key='asset'",
              [f.societyId],
            ),
          );
          const hiddenReport = await asUser('admin', (client) =>
            client.query<{ data: { total: number; items: unknown[] } }>(
              'select public.amenity_facilities_report($1,25,0) as data',
              [f.societyId],
            ),
          );
          expect(hiddenReport.rows[0]!.data).toMatchObject({
            total: 0,
            items: [],
          });
          const retained = await db.asSuperuser((client) =>
            client.query<{ count: string }>(
              'select count(*)::text from public.amenity_activity_records where id=$1',
              [activity.rows[0]!.id],
            ),
          );
          expect(retained.rows[0]!.count).toBe('1');
        }

        await db.asSuperuser((client) =>
          client.query(
            "update public.module_configs set enabled=false where society_id=$1 and module_key='amenity'",
            [f.societyId],
          ),
        );
        expect((await dbError(workspace('admin'))).code).toBe('42501');
      } finally {
        await db.drop();
      }
    },
  );

  it('holds required deposits, confirms on full receipts and reconciles refunds and deductions', async () => {
    const db = await createTestDatabase();
    try {
      const fixture = await db.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'deposit-admin@example.test');
        const residentId = await newAuthUser(
          client,
          'deposit-resident@example.test',
        );
        for (const [id, email, name] of [
          [adminId, 'deposit-admin@example.test', 'Deposit Admin'],
          [residentId, 'deposit-resident@example.test', 'Deposit Resident'],
        ]) {
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, email, name],
          );
        }
        const societyId = (
          await client.query<{ id: string }>(
            "insert into public.societies(name,created_by) values('Deposit Society',$1) returning id",
            [adminId],
          )
        ).rows[0]!.id;
        const residentMembership = (
          await client.query<{ id: string }>(
            "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,'{resident}','active') returning id",
            [societyId, residentId],
          )
        ).rows[0]!.id;
        await client.query(
          "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,'{admin}','active')",
          [societyId, adminId],
        );
        await client.query(
          `insert into public.module_configs(society_id,module_key,enabled,settings)
           values
             ($1,'core',true,'{}'),
             ($1,'amenity',true,'{}'),
             ($1,'expense',true,'{}'),
             ($1,'billing',true,'{}')`,
          [societyId],
        );
        const unitId = (
          await client.query<{ id: string }>(
            'insert into public.units(society_id,number,created_by) values($1,$2,$3) returning id',
            [societyId, 'D-1', adminId],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.unit_occupants(
             society_id,unit_id,membership_id,relationship,is_primary,status,created_by
           ) values($1,$2,$3,'owner',true,'active',$4)`,
          [societyId, unitId, residentMembership, adminId],
        );
        const accountId = (
          await client.query<{ id: string }>(
            `insert into public.expense_accounts(
               society_id,name,account_type,opening_on,created_by,updated_by
             ) values($1,'Deposit cash','cash','2026-01-01',$2,$2) returning id`,
            [societyId, adminId],
          )
        ).rows[0]!.id;
        const dateRow = (
          await client.query<{ date: string; weekday: number }>(
            `select (private.housekeeping_local_date($1)+3)::text as date,
               extract(dow from private.housekeeping_local_date($1)+3)::integer as weekday`,
            [societyId],
          )
        ).rows[0]!;
        return {
          accountId,
          adminId,
          date: dateRow.date,
          residentId,
          societyId,
          unitId,
          weekday: dateRow.weekday,
        };
      });

      const amenityId = await db.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.amenity_save(
                 $1,null,'Deposit Hall',20,1500,'Keep it clean',true,$2,
                 null,$3,'deposit-save',5000,true
               ) as id`,
              [
                fixture.societyId,
                JSON.stringify([
                  {
                    weekday: fixture.weekday,
                    start: '12:00',
                    end: '13:00',
                  },
                ]),
                crypto.randomUUID(),
              ],
            )
          ).rows[0]!.id,
        { commit: true },
      );
      const workspace = await db.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query<{ data: DepositWorkspace }>(
            'select public.amenity_workspace($1,$2) as data',
            [fixture.societyId, fixture.date],
          ),
      );
      const amenity = workspace.rows[0]!.data.amenities[0];
      const slot = workspace.rows[0]!.data.slots[0];
      const bookingId = await db.asRole(
        'authenticated',
        { sub: fixture.residentId },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.amenity_book(
                 $1,$2,$3,$4,$5,2,true,$6,$7,'deposit-book'
               ) as id`,
              [
                fixture.societyId,
                amenityId,
                slot.id,
                fixture.date,
                fixture.unitId,
                amenity.updated_at,
                crypto.randomUUID(),
              ],
            )
          ).rows[0]!.id,
        { commit: true },
      );
      const booking = await db.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query<{ data: DepositWorkspace }>(
            'select public.amenity_workspace($1,$2) as data',
            [fixture.societyId, fixture.date],
          ),
      );
      expect(booking.rows[0]!.data.bookings[0]).toMatchObject({
        id: bookingId,
        status: 'awaiting_deposit',
        deposit: {
          current_amount_paise: 5000,
          held_paise: 0,
          remaining_paise: 5000,
        },
      });
      const ledgerBefore = await db.asSuperuser((client) =>
        client.query(
          'select count(*)::integer as count from public.billing_ledger_entries where society_id=$1',
          [fixture.societyId],
        ),
      );
      expect(ledgerBefore.rows[0]!.count).toBe(0);

      for (const amount of [2000, 3000]) {
        await db.asRole(
          'authenticated',
          { sub: fixture.adminId },
          (client) =>
            client.query(
              `select public.amenity_deposit_event_record(
                 $1,$2,'receipt',$3,$4,$5,'receipt-ref',null,null,$6,'deposit-receipt'
               )`,
              [
                fixture.societyId,
                bookingId,
                amount,
                fixture.date,
                fixture.accountId,
                crypto.randomUUID(),
              ],
            ),
          { commit: true },
        );
      }
      const confirmed = await db.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query<{ data: DepositWorkspace }>(
            'select public.amenity_workspace($1,$2) as data',
            [fixture.societyId, fixture.date],
          ),
      );
      expect(confirmed.rows[0]!.data.bookings[0]).toMatchObject({
        status: 'confirmed',
        deposit: { received_paise: 5000, held_paise: 5000 },
      });
      const deductionPath = `${fixture.societyId}/amenity-deposits/${bookingId}/${crypto.randomUUID()}.pdf`;
      await db.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            `select public.amenity_deposit_event_record(
               $1,$2,'deduction',500,$3,null,null,
               'Cleaning charge',$4,$5,'deposit-deduction'
             )`,
            [
              fixture.societyId,
              bookingId,
              fixture.date,
              deductionPath,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      const evidenceAccess = await db.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query<{ allowed: boolean }>(
            'select public.amenity_deposit_file_path_access($1) as allowed',
            [deductionPath],
          ),
      );
      expect(evidenceAccess.rows[0]!.allowed).toBe(true);
      expect(
        (
          await dbError(
            db.asSuperuser((client) =>
              client.query(
                `update public.module_configs set enabled=false
                 where society_id=$1 and module_key='expense'`,
                [fixture.societyId],
              ),
            ),
          )
        ).code,
      ).toBe('23514');
      expect(
        (
          await dbError(
            db.asRole('authenticated', { sub: fixture.adminId }, (client) =>
              client.query('select public.amenity_cancel($1,$2,$3,$4)', [
                fixture.societyId,
                bookingId,
                'Changed plans',
                'deposit-cancel',
              ]),
            ),
          )
        ).code,
      ).toBe('23514');
      await db.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            `select public.amenity_deposit_event_record(
               $1,$2,'refund',4500,$3,$4,'refund-ref','Returned deposit',null,$5,
               'deposit-refund'
             )`,
            [
              fixture.societyId,
              bookingId,
              fixture.date,
              fixture.accountId,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      await db.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query('select public.amenity_cancel($1,$2,$3,$4)', [
            fixture.societyId,
            bookingId,
            'Changed plans',
            'deposit-cancel',
          ]),
        { commit: true },
      );
      const final = await db.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query<{ data: DepositWorkspace }>(
            'select public.amenity_workspace($1,$2) as data',
            [fixture.societyId, fixture.date],
          ),
      );
      expect(final.rows[0]!.data.bookings[0]).toMatchObject({
        status: 'cancelled',
        deposit: {
          received_paise: 5000,
          refunded_paise: 4500,
          deducted_paise: 500,
          held_paise: 0,
        },
      });
      const cash = await db.asSuperuser((client) =>
        client.query<{ balance: string }>(
          'select private.expense_balance($1,$2,$3) as balance',
          [fixture.societyId, fixture.accountId, fixture.date],
        ),
      );
      expect(cash.rows[0]!.balance).toBe('500');
    } finally {
      await db.drop();
    }
  });
});
