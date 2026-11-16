// Verify meeting minutes drafting, publication, visibility and document links, plus action items and reminders.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  callMeeting,
  callMeetingService,
  createDocumentRow,
  createHeldMeeting,
  createMeeting,
  createMeetingFixture,
  createScheduledMeeting,
  databaseTimestamp,
  errorFor,
  expectCode,
  expectDomainError,
  notificationsFor,
  records,
  requestId,
  setModule,
  updateMeetingSettings,
  type MeetingActor,
  type MeetingFixture,
} from './support/meeting-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)(
  'meeting minutes and action database contracts',
  () => {
    let database: TestDatabase;
    let fixture: MeetingFixture;

    beforeAll(async () => {
      database = await createTestDatabase();
      fixture = await createMeetingFixture(database);
    });

    afterAll(async () => {
      await database?.drop();
    });

    function saveMinutes(
      meetingId: string,
      version: number | null,
      body: string,
      actor: MeetingActor = 'admin',
    ) {
      return callMeeting(fixture, actor, 'meeting_minutes_save', [
        fixture.societyId,
        meetingId,
        version,
        body,
        requestId('minutes'),
      ]);
    }

    function publishMinutes(
      meetingId: string,
      version: number,
      actor: MeetingActor = 'admin',
      request = requestId('publish'),
    ) {
      return callMeeting(fixture, actor, 'meeting_minutes_publish', [
        fixture.societyId,
        meetingId,
        version,
        request,
      ]);
    }

    async function publishedMeeting(
      overrides: Parameters<typeof createHeldMeeting>[1] = {},
      request = requestId('publish'),
    ) {
      const held = await createHeldMeeting(fixture, overrides);
      const draft = await saveMinutes(
        held.meetingId,
        null,
        'Synthetic minutes.',
      );
      const published = await publishMinutes(
        held.meetingId,
        draft.version as number,
        'admin',
        request,
      );
      return { meetingId: held.meetingId, published };
    }

    async function localDate(offsetDays: number): Promise<string> {
      const result = await database.asSuperuser((client) =>
        client.query<{ value: string }>(
          `select ((clock_timestamp() at time zone 'Asia/Kolkata')::date + $1::int)::text as value`,
          [offsetDays],
        ),
      );
      return result.rows[0]!.value;
    }

    function saveAction(
      meetingId: string,
      actionId: string | null,
      version: number | null,
      action: Record<string, unknown>,
      request = requestId('action'),
      actor: MeetingActor = 'admin',
    ) {
      return callMeeting(fixture, actor, 'meeting_action_save', [
        fixture.societyId,
        meetingId,
        actionId,
        version,
        action,
        request,
      ]);
    }

    function setActionStatus(
      actor: MeetingActor,
      actionId: string,
      version: number,
      status: string,
      note: string | null = null,
    ) {
      return callMeeting(fixture, actor, 'meeting_action_status_set', [
        fixture.societyId,
        actionId,
        version,
        status,
        note,
        requestId('action-status'),
      ]);
    }

    // Trigger-free fixture edits: a past due date or a cleared reminder stamp cannot be set through the RPCs.
    async function forceActionDates(
      actionId: string,
      dueOn: string | null,
      clearReminder = false,
    ): Promise<void> {
      await database.asSuperuser(async (client) => {
        await client.query('begin');
        try {
          await client.query("set local session_replication_role = 'replica'");
          await client.query(
            `update public.meeting_action_items
             set due_on=coalesce($2::date,due_on),
                 last_overdue_notified_on=case when $3 then null else last_overdue_notified_on end
             where id=$1`,
            [actionId, dueOn, clearReminder],
          );
          await client.query('commit');
        } catch (error) {
          await client.query('rollback');
          throw error;
        }
      });
    }

    describe('minutes', () => {
      it('lets admin and committee draft minutes only after the meeting is held, with optimistic versions', async () => {
        const scheduled = await createScheduledMeeting(fixture);
        await expectDomainError(
          saveMinutes(scheduled.meetingId, null, 'Too early'),
          'meeting_invalid_state',
        );

        const held = await createHeldMeeting(fixture);
        const first = await saveMinutes(
          held.meetingId,
          null,
          'Committee first draft.',
          'committee',
        );
        expect(first).toEqual({
          meetingId: held.meetingId,
          version: 1,
          status: 'draft',
        });
        const second = await saveMinutes(held.meetingId, 1, 'Admin revision.');
        expect(second).toMatchObject({ version: 2, status: 'draft' });
        await expectCode(
          saveMinutes(held.meetingId, 1, 'Stale revision.'),
          '40001',
        );
        const recreate = await errorFor(
          saveMinutes(held.meetingId, null, 'Second first draft.'),
        );
        expect(['40001', 'P0001']).toContain(recreate.code);
        await expectCode(saveMinutes(held.meetingId, 2, ''), '22023');
        await expectCode(
          saveMinutes(held.meetingId, 2, 'x'.repeat(50001)),
          '22023',
        );
        for (const actor of ['owner', 'guard', 'hkSupervisor'] as const) {
          await expectCode(
            saveMinutes(held.meetingId, 2, 'Not allowed', actor),
            '42501',
          );
        }

        const admin = await callMeeting(
          fixture,
          'committee',
          'meeting_admin_get',
          [fixture.societyId, held.meetingId],
        );
        expect(admin.minutes).toMatchObject({
          status: 'draft',
          body: 'Admin revision.',
          version: 2,
          updatedByName: fixture.names.admin,
          publishedAt: null,
          documentId: null,
        });
        const member = await callMeeting(
          fixture,
          'owner',
          'meeting_member_get',
          [fixture.societyId, held.meetingId],
        );
        expect(member.minutes).toBeNull();
        const list = records(
          (
            await callMeeting(fixture, 'admin', 'meeting_admin_list', [
              fixture.societyId,
              'held',
              100,
              0,
            ])
          ).items,
        );
        expect(
          list.find((item) => item.id === held.meetingId)?.minutesStatus,
        ).toBe('draft');
      });

      it('publishes minutes by admin only, notifies invitees and makes them immutable', async () => {
        const held = await createHeldMeeting(fixture, {
          invitees: { scope: 'custom', unitIds: [fixture.units.a101.id] },
        });
        await expectDomainError(
          publishMinutes(held.meetingId, 1),
          'meeting_invalid_state',
        );
        const draft = await saveMinutes(held.meetingId, null, 'Final minutes.');
        await expectCode(
          publishMinutes(held.meetingId, draft.version as number, 'committee'),
          '42501',
        );
        await expectCode(
          publishMinutes(held.meetingId, (draft.version as number) + 1),
          '40001',
        );
        const request = requestId('publish');
        const published = await publishMinutes(
          held.meetingId,
          draft.version as number,
          'admin',
          request,
        );
        expect(published.meetingId).toBe(held.meetingId);
        expect(typeof published.publishedAt).toBe('string');
        const notifications = await notificationsFor(fixture, request);
        expect(notifications.map((row) => row.user_id).sort()).toEqual(
          (['owner', 'tenant', 'family'] as const)
            .map((actor) => fixture.actors[actor])
            .sort(),
        );
        expect(new Set(notifications.map((row) => row.entity_type))).toEqual(
          new Set(['meeting']),
        );

        await expectDomainError(
          publishMinutes(held.meetingId, published.version as number),
          'meeting_invalid_state',
        );
        await expectDomainError(
          saveMinutes(held.meetingId, published.version as number, 'Edited'),
          'meeting_invalid_state',
        );
        const direct = await errorFor(
          database.asSuperuser((client) =>
            client.query(
              `update public.meeting_minutes set body='Tampered'
             where society_id=$1 and meeting_id=$2`,
              [fixture.societyId, held.meetingId],
            ),
          ),
        );
        expect(direct.code).toBe('55000');

        for (const actor of ['owner', 'tenant', 'family'] as const) {
          const member = await callMeeting(
            fixture,
            actor,
            'meeting_member_get',
            [fixture.societyId, held.meetingId],
          );
          expect(member.minutes).toEqual({
            body: 'Final minutes.',
            publishedAt: published.publishedAt,
          });
        }
        await expectCode(
          callMeeting(fixture, 'owner2', 'meeting_member_get', [
            fixture.societyId,
            held.meetingId,
          ]),
          'P0002',
        );
        const ownerList = await callMeeting(
          fixture,
          'owner',
          'meeting_member_list',
          [fixture.societyId],
        );
        expect(
          records(ownerList.meetings).find((row) => row.id === held.meetingId),
        ).toMatchObject({ minutesPublished: true });
      });

      it('keeps committee meeting minutes to admins and committee', async () => {
        const startsAt = await databaseTimestamp(fixture, "+ interval '1 day'");
        const request = requestId('publish');
        const committee = await publishedMeeting(
          {
            meetingType: 'committee',
            startsAt,
            endsAt: new Date(
              new Date(startsAt).getTime() + 3_600_000,
            ).toISOString(),
          },
          request,
        );
        const notifications = await notificationsFor(fixture, request);
        expect(notifications.map((row) => row.user_id).sort()).toEqual(
          [fixture.actors.committee, fixture.actors.committee2].sort(),
        );
        expect(new Set(notifications.map((row) => row.entity_type))).toEqual(
          new Set(['meeting_admin']),
        );
        const committeeView = await callMeeting(
          fixture,
          'committee2',
          'meeting_admin_get',
          [fixture.societyId, committee.meetingId],
        );
        expect(committeeView.minutes).toMatchObject({
          status: 'published',
          body: 'Synthetic minutes.',
        });
        for (const actor of ['owner', 'tenant', 'family'] as const) {
          await expectCode(
            callMeeting(fixture, actor, 'meeting_member_get', [
              fixture.societyId,
              committee.meetingId,
            ]),
            'P0002',
          );
        }
      });

      it('links one in-society document copy to published minutes when documents are enabled', async () => {
        const held = await createHeldMeeting(fixture);
        const documentId = await createDocumentRow(fixture);
        const link = (id: string, actor: MeetingActor = 'admin') =>
          callMeeting(fixture, actor, 'meeting_minutes_document_link', [
            fixture.societyId,
            held.meetingId,
            id,
            requestId('document-link'),
          ]);
        await saveMinutes(held.meetingId, null, 'Unpublished minutes.');
        await expectDomainError(link(documentId), 'meeting_invalid_state');
        await publishMinutes(held.meetingId, 1);

        await setModule(fixture, 'document', false);
        try {
          await expectDomainError(
            link(documentId),
            'meeting_document_unavailable',
          );
        } finally {
          await setModule(fixture, 'document', true);
        }
        await expectDomainError(
          link(await createDocumentRow(fixture, 'foreign')),
          'meeting_document_unavailable',
        );
        await expectDomainError(
          link(crypto.randomUUID()),
          'meeting_document_unavailable',
        );
        await expectCode(link(documentId, 'committee'), '42501');

        expect(await link(documentId)).toEqual({
          meetingId: held.meetingId,
          documentId,
        });
        expect(await link(documentId)).toEqual({
          meetingId: held.meetingId,
          documentId,
        });
        const other = await errorFor(link(await createDocumentRow(fixture)));
        expect(other.code).toBe('P0001');
        const view = await callMeeting(fixture, 'admin', 'meeting_admin_get', [
          fixture.societyId,
          held.meetingId,
        ]);
        expect(view.minutes).toMatchObject({ status: 'published', documentId });
      });
    });

    describe('action items', () => {
      it('assigns eligible owners, notifies on assignment and reassignment, and validates input', async () => {
        const scheduled = await createScheduledMeeting(fixture);
        const dueOn = await localDate(7);
        const assign = requestId('action');
        const created = await saveAction(
          scheduled.meetingId,
          null,
          null,
          {
            title: 'Collect quotes',
            ownerMembershipId: fixture.memberships.resident,
            dueOn,
            resolutionId: null,
          },
          assign,
        );
        expect(created).toMatchObject({ version: 1 });
        const actionId = created.actionId as string;
        expect(await notificationsFor(fixture, assign)).toEqual([
          expect.objectContaining({
            user_id: fixture.actors.resident,
            entity_type: 'meeting_action',
          }),
        ]);

        const quiet = requestId('action');
        const retitled = await saveAction(
          scheduled.meetingId,
          actionId,
          1,
          {
            title: 'Collect three quotes',
            ownerMembershipId: fixture.memberships.resident,
            dueOn,
            resolutionId: null,
          },
          quiet,
        );
        expect(retitled).toEqual({ actionId, version: 2 });
        expect(await notificationsFor(fixture, quiet)).toEqual([]);
        await expectCode(
          saveAction(scheduled.meetingId, actionId, 1, {
            title: 'Stale',
            ownerMembershipId: fixture.memberships.resident,
            dueOn,
            resolutionId: null,
          }),
          '40001',
        );

        const reassign = requestId('action');
        await saveAction(
          scheduled.meetingId,
          actionId,
          2,
          {
            title: 'Collect three quotes',
            ownerMembershipId: fixture.memberships.admin,
            dueOn,
            resolutionId: null,
          },
          reassign,
        );
        expect(await notificationsFor(fixture, reassign)).toEqual([
          expect.objectContaining({
            user_id: fixture.actors.admin,
            entity_type: 'meeting_action_admin',
          }),
        ]);
        const owned = await database.asSuperuser((client) =>
          client.query<{ owner_membership_id: string; owner_name: string }>(
            'select owner_membership_id,owner_name from public.meeting_action_items where id=$1',
            [actionId],
          ),
        );
        expect(owned.rows[0]).toEqual({
          owner_membership_id: fixture.memberships.admin,
          owner_name: fixture.names.admin,
        });

        for (const ineligible of [
          'guard',
          'committeeInactive',
          'outsider',
        ] as const) {
          await expectDomainError(
            saveAction(scheduled.meetingId, null, null, {
              title: 'Ineligible owner',
              ownerMembershipId: fixture.memberships[ineligible],
              dueOn,
              resolutionId: null,
            }),
            'meeting_owner_ineligible',
          );
        }
        await expectCode(
          saveAction(scheduled.meetingId, null, null, {
            title: 'x'.repeat(301),
            ownerMembershipId: fixture.memberships.resident,
            dueOn,
            resolutionId: null,
          }),
          '22023',
        );
        await expectCode(
          saveAction(
            scheduled.meetingId,
            null,
            null,
            {
              title: 'Committee cannot',
              ownerMembershipId: fixture.memberships.resident,
              dueOn,
              resolutionId: null,
            },
            requestId('action'),
            'committee',
          ),
          '42501',
        );

        const cancelled = await createScheduledMeeting(fixture);
        await callMeeting(fixture, 'admin', 'meeting_cancel', [
          fixture.societyId,
          cancelled.meetingId,
          cancelled.version,
          'Called off',
          requestId('cancel'),
        ]);
        await expectDomainError(
          saveAction(cancelled.meetingId, null, null, {
            title: 'Too late',
            ownerMembershipId: fixture.memberships.resident,
            dueOn,
            resolutionId: null,
          }),
          'meeting_invalid_state',
        );
      });

      it('restricts owners to management when the setting says so', async () => {
        const scheduled = await createScheduledMeeting(fixture);
        const dueOn = await localDate(7);
        const anyMember = records(
          (
            await callMeeting(fixture, 'admin', 'meeting_owner_options', [
              fixture.societyId,
              null,
              50,
            ])
          ).items,
        ).map((item) => item.membershipId);
        expect(anyMember).toEqual(
          expect.arrayContaining([
            fixture.memberships.admin,
            fixture.memberships.committee,
            fixture.memberships.resident,
            fixture.memberships.owner,
          ]),
        );
        for (const excluded of [
          'guard',
          'hkSupervisor',
          'committeeInactive',
          'outsider',
        ] as const) {
          expect(anyMember).not.toContain(fixture.memberships[excluded]);
        }
        await expectCode(
          callMeeting(fixture, 'admin', 'meeting_owner_options', [
            fixture.societyId,
            null,
            0,
          ]),
          '22023',
        );

        await updateMeetingSettings(fixture, {
          action_owner_scope: 'management',
        });
        try {
          const management = records(
            (
              await callMeeting(fixture, 'admin', 'meeting_owner_options', [
                fixture.societyId,
                null,
                50,
              ])
            ).items,
          ).map((item) => item.membershipId);
          expect(management.sort()).toEqual(
            [
              fixture.memberships.admin,
              fixture.memberships.committee,
              fixture.memberships.committee2,
            ].sort(),
          );
          const searched = records(
            (
              await callMeeting(fixture, 'admin', 'meeting_owner_options', [
                fixture.societyId,
                'COMMITTEE2',
                50,
              ])
            ).items,
          );
          expect(searched.map((item) => item.membershipId)).toEqual([
            fixture.memberships.committee2,
          ]);
          await expectDomainError(
            saveAction(scheduled.meetingId, null, null, {
              title: 'Resident owner',
              ownerMembershipId: fixture.memberships.resident,
              dueOn,
              resolutionId: null,
            }),
            'meeting_owner_ineligible',
          );
          const committeeOwned = await saveAction(
            scheduled.meetingId,
            null,
            null,
            {
              title: 'Committee owner',
              ownerMembershipId: fixture.memberships.committee,
              dueOn,
              resolutionId: null,
            },
          );
          expect(committeeOwned).toMatchObject({ version: 1 });
        } finally {
          await updateMeetingSettings(fixture, {
            action_owner_scope: 'any_member',
          });
        }
      });

      it('keeps draft and committee meetings out of resident action lists', async () => {
        const dueOn = await localDate(7);
        const draft = await createMeeting(fixture);
        await expectDomainError(
          saveAction(draft.meetingId, null, null, {
            title: 'Draft action',
            ownerMembershipId: fixture.memberships.owner,
            dueOn,
            resolutionId: null,
          }),
          'meeting_invalid_state',
        );

        const startsAt = await databaseTimestamp(fixture, "+ interval '1 day'");
        const committee = await createScheduledMeeting(fixture, {
          meetingType: 'committee',
          startsAt,
          endsAt: new Date(
            new Date(startsAt).getTime() + 3_600_000,
          ).toISOString(),
        });
        for (const resident of ['owner', 'resident'] as const) {
          await expectDomainError(
            saveAction(committee.meetingId, null, null, {
              title: 'Resident committee action',
              ownerMembershipId: fixture.memberships[resident],
              dueOn,
              resolutionId: null,
            }),
            'meeting_owner_ineligible',
          );
        }
        const managed = await saveAction(committee.meetingId, null, null, {
          title: 'Committee action',
          ownerMembershipId: fixture.memberships.committee,
          dueOn,
          resolutionId: null,
        });
        expect(managed).toMatchObject({ version: 1 });
        const committeeItems = records(
          (
            await callMeeting(fixture, 'committee', 'meeting_my_actions', [
              fixture.societyId,
            ])
          ).items,
        );
        expect(
          committeeItems.find((item) => item.id === managed.actionId),
        ).toMatchObject({ meetingTitle: expect.any(String) });

        // Rows written before these rules existed must still not reveal the meeting title.
        const legacy = await database.asSuperuser(async (client) => {
          const inserted = await client.query<{ id: string }>(
            `insert into public.meeting_action_items(
               society_id,meeting_id,title,owner_membership_id,owner_name,due_on,created_by,updated_by)
             values ($1,$2,'Legacy action',$3,'Synthetic meeting owner',$4::date,$5,$5)
             returning id`,
            [
              fixture.societyId,
              committee.meetingId,
              fixture.memberships.owner,
              dueOn,
              fixture.actors.admin,
            ],
          );
          return inserted.rows[0]!.id;
        });
        const ownerItems = records(
          (
            await callMeeting(fixture, 'owner', 'meeting_my_actions', [
              fixture.societyId,
            ])
          ).items,
        );
        expect(ownerItems.find((item) => item.id === legacy)).toMatchObject({
          meetingId: committee.meetingId,
          meetingTitle: null,
        });
      });

      it('lets the owner or admin mark done and reopen, and lists the owner items', async () => {
        const held = await createHeldMeeting(fixture);
        const resolution = await callMeeting(
          fixture,
          'admin',
          'meeting_resolution_save',
          [
            fixture.societyId,
            held.meetingId,
            null,
            null,
            { title: 'Repaint', body: null, agendaItemId: null },
            requestId('resolution'),
          ],
        );
        const created = await saveAction(held.meetingId, null, null, {
          title: 'Book painters',
          ownerMembershipId: fixture.memberships.owner,
          dueOn: await localDate(5),
          resolutionId: resolution.resolutionId,
        });
        const actionId = created.actionId as string;
        for (const actor of ['owner2', 'committee', 'guard'] as const) {
          const refused = await errorFor(
            setActionStatus(actor, actionId, 1, 'done'),
          );
          expect(['42501', 'P0002']).toContain(refused.code);
        }
        await expectCode(
          setActionStatus('owner', actionId, 1, 'done', 'x'.repeat(501)),
          '22023',
        );
        await expectCode(
          setActionStatus('owner', actionId, 1, 'closed'),
          '22023',
        );
        const done = await setActionStatus(
          'owner',
          actionId,
          1,
          'done',
          'Booked',
        );
        expect(done).toEqual({ actionId, version: 2, status: 'done' });
        const row = await database.asSuperuser((client) =>
          client.query<{ completed_by: string | null; note: string | null }>(
            'select completed_by,note from public.meeting_action_items where id=$1',
            [actionId],
          ),
        );
        expect(row.rows[0]).toEqual({
          completed_by: fixture.actors.owner,
          note: 'Booked',
        });
        await expectCode(
          setActionStatus('admin', actionId, 1, 'open'),
          '40001',
        );
        expect(
          await setActionStatus('admin', actionId, 2, 'open'),
        ).toMatchObject({
          version: 3,
          status: 'open',
        });

        const mine = records(
          (
            await callMeeting(fixture, 'owner', 'meeting_my_actions', [
              fixture.societyId,
            ])
          ).items,
        );
        expect(mine.find((item) => item.id === actionId)).toMatchObject({
          meetingId: held.meetingId,
          title: 'Book painters',
          status: 'open',
          overdue: false,
          version: 3,
        });
        const memberList = await callMeeting(
          fixture,
          'owner',
          'meeting_member_list',
          [fixture.societyId],
        );
        expect(records(memberList.actions).map((item) => item.id)).toContain(
          actionId,
        );
        const tenantList = await callMeeting(
          fixture,
          'tenant',
          'meeting_my_actions',
          [fixture.societyId],
        );
        expect(records(tenantList.items).map((item) => item.id)).not.toContain(
          actionId,
        );
        const adminView = await callMeeting(
          fixture,
          'admin',
          'meeting_admin_get',
          [fixture.societyId, held.meetingId],
        );
        expect(
          records(adminView.actions).find((item) => item.id === actionId),
        ).toMatchObject({
          ownerMembershipId: fixture.memberships.owner,
          ownerName: fixture.names.owner,
          resolutionId: resolution.resolutionId,
          status: 'open',
        });
      });

      it('sends one overdue reminder per society-local day, skips done items, and does nothing when disabled', async () => {
        const scheduled = await createScheduledMeeting(fixture);
        const overdue = await saveAction(scheduled.meetingId, null, null, {
          title: 'Overdue task',
          ownerMembershipId: fixture.memberships.owner3,
          dueOn: await localDate(3),
          resolutionId: null,
        });
        const finished = await saveAction(scheduled.meetingId, null, null, {
          title: 'Finished task',
          ownerMembershipId: fixture.memberships.owner2,
          dueOn: await localDate(3),
          resolutionId: null,
        });
        await setActionStatus(
          'owner2',
          finished.actionId as string,
          finished.version as number,
          'done',
        );
        const yesterday = await localDate(-1);
        await forceActionDates(overdue.actionId as string, yesterday);
        await forceActionDates(finished.actionId as string, yesterday);

        await expectCode(
          callMeeting(fixture, 'admin', 'meeting_action_reminders_run', [
            fixture.societyId,
            requestId('reminders'),
          ]),
          '42501',
        );

        const request = requestId('reminders');
        expect(
          await callMeetingService(fixture, 'meeting_action_reminders_run', [
            fixture.societyId,
            request,
          ]),
        ).toEqual({ notified: 1 });
        expect(await notificationsFor(fixture, request)).toEqual([
          expect.objectContaining({
            user_id: fixture.actors.owner3,
            entity_type: 'meeting_action',
          }),
        ]);
        const stamped = await database.asSuperuser((client) =>
          client.query<{ value: string | null }>(
            'select last_overdue_notified_on::text as value from public.meeting_action_items where id=$1',
            [overdue.actionId],
          ),
        );
        expect(stamped.rows[0]?.value).toBe(await localDate(0));

        const again = requestId('reminders');
        expect(
          await callMeetingService(fixture, 'meeting_action_reminders_run', [
            fixture.societyId,
            again,
          ]),
        ).toEqual({ notified: 0 });
        expect(await notificationsFor(fixture, again)).toEqual([]);

        const mine = records(
          (
            await callMeeting(fixture, 'owner3', 'meeting_my_actions', [
              fixture.societyId,
            ])
          ).items,
        );
        expect(mine.find((item) => item.id === overdue.actionId)).toMatchObject(
          {
            overdue: true,
            dueOn: yesterday,
          },
        );

        await forceActionDates(overdue.actionId as string, null, true);
        await setModule(fixture, 'meeting', false);
        try {
          const disabled = requestId('reminders');
          expect(
            await callMeetingService(fixture, 'meeting_action_reminders_run', [
              fixture.societyId,
              disabled,
            ]),
          ).toEqual({ notified: 0 });
          expect(await notificationsFor(fixture, disabled)).toEqual([]);
        } finally {
          await setModule(fixture, 'meeting', true);
        }
      });
    });
  },
);
