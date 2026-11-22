// Verify P45 duration, estimate and template input contracts.
import { describe, expect, it } from 'vitest';
import { deriveAgendaTiming } from '../../src/core/meeting/agenda';
import {
  meetingAgendaTemplateInputSchema,
  meetingInputSchema,
} from '../../src/core/meeting/validation';

const startsAt = '2026-11-25T12:30:00.000Z';

describe('meeting agenda estimates', () => {
  it('follows agenda order and rolls across the day', () => {
    expect(
      deriveAgendaTiming('2026-11-25T23:50:00.000Z', [
        { durationMinutes: 20 },
        { durationMinutes: 30 },
      ]),
    ).toEqual([
      {
        estimatedStartsAt: '2026-11-25T23:50:00.000Z',
        estimatedEndsAt: '2026-11-26T00:10:00.000Z',
      },
      {
        estimatedStartsAt: '2026-11-26T00:10:00.000Z',
        estimatedEndsAt: '2026-11-26T00:40:00.000Z',
      },
    ]);
  });

  it('stops after a missing duration but keeps that item start known', () => {
    expect(
      deriveAgendaTiming(startsAt, [
        { durationMinutes: 15 },
        { durationMinutes: null },
        { durationMinutes: 10 },
      ]),
    ).toEqual([
      {
        estimatedStartsAt: startsAt,
        estimatedEndsAt: '2026-11-25T12:45:00.000Z',
      },
      {
        estimatedStartsAt: '2026-11-25T12:45:00.000Z',
        estimatedEndsAt: null,
      },
      { estimatedStartsAt: null, estimatedEndsAt: null },
    ]);
  });

  it('returns no estimates without a meeting start or for an invalid start', () => {
    expect(deriveAgendaTiming(null, [{ durationMinutes: 10 }])).toEqual([
      { estimatedStartsAt: null, estimatedEndsAt: null },
    ]);
    expect(deriveAgendaTiming('not-a-date', [{ durationMinutes: 10 }])).toEqual(
      [{ estimatedStartsAt: null, estimatedEndsAt: null }],
    );
  });
});

const meeting = {
  meetingType: 'agm' as const,
  title: 'Synthetic meeting',
  description: null,
  startsAt,
  endsAt: '2026-11-25T14:30:00.000Z',
  venue: 'Clubhouse',
  onlineUrl: null,
  invitees: { scope: 'default' as const },
};

describe('meeting agenda contracts', () => {
  it('accepts an optional duration and normalizes an omitted value to null', () => {
    expect(
      meetingInputSchema.parse({
        ...meeting,
        agenda: [
          { title: 'Accounts', description: null },
          {
            title: 'Repairs',
            description: null,
            durationMinutes: 1440,
          },
        ],
      }).agenda,
    ).toEqual([
      {
        title: 'Accounts',
        description: null,
        durationMinutes: null,
      },
      {
        title: 'Repairs',
        description: null,
        durationMinutes: 1440,
      },
    ]);
  });

  it.each([0, 1441, 2.5])('rejects duration %s', (durationMinutes) => {
    expect(
      meetingInputSchema.safeParse({
        ...meeting,
        agenda: [{ title: 'Accounts', description: null, durationMinutes }],
      }).success,
    ).toBe(false);
  });

  it('requires distinct meeting-type tags and valid template items', () => {
    const base = {
      templateId: null,
      expectedVersion: null,
      clientRequestId: 'e0000000-0000-4000-8000-000000000001',
      template: {
        name: 'AGM standard',
        meetingTypes: ['agm'] as const,
        items: [
          {
            title: 'Accounts',
            description: null,
            suggestedDurationMinutes: 20,
          },
        ],
      },
    };
    expect(meetingAgendaTemplateInputSchema.safeParse(base).success).toBe(true);
    expect(
      meetingAgendaTemplateInputSchema.safeParse({
        ...base,
        template: {
          ...base.template,
          meetingTypes: ['agm', 'agm'],
        },
      }).success,
    ).toBe(false);
    expect(
      meetingAgendaTemplateInputSchema.safeParse({
        ...base,
        template: { ...base.template, items: [] },
      }).success,
    ).toBe(false);
  });
});
