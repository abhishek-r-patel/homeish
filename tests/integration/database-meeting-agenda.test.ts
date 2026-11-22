// Verify P45 duration persistence, template access, archive/restore and snapshot copies.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asMeetingUser,
  callMeeting,
  createMeeting,
  createMeetingFixture,
  expectCode,
  meetingInput,
  requestId,
  setModule,
  type MeetingFixture,
} from './support/meeting-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

const template = {
  name: 'Synthetic AGM standard',
  meetingTypes: ['agm'],
  items: [
    {
      title: 'Accounts',
      description: 'Review the annual accounts.',
      suggestedDurationMinutes: 20,
    },
    {
      title: 'Repairs',
      description: null,
      suggestedDurationMinutes: null,
    },
  ],
};

describe.skipIf(!hasDatabase)('meeting agenda enhancements', () => {
  let database: TestDatabase;
  let fixture: MeetingFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createMeetingFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function durationRows(meetingId: string) {
    const result = await database.asSuperuser((client) =>
      client.query<{ id: string; durationMinutes: number | null }>(
        `select id, duration_minutes as "durationMinutes"
         from public.meeting_agenda_items
         where society_id=$1 and meeting_id=$2
         order by position`,
        [fixture.societyId, meetingId],
      ),
    );
    return result.rows;
  }

  it('stores optional durations, returns them and rejects invalid values', async () => {
    const created = await createMeeting(fixture, {
      agenda: [
        { title: 'Accounts', description: null, durationMinutes: 20 },
        { title: 'Repairs', description: null, durationMinutes: null },
      ],
    });
    expect(
      (await durationRows(created.meetingId)).map(
        (item) => item.durationMinutes,
      ),
    ).toEqual([20, null]);

    const rows = await asMeetingUser(
      fixture,
      fixture.actors.admin,
      async (client) => {
        const result = await client.query<{ value: unknown }>(
          `select public.meeting_agenda_durations_get($1,$2) as value`,
          [fixture.societyId, created.meetingId],
        );
        return result.rows[0]?.value;
      },
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ durationMinutes: 20 }),
        expect.objectContaining({ durationMinutes: null }),
      ]),
    );

    await expectCode(
      createMeeting(fixture, {
        agenda: [{ title: 'Invalid', description: null, durationMinutes: 0 }],
      }),
      '22023',
    );
  });

  it('preserves unchanged durations for legacy updates and clears explicit nulls', async () => {
    const created = await createMeeting(fixture, {
      agenda: [
        { title: 'Legacy accounts', description: null, durationMinutes: 20 },
      ],
    });
    const legacyUpdate = await meetingInput(fixture, {
      agenda: [{ title: 'Legacy accounts', description: null }],
    });
    const updated = await callMeeting(fixture, 'admin', 'meeting_update', [
      fixture.societyId,
      created.meetingId,
      created.version,
      legacyUpdate,
      requestId('legacy-duration-preserved'),
    ]);
    expect(await durationRows(created.meetingId)).toEqual([
      expect.objectContaining({ durationMinutes: 20 }),
    ]);

    const preservedId = (await durationRows(created.meetingId))[0]!.id;
    const idUpdate = {
      ...legacyUpdate,
      agenda: [
        {
          id: preservedId,
          title: 'Renamed legacy accounts',
          description: null,
        },
      ],
    };
    const renamed = await callMeeting(fixture, 'admin', 'meeting_update', [
      fixture.societyId,
      created.meetingId,
      updated.version,
      idUpdate,
      requestId('legacy-duration-rename'),
    ]);
    expect(await durationRows(created.meetingId)).toEqual([
      expect.objectContaining({ durationMinutes: null }),
    ]);

    const clearUpdate = {
      ...legacyUpdate,
      agenda: [
        {
          title: 'Renamed legacy accounts',
          description: null,
          durationMinutes: null,
        },
      ],
    };
    await callMeeting(fixture, 'admin', 'meeting_update', [
      fixture.societyId,
      created.meetingId,
      renamed.version,
      clearUpdate,
      requestId('explicit-duration-cleared'),
    ]);
    expect(await durationRows(created.meetingId)).toEqual([
      expect.objectContaining({ durationMinutes: null }),
    ]);
  });

  it('allows admins only and isolates templates by tenant and module', async () => {
    const clientRequestId = crypto.randomUUID();
    const saved = await callMeeting(
      fixture,
      'admin',
      'meeting_agenda_template_save',
      [
        fixture.societyId,
        null,
        null,
        clientRequestId,
        template,
        requestId('template-create'),
      ],
    );
    expect(saved.templateId).toEqual(expect.any(String));

    const listed = await callMeeting(
      fixture,
      'admin',
      'meeting_agenda_templates_get',
      [fixture.societyId, null],
    );
    expect(listed.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: saved.templateId,
          name: template.name,
          meetingTypes: ['agm'],
        }),
      ]),
    );

    const repeated = await callMeeting(
      fixture,
      'admin',
      'meeting_agenda_template_save',
      [
        fixture.societyId,
        null,
        null,
        clientRequestId,
        template,
        requestId('template-repeat'),
      ],
    );
    expect(repeated).toEqual(saved);

    const concurrentRequestId = crypto.randomUUID();
    const concurrent = await Promise.all(
      ['concurrent-template-a', 'concurrent-template-b'].map((label) =>
        callMeeting(fixture, 'admin', 'meeting_agenda_template_save', [
          fixture.societyId,
          null,
          null,
          concurrentRequestId,
          { ...template, name: 'Synthetic concurrent template' },
          requestId(label),
        ]),
      ),
    );
    expect(concurrent[0]).toEqual(concurrent[1]);

    await expectCode(
      callMeeting(fixture, 'committee', 'meeting_agenda_templates_get', [
        fixture.societyId,
        null,
      ]),
      '42501',
    );
    await expectCode(
      callMeeting(fixture, 'foreignAdmin', 'meeting_agenda_templates_get', [
        fixture.societyId,
        null,
      ]),
      '42501',
    );

    await setModule(fixture, 'meeting', false);
    try {
      await expectCode(
        callMeeting(fixture, 'admin', 'meeting_agenda_templates_get', [
          fixture.societyId,
          null,
        ]),
        '42501',
      );
    } finally {
      await setModule(fixture, 'meeting', true);
    }
  });

  it('checks versions and archives/restores templates without changing copied agendas', async () => {
    const saved = await callMeeting(
      fixture,
      'admin',
      'meeting_agenda_template_save',
      [
        fixture.societyId,
        null,
        null,
        crypto.randomUUID(),
        { ...template, name: 'Synthetic copy check' },
        requestId('copy-template'),
      ],
    );
    const meeting = await createMeeting(fixture, {
      agenda: [
        {
          title: template.items[0]!.title,
          description: template.items[0]!.description,
          durationMinutes: template.items[0]!.suggestedDurationMinutes,
        },
      ],
    });

    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_agenda_template_save', [
        fixture.societyId,
        saved.templateId,
        Number(saved.version) + 1,
        crypto.randomUUID(),
        template,
        requestId('stale-template'),
      ]),
      '40001',
    );

    const archived = await callMeeting(
      fixture,
      'admin',
      'meeting_agenda_template_archive',
      [
        fixture.societyId,
        saved.templateId,
        saved.version,
        true,
        requestId('archive-template'),
      ],
    );
    expect(archived.archived).toBe(true);
    expect(await durationRows(meeting.meetingId)).toEqual([
      expect.objectContaining({ durationMinutes: 20 }),
    ]);

    const restored = await callMeeting(
      fixture,
      'admin',
      'meeting_agenda_template_archive',
      [
        fixture.societyId,
        saved.templateId,
        archived.version,
        false,
        requestId('restore-template'),
      ],
    );
    expect(restored.archived).toBe(false);

    const updated = await callMeeting(
      fixture,
      'admin',
      'meeting_agenda_template_save',
      [
        fixture.societyId,
        saved.templateId,
        restored.version,
        crypto.randomUUID(),
        {
          ...template,
          name: 'Synthetic edited copy check',
          items: [
            {
              title: 'Changed future item',
              description: null,
              suggestedDurationMinutes: 99,
            },
          ],
        },
        requestId('update-template'),
      ],
    );
    expect(updated.version).toBe(Number(restored.version) + 1);
    expect(await durationRows(meeting.meetingId)).toEqual([
      expect.objectContaining({ durationMinutes: 20 }),
    ]);
  });
});
