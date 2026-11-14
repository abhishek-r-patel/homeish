// Verify exclusive amenity bookings, household privacy, immutable snapshots and atomic credits.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
describe.skipIf(!hasDatabase)('database amenity booking', () => {
  it('serializes competing reservations and preserves charge snapshots through schedule edits', async () => {
    const db = await createTestDatabase();
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
          const id = await newAuthUser(client, `amenity-${name}@example.test`);
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
        (await dbError(book('a', slotId, crypto.randomUUID(), 2, false))).code,
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
      const newSlot = changed.slots.find((s) => s.amenity_id === amenityId)!.id;
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
      expect(changed.bookings.find((b) => b.id === bookingId)?.fee_paise).toBe(
        5000,
      );
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
        await cancel('admin', historical.get('begun'), 'Retrospective closure'),
      ).toBe(historical.get('begun'));
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
      const dstSlot = dstWorkspace.slots.find((s) => s.amenity_id === dstId)!;
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
  });
});
