// Exercise SOS screens and the alert banner with synthetic records and injected actions; never call hosted Auth or data.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  DEFAULT_SOS_SETTINGS,
  sosAlertInputSchema,
  sosCloseInputSchema,
  sosContactArchiveInputSchema,
  sosContactInputSchema,
  sosRaiseInputSchema,
  sosSettingsInputSchema,
  sosUpdateInputSchema,
  type SosAlert,
  type SosBannerAlert,
  type SosContact,
  type SosEvent,
  type SosWorkspace,
} from '@/core/sos/validation';
import {
  SosRouteState,
  SosWorkspaceView,
  type SosActions,
  type SosAudience,
  type SosRouteStateKind,
} from '@/components/sos/workspace';
import {
  SosAlertBannerView,
  type SosSoundState,
} from '@/components/sos/alert-banner';
import { Banner } from '@/components/ui/feedback';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { SelectInput } from '@/components/ui/select-input';

const SOCIETY_ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const UNIT_ID = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const OTHER_UNIT_ID = 'd1d55fc3-0751-4b79-86c1-5b3e25942392';
const ALERT_ID = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const RAISED_AT = '2026-11-15T10:00:00Z';

const roleSchema = z.enum(['resident', 'guard', 'admin', 'committee']);
type FixtureRole = z.infer<typeof roleSchema>;
const ROLE_NAMES: Record<FixtureRole, string> = {
  resident: 'Resident',
  guard: 'Guard',
  admin: 'Administrator',
  committee: 'Committee member',
};
const ROUTE_STATES = [
  'loading',
  'error',
  'disabled',
  'denied',
  'invalid_filters',
] as const satisfies readonly SosRouteStateKind[];
const scenarioSchema = z.enum(['open', 'empty', 'history', ...ROUTE_STATES]);
type Scenario = z.infer<typeof scenarioSchema>;
const soundSchema = z.enum(['on', 'blocked', 'muted', 'unsupported', 'off']);

const INITIAL_CONTACTS: SosContact[] = [
  ['Emergency', '112'],
  ['Ambulance', '108'],
  ['Fire', '101'],
  ['Police', '100'],
].map(([label, phone], index) => ({
  id: `e${index}d55fc3-0751-4b79-86c1-5b3e25942392`,
  label,
  phone,
  sort_order: (index + 1) * 10,
  archived: false,
}));

function input(data: FormData): unknown {
  const raw = data.get('input');
  if (typeof raw !== 'string') throw new Error('Missing synthetic SOS input.');
  return JSON.parse(raw);
}
function failure(message: string): ServerActionResult<unknown> {
  return { ok: false, code: 'CONFLICT', message };
}
function invalid(error: z.ZodError): ServerActionResult<unknown> {
  return {
    ok: false,
    code: 'VALIDATION_FAILED',
    message: error.issues[0]?.message ?? 'Check the form.',
  };
}
function event(
  action: SosEvent['action'],
  actor: string,
  note: string | null = null,
): SosEvent {
  return {
    id: crypto.randomUUID(),
    action,
    note,
    actor_name: actor,
    created_at: new Date().toISOString(),
  };
}
function sampleAlert(overrides: Partial<SosAlert> = {}): SosAlert {
  return {
    id: ALERT_ID,
    unit_id: UNIT_ID,
    unit_label: 'A-101',
    category: 'medical',
    note: 'Elderly resident has fallen near the lift.',
    status: 'raised',
    raised_role: 'resident',
    raised_at: RAISED_AT,
    raised_by_name: 'Asha Rao',
    is_mine: true,
    can_cancel: true,
    can_respond: false,
    acknowledged_at: null,
    acknowledged_by_name: null,
    closed_at: null,
    close_reason: null,
    close_note: null,
    events: [
      {
        id: 'f0d55fc3-0751-4b79-86c1-5b3e25942392',
        action: 'raised',
        note: null,
        actor_name: 'Asha Rao',
        created_at: RAISED_AT,
      },
    ],
    ...overrides,
  };
}
function historyAlerts(count: number): SosAlert[] {
  return Array.from({ length: count }, (_, index) =>
    sampleAlert({
      id: crypto.randomUUID(),
      category:
        index % 3 === 0 ? 'fire' : index % 3 === 1 ? 'security' : 'other',
      note: null,
      status: index % 4 === 0 ? 'cancelled' : 'closed',
      raised_at: new Date(
        Date.parse(RAISED_AT) - (index + 1) * 86_400_000,
      ).toISOString(),
      can_cancel: false,
      acknowledged_at: index % 4 === 0 ? null : RAISED_AT,
      acknowledged_by_name: index % 4 === 0 ? null : 'Gate guard',
      closed_at: RAISED_AT,
      close_reason: index % 4 === 0 ? 'raised_by_mistake' : 'resolved',
      events: [],
    }),
  );
}

export default function SosFixturePage() {
  const [role, setRole] = useState<FixtureRole>('resident');
  const [scenario, setScenario] = useState<Scenario>('open');
  const [readOnly, setReadOnly] = useState(false);
  const [sound, setSound] = useState<SosSoundState>('blocked');
  const [alerts, setAlerts] = useState<SosAlert[]>(() => [sampleAlert()]);
  const [contacts, setContacts] = useState<SosContact[]>(INITIAL_CONTACTS);
  const [settings, setSettings] = useState<SosWorkspace['settings']>({
    ...DEFAULT_SOS_SETTINGS,
  });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);

  const responder = role !== 'resident';
  const audience: SosAudience =
    role === 'resident'
      ? 'resident'
      : role === 'guard'
        ? 'guard'
        : 'management';
  const actor = ROLE_NAMES[role];
  const open = alerts.filter(
    (alert) => alert.status === 'raised' || alert.status === 'acknowledged',
  );
  const closed = [
    ...alerts.filter((alert) => !open.includes(alert)),
    ...(scenario === 'history' ? historyAlerts(32) : []),
  ];
  const view = (alert: SosAlert): SosAlert => ({
    ...alert,
    is_mine: role === 'resident' && alert.raised_role === 'resident',
    can_cancel:
      !readOnly &&
      alert.status === 'raised' &&
      ((role === 'resident' && alert.raised_role === 'resident') ||
        (role === 'guard' && alert.raised_role === 'guard')),
    can_respond: responder && !readOnly,
    note:
      role === 'resident' && alert.raised_role !== 'resident'
        ? null
        : alert.note,
  });
  const workspace: SosWorkspace = {
    timezone: 'Asia/Kolkata',
    unit_label: 'Flat',
    can_write: !readOnly,
    can_raise: role === 'resident' || role === 'guard',
    can_respond: responder,
    can_manage: role === 'admin',
    settings,
    my_units:
      role === 'resident'
        ? [
            { id: UNIT_ID, label: 'A-101' },
            { id: OTHER_UNIT_ID, label: 'B-204' },
          ]
        : [],
    units:
      role === 'guard'
        ? [
            { id: UNIT_ID, label: 'A-101' },
            { id: OTHER_UNIT_ID, label: 'B-204' },
          ]
        : [],
    open: scenario === 'empty' ? [] : open.map(view),
    history: {
      items: closed.slice(offset, offset + limit).map(view),
      total: closed.length,
      limit,
      offset,
    },
    contacts: role === 'admin' ? contacts : contacts.filter((c) => !c.archived),
  };
  const bannerAlerts: SosBannerAlert[] = open
    .filter((alert) => !dismissed.includes(alert.id))
    .map((alert) => ({
      id: alert.id,
      society_id: SOCIETY_ID,
      society_name: 'Lakeview Residency',
      category: alert.category,
      status: alert.status === 'acknowledged' ? 'acknowledged' : 'raised',
      raised_role: alert.raised_role,
      unit_label: alert.unit_label,
      raised_at: alert.raised_at,
      audience: role,
      note: role === 'resident' ? null : alert.note,
    }));

  function change(id: string, next: (alert: SosAlert) => SosAlert) {
    setAlerts((current) =>
      current.map((alert) => (alert.id === id ? next(alert) : alert)),
    );
  }
  function find(id: string) {
    return alerts.find((alert) => alert.id === id);
  }

  const actions: SosActions = {
    raise: async (data) => {
      const parsed = sosRaiseInputSchema.safeParse(input(data));
      if (!parsed.success) return invalid(parsed.error);
      if (readOnly) return failure('This society is read-only.');
      const unit = workspace.my_units
        .concat(workspace.units)
        .find((option) => option.id === parsed.data.unitId);
      if (open.some((alert) => alert.unit_id === parsed.data.unitId && unit))
        return failure('An SOS is already open for this flat.');
      const id = crypto.randomUUID();
      setAlerts((current) => [
        sampleAlert({
          id,
          unit_id: unit?.id ?? null,
          unit_label: unit?.label ?? null,
          category: parsed.data.category,
          note: parsed.data.note,
          raised_role: role === 'guard' ? 'guard' : 'resident',
          raised_at: new Date().toISOString(),
          raised_by_name: actor,
          events: [event('raised', actor)],
        }),
        ...current,
      ]);
      return {
        ok: true,
        data: { id },
        message: 'SOS raised. Responders have been alerted.',
      };
    },
    cancel: async (data) => {
      const parsed = sosAlertInputSchema.safeParse(input(data));
      if (!parsed.success) return invalid(parsed.error);
      if (find(parsed.data.alertId)?.status !== 'raised')
        return failure('A responder has already acknowledged this SOS.');
      change(parsed.data.alertId, (alert) => ({
        ...alert,
        status: 'cancelled',
        closed_at: new Date().toISOString(),
        close_reason: 'raised_by_mistake',
        events: [
          ...alert.events,
          event('cancelled', actor, 'Raised by mistake'),
        ],
      }));
      return { ok: true, message: 'SOS cancelled as raised by mistake.' };
    },
    acknowledge: async (data) => {
      const parsed = sosAlertInputSchema.safeParse(input(data));
      if (!parsed.success) return invalid(parsed.error);
      if (find(parsed.data.alertId)?.status !== 'raised')
        return failure('This SOS was already acknowledged or closed.');
      change(parsed.data.alertId, (alert) => ({
        ...alert,
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_name: actor,
        events: [...alert.events, event('acknowledged', actor)],
      }));
      return { ok: true, message: 'SOS acknowledged.' };
    },
    update: async (data) => {
      const parsed = sosUpdateInputSchema.safeParse(input(data));
      if (!parsed.success) return invalid(parsed.error);
      change(parsed.data.alertId, (alert) => ({
        ...alert,
        events: [...alert.events, event('updated', actor, parsed.data.note)],
      }));
      return { ok: true, message: 'Update added.' };
    },
    close: async (data) => {
      const parsed = sosCloseInputSchema.safeParse(input(data));
      if (!parsed.success) return invalid(parsed.error);
      if (find(parsed.data.alertId)?.status !== 'acknowledged')
        return failure('Acknowledge the SOS before closing it.');
      change(parsed.data.alertId, (alert) => ({
        ...alert,
        status: 'closed',
        closed_at: new Date().toISOString(),
        close_reason: parsed.data.reason,
        close_note: parsed.data.note,
        events: [...alert.events, event('closed', actor, parsed.data.note)],
      }));
      return { ok: true, message: 'SOS closed.' };
    },
    settings: async (data) => {
      const parsed = sosSettingsInputSchema.safeParse(input(data));
      if (!parsed.success) return invalid(parsed.error);
      setSettings({
        notify_guards: parsed.data.notifyGuards,
        notify_admins: parsed.data.notifyAdmins,
        notify_committee: parsed.data.notifyCommittee,
        resident_scope: parsed.data.residentScope,
      });
      return { ok: true, message: 'Alert recipients saved.' };
    },
    saveContact: async (data) => {
      const parsed = sosContactInputSchema.safeParse(input(data));
      if (!parsed.success) return invalid(parsed.error);
      const value = parsed.data;
      setContacts((current) => {
        const record: SosContact = {
          id: value.contactId ?? crypto.randomUUID(),
          label: value.label,
          phone: value.phone,
          sort_order: value.sortOrder,
          archived: false,
        };
        const next = value.contactId
          ? current.map((contact) =>
              contact.id === value.contactId
                ? { ...record, archived: contact.archived }
                : contact,
            )
          : [...current, record];
        return next.toSorted((a, b) => a.sort_order - b.sort_order);
      });
      return { ok: true, message: 'Contact saved.' };
    },
    archiveContact: async (data) => {
      const parsed = sosContactArchiveInputSchema.safeParse(input(data));
      if (!parsed.success) return invalid(parsed.error);
      setContacts((current) =>
        current.map((contact) =>
          contact.id === parsed.data.contactId
            ? { ...contact, archived: parsed.data.archived }
            : contact,
        ),
      );
      return {
        ok: true,
        message: parsed.data.archived
          ? 'Contact archived.'
          : 'Contact restored.',
      };
    },
  };

  const routeState = ROUTE_STATES.find((state) => state === scenario);
  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic SOS fixture" tone="info">
          Development-only alerts and injected actions. No hosted Auth, database
          writes, notifications or Realtime. Reload to reset.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-3">
          <SelectInput
            id="fixture-role"
            label="Fixture role"
            value={role}
            options={roleSchema.options.map((value) => ({
              value,
              label: ROLE_NAMES[value],
            }))}
            onChange={(event) =>
              setRole(roleSchema.parse(event.currentTarget.value))
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
            onChange={(event) => {
              setScenario(scenarioSchema.parse(event.currentTarget.value));
              setOffset(0);
            }}
          />
          <SelectInput
            id="fixture-sound"
            label="Banner sound state"
            value={sound}
            options={soundSchema.options.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) =>
              setSound(soundSchema.parse(event.currentTarget.value))
            }
          />
          <CheckboxInput
            id="fixture-read-only"
            label="Read-only society"
            checked={readOnly}
            onChange={(event) => setReadOnly(event.currentTarget.checked)}
          />
        </div>
      </header>
      <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
        <SosAlertBannerView
          alerts={bannerAlerts}
          sound={role === 'guard' ? sound : 'off'}
          onDismiss={(id) => setDismissed((current) => [...current, id])}
          onEnableSound={() => setSound('on')}
          onToggleMute={() =>
            setSound((current) => (current === 'muted' ? 'on' : 'muted'))
          }
        />
        {routeState ? (
          <SosRouteState
            kind={routeState}
            returnHref="/fixtures/sos"
            referenceId={routeState === 'error' ? 'ERR-F1A2B3C4D5' : undefined}
          />
        ) : (
          <SosWorkspaceView
            workspace={workspace}
            audience={audience}
            baseHref="/fixtures/sos"
            actions={actions}
            onPageChange={(nextOffset, nextLimit) => {
              setOffset(nextOffset);
              setLimit(nextLimit);
            }}
          />
        )}
      </main>
    </>
  );
}
