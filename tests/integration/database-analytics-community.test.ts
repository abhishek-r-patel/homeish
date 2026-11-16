// Verify the community analytics metrics: numbers on small synthetic data, month bucketing, society isolation,
// empty-society shapes and that the metric functions stay private.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';
import {
  addDays,
  COMMUNITY_METRICS,
  createCommunityFixture,
  insertLink,
  insertRow,
  metric,
  pointValues,
  seed,
  seedBoth,
  societyToday,
  type CommunityFixture,
  type MetricValue,
} from './support/analytics-community-fixtures';

// Trends read whole months from January to mid-June 2026 (society-local, India).
const FROM = '2026-01-01';
const TO = '2026-06-15';

function expectShape(value: MetricValue, from: string, to: string): void {
  expect(['trend', 'breakdown', 'stat']).toContain(value.kind);
  expect(value.series.length).toBeGreaterThan(0);
  for (const series of value.series) {
    expect(series.key).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(series.label.length).toBeGreaterThan(0);
  }
  const keys = value.series.map((series) => series.key).sort();
  if (value.kind === 'trend') {
    const months: string[] = [];
    const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 7) <= to.slice(0, 7)) {
      months.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    expect(value.points?.map((point) => point.period)).toEqual(months);
    for (const point of value.points ?? []) {
      expect(Object.keys(point.values).sort()).toEqual(keys);
    }
  } else if (value.kind === 'breakdown') {
    expect(Array.isArray(value.items)).toBe(true);
    for (const item of value.items ?? []) {
      expect(Object.keys(item.values).sort()).toEqual(keys);
    }
  } else {
    expect(Object.keys(value.values ?? {}).sort()).toEqual(keys);
  }
}

describe.skipIf(!hasDatabase)('community analytics metrics', () => {
  let database: TestDatabase;
  let fixture: CommunityFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createCommunityFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('returns a valid empty shape for every metric on a society with no data', async () => {
    for (const key of COMMUNITY_METRICS) {
      const value = await metric(fixture, key, '2026-01-01', '2026-06-15');
      expectShape(value, '2026-01-01', '2026-06-15');
      if (value.kind === 'breakdown') expect(value.items).toEqual([]);
      if (value.kind === 'stat') {
        expect(Object.values(value.values ?? {}).every((n) => n === 0)).toBe(
          true,
        );
      }
      if (value.kind === 'trend') {
        const additive = ['count', 'paise', 'quantity'].includes(value.unit);
        for (const point of value.points ?? []) {
          for (const number of Object.values(point.values)) {
            expect(number).toBe(additive ? 0 : null);
          }
        }
      }
    }
  });

  it('keeps every community metric function private to the dashboard', async () => {
    const result = await database.asSuperuser((client) =>
      client.query<{ name: string; callable: boolean; definer: boolean }>(
        `select p.proname as name,
           has_function_privilege('authenticated', p.oid, 'execute')
             or has_function_privilege('anon', p.oid, 'execute')
             or has_function_privilege('service_role', p.oid, 'execute') as callable,
           p.prosecdef as definer
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'private' and p.proname = any($1)`,
        [
          COMMUNITY_METRICS.map(
            (key) => `analytics_metric_${key.replace('.', '_')}`,
          ),
        ],
      ),
    );
    expect(result.rows).toHaveLength(COMMUNITY_METRICS.length);
    for (const row of result.rows) {
      expect(row.callable, row.name).toBe(false);
      expect(row.definer, row.name).toBe(true);
    }
  });

  it('sorts breakdowns, keeps 20 items and sums the rest into Other only for additive units', async () => {
    const items = Array.from({ length: 23 }, (_, index) => ({
      label: `Item ${String(index + 1).padStart(2, '0')}`,
      values: { total: index + 1 },
    }));
    const shaped = await database.asSuperuser((client) =>
      client.query<{ count: MetricValue; rating: MetricValue }>(
        `select private.analytics_community_breakdown('count', $1, $2) as count,
           private.analytics_community_breakdown('rating', $1, $2) as rating`,
        [
          JSON.stringify([{ key: 'total', label: 'Total' }]),
          JSON.stringify(items),
        ],
      ),
    );
    const { count, rating } = shaped.rows[0]!;
    expect(count.items).toHaveLength(21);
    expect(count.items![0]).toEqual({
      label: 'Item 23',
      values: { total: 23 },
    });
    expect(count.items![19]!.label).toBe('Item 04');
    expect(count.items![20]).toEqual({ label: 'Other', values: { total: 6 } });
    expect(rating.items).toHaveLength(20);
    expect(rating.items!.map((item) => item.label)).not.toContain('Other');
  });

  it('counts directory vehicles by type and those awaiting verification', async () => {
    await seedBoth(fixture, async (client, society) => {
      const vehicle = (type: string, status: string, verified: boolean) =>
        insertRow(client, 'directory_vehicles', {
          society_id: society.id,
          unit_id: society.unitIds[0],
          membership_id: society.residentMembershipId,
          vehicle_type: type,
          registration_number: `KA01${randomUUID()
            .slice(0, 8)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')}`,
          status,
          verified_at: verified ? '2026-02-01T00:00:00Z' : null,
          verified_by: verified ? society.adminId : null,
          client_request_id: randomUUID(),
          created_by: society.residentId,
        });
      await vehicle('car', 'active', false);
      await vehicle('car', 'active', true);
      await vehicle('two_wheeler', 'active', true);
      await vehicle('car', 'inactive', false);
    });
    const vehicles = await metric(fixture, 'directory.vehicles', FROM, TO);
    expect(vehicles.items).toEqual([
      { label: 'Car', values: { vehicles: 2 } },
      { label: 'Two-wheeler', values: { vehicles: 1 } },
    ]);
    const pending = await metric(
      fixture,
      'directory.pending_verification',
      FROM,
      TO,
    );
    expect(pending.values).toEqual({ pending: 1 });
  });

  it('buckets completed moves by society-local month and counts undecided requests', async () => {
    await seedBoth(fixture, async (client, society) => {
      const move = (kind: string, status: string, completedAt: string | null) =>
        insertRow(client, 'tenancy_moves', {
          society_id: society.id,
          unit_id: society.unitIds[0],
          tenant_membership_id: society.residentMembershipId,
          occupancy_id: randomUUID(),
          kind,
          starts_at: '2026-03-01T00:00:00Z',
          ends_at: '2027-03-01T00:00:00Z',
          agreement_expires_on: kind === 'move_in' ? '2027-03-01' : null,
          status,
          approved_at: ['approved', 'completed'].includes(status)
            ? '2026-02-20T00:00:00Z'
            : null,
          approved_by: ['approved', 'completed'].includes(status)
            ? society.adminId
            : null,
          completed_at: completedAt,
          completed_by: completedAt ? society.adminId : null,
          client_request_id: randomUUID(),
          created_by: society.residentId,
          updated_by: society.residentId,
        });
      // 19:00 UTC on 31 March is 00:30 on 1 April in India; 18:00 UTC is still 31 March.
      await move('move_in', 'completed', '2026-03-31T19:00:00Z');
      await move('move_out', 'completed', '2026-03-31T18:00:00Z');
      await move('move_in', 'approved', null);
      await move('move_in', 'pending_review', null);
      await move('move_in', 'awaiting_consent', null);
      await move('move_out', 'rejected', null);
    });
    const moves = pointValues(await metric(fixture, 'tenancy.moves', FROM, TO));
    expect(moves['2026-03']).toEqual({ move_ins: 0, move_outs: 1 });
    expect(moves['2026-04']).toEqual({ move_ins: 1, move_outs: 0 });
    expect(moves['2026-05']).toEqual({ move_ins: 0, move_outs: 0 });
    const pending = await metric(fixture, 'tenancy.pending', FROM, TO);
    expect(pending.values).toEqual({ pending: 2 });
  });

  it('counts published documents and download links per month', async () => {
    await seedBoth(fixture, async (client, society) => {
      const document = (createdAt: string, archived: boolean) =>
        insertRow(client, 'documents', {
          society_id: society.id,
          folder_id: randomUUID(),
          title: 'Synthetic bye-laws',
          created_at: createdAt,
          archived_at: archived ? '2026-05-01T00:00:00Z' : null,
          archived_by: archived ? society.adminId : null,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      await document('2026-02-03T05:00:00Z', false);
      await document('2026-02-20T05:00:00Z', true);
      await document('2026-04-01T05:00:00Z', false);
      await document('2025-12-31T05:00:00Z', false);
      for (const [action, createdAt] of [
        ['document.download', '2026-05-02T05:00:00Z'],
        ['document.download', '2026-05-30T05:00:00Z'],
        ['document.download', '2026-01-10T05:00:00Z'],
        ['document.archive', '2026-05-02T05:00:00Z'],
      ] as const) {
        await client.query(
          `insert into public.audit_logs(society_id,action,entity_type,created_at)
           values($1,$2,'document_version',$3)`,
          [society.id, action, createdAt],
        );
      }
    });
    const published = pointValues(
      await metric(fixture, 'document.published', FROM, TO),
    );
    expect(published['2026-01']).toEqual({ published: 0 });
    expect(published['2026-02']).toEqual({ published: 2 });
    expect(published['2026-04']).toEqual({ published: 1 });
    const downloads = pointValues(
      await metric(fixture, 'document.downloads', FROM, TO),
    );
    expect(downloads['2026-01']).toEqual({ downloads: 1 });
    expect(downloads['2026-05']).toEqual({ downloads: 2 });
  });

  it('reports parking occupancy today and wrong-parking reports per month', async () => {
    await seedBoth(fixture, async (client, society) => {
      const slot = (label: string, type: string, archived = false) =>
        insertRow(client, 'parking_slots', {
          society_id: society.id,
          label,
          slot_type: type,
          archived_at: archived ? '2026-01-01T00:00:00Z' : null,
          archived_by: archived ? society.adminId : null,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      const allocate = (slotId: string, ended: boolean) =>
        insertRow(client, 'parking_allocations', {
          society_id: society.id,
          slot_id: slotId,
          unit_id: society.unitIds[0],
          started_by: society.adminId,
          ended_at: ended ? '2099-01-01T00:00:00Z' : null,
          ended_by: ended ? society.adminId : null,
        });
      await allocate(await slot('P1', 'car'), false);
      await allocate(await slot('P2', 'car'), true);
      await slot('P3', 'ev');
      await allocate(await slot('V1', 'visitor'), false);
      await allocate(await slot('P4', 'car', true), false);
      const report = (createdAt: string, resolvedAt: string | null) =>
        insertRow(client, 'parking_reports', {
          society_id: society.id,
          reporter_role: 'guard',
          vehicle_number: 'KA01AB1234',
          status: resolvedAt ? 'resolved' : 'open',
          created_at: createdAt,
          resolved_at: resolvedAt,
          resolved_by: resolvedAt ? society.adminId : null,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      await report('2026-01-05T05:00:00Z', '2026-02-02T05:00:00Z');
      await report('2026-01-06T05:00:00Z', null);
      await report('2025-12-30T05:00:00Z', '2026-01-02T05:00:00Z');
    });
    const occupancy = await metric(fixture, 'parking.occupancy', FROM, TO);
    expect(occupancy.values).toEqual({ allocated: 1, free: 2 });
    const reports = pointValues(
      await metric(fixture, 'parking.reports', FROM, TO),
    );
    expect(reports['2026-01']).toEqual({ raised: 2, resolved: 1 });
    expect(reports['2026-02']).toEqual({ raised: 0, resolved: 1 });
  });

  it('counts real SOS alerts and averages the time to acknowledge them', async () => {
    await seedBoth(fixture, async (client, society) => {
      const alert = (
        raisedAt: string,
        ackMinutes: number | null,
        status: string,
        reason: string | null,
      ) => {
        const raised = new Date(raisedAt);
        const at = (minutes: number) =>
          new Date(raised.getTime() + minutes * 60_000).toISOString();
        return insertRow(client, 'sos_alerts', {
          society_id: society.id,
          category: 'fire',
          raised_role: 'guard',
          raised_by: society.adminId,
          raised_at: raisedAt,
          status,
          acknowledged_at: ackMinutes === null ? null : at(ackMinutes),
          acknowledged_by: ackMinutes === null ? null : society.adminId,
          closed_at: reason ? at(30) : null,
          closed_by: reason ? society.adminId : null,
          close_reason: reason,
          client_request_id: randomUUID(),
        });
      };
      await alert('2026-03-05T05:00:00Z', 4, 'closed', 'resolved');
      await alert('2026-03-06T05:00:00Z', 6, 'acknowledged', null);
      await alert('2026-03-07T05:00:00Z', 1, 'closed', 'test');
      await alert(
        '2026-03-08T05:00:00Z',
        null,
        'cancelled',
        'raised_by_mistake',
      );
      await alert('2026-04-02T05:00:00Z', null, 'raised', null);
    });
    const alerts = pointValues(await metric(fixture, 'sos.alerts', FROM, TO));
    expect(alerts['2026-03']).toEqual({ alerts: 2 });
    expect(alerts['2026-04']).toEqual({ alerts: 1 });
    const response = pointValues(
      await metric(fixture, 'sos.response_time', FROM, TO),
    );
    expect(response['2026-03']).toEqual({ average_minutes: 5 });
    expect(response['2026-04']).toEqual({ average_minutes: null });
  });

  it('breaks vendor requests down by status and sums approved selected quotes per month', async () => {
    await seedBoth(fixture, async (client, society) => {
      const request = async (
        status: string,
        createdAt: string,
        decidedAt: string | null,
        amount: number,
      ) => {
        const requestId = randomUUID();
        const quoteId = randomUUID();
        const submitted = status !== 'draft' && status !== 'cancelled';
        await insertRow(client, 'vendor_purchase_requests', {
          id: requestId,
          society_id: society.id,
          title: 'Synthetic pump repair',
          estimated_amount_paise: amount,
          status,
          created_at: createdAt,
          submitted_at: submitted ? createdAt : null,
          submitted_by: submitted ? society.adminId : null,
          selected_quote_id: submitted ? quoteId : null,
          quotes_required: status === 'submitted' ? 1 : null,
          approvals_required: status === 'submitted' ? 1 : null,
          decided_at: decidedAt,
          decided_by: decidedAt ? society.adminId : null,
          rejection_reason: status === 'rejected' ? 'Too costly' : null,
          cancelled_at: status === 'cancelled' ? createdAt : null,
          cancelled_by: status === 'cancelled' ? society.adminId : null,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
        await insertRow(client, 'vendor_quotes', {
          id: quoteId,
          society_id: society.id,
          request_id: requestId,
          vendor_id: randomUUID(),
          amount_paise: amount,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      };
      await request('draft', '2026-02-01T05:00:00Z', null, 100);
      await request('submitted', '2026-02-01T05:00:00Z', null, 200);
      await request(
        'approved',
        '2026-02-01T05:00:00Z',
        '2026-03-03T05:00:00Z',
        50_000,
      );
      await request(
        'approved',
        '2026-04-01T05:00:00Z',
        '2026-05-03T05:00:00Z',
        25_000,
      );
      await request(
        'rejected',
        '2026-02-01T05:00:00Z',
        '2026-02-02T05:00:00Z',
        300,
      );
      await request('cancelled', '2026-02-01T05:00:00Z', null, 400);
      await request(
        'approved',
        '2025-12-01T05:00:00Z',
        '2026-01-03T05:00:00Z',
        7_000,
      );
    });
    const requests = await metric(fixture, 'vendor.requests', FROM, TO);
    expect(requests.items).toEqual([
      { label: 'Approved', values: { requests: 2 } },
      { label: 'Awaiting approval', values: { requests: 1 } },
      { label: 'Cancelled', values: { requests: 1 } },
      { label: 'Draft', values: { requests: 1 } },
      { label: 'Rejected', values: { requests: 1 } },
    ]);
    const spend = pointValues(
      await metric(fixture, 'vendor.approved_spend', FROM, TO),
    );
    expect(spend['2026-01']).toEqual({ approved: 7_000 });
    expect(spend['2026-02']).toEqual({ approved: 0 });
    expect(spend['2026-03']).toEqual({ approved: 50_000 });
    expect(spend['2026-05']).toEqual({ approved: 25_000 });
  });

  it('counts scanned and missed patrol checkpoints per round, including shifts past midnight', async () => {
    await seedBoth(fixture, async (client, society) => {
      const checkpoint = (code: string, active = true) =>
        insertRow(client, 'patrol_checkpoints', {
          society_id: society.id,
          code,
          name: `Gate ${code}`,
          active,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      const schedule = (
        start: string,
        end: string,
        interval: number,
        grace: number,
        active = true,
      ) =>
        insertRow(client, 'patrol_schedules', {
          society_id: society.id,
          name: `Round ${start}`,
          shift_start: start,
          shift_end: end,
          interval_minutes: interval,
          grace_minutes: grace,
          active,
          effective_from: '2026-03-01T00:00:00+05:30',
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      const link = (
        scheduleId: string,
        checkpointId: string,
        includedAt: string,
      ) =>
        insertLink(client, 'patrol_schedule_checkpoints', {
          society_id: society.id,
          schedule_id: scheduleId,
          checkpoint_id: checkpointId,
          created_at: includedAt,
          created_by: society.adminId,
        });
      const scan = (checkpointId: string, at: string) =>
        insertRow(client, 'patrol_scans', {
          society_id: society.id,
          checkpoint_id: checkpointId,
          method: 'qr',
          scanned_by: society.adminId,
          scanned_at: at,
          client_request_id: randomUUID(),
        });
      // Morning: rounds 09:00-10:00 (deadline 10:10) and 10:00-11:00 (deadline 11:10) on 1 March, India time.
      const morning = await schedule('09:00', '11:00', 60, 10);
      const first = await checkpoint('ABCDEF');
      const second = await checkpoint('ABCDEG');
      const late = await checkpoint('ABCDEH');
      const retired = await checkpoint('ABCDEJ', false);
      await link(morning, first, '2026-01-01T00:00:00Z');
      await link(morning, second, '2026-01-01T00:00:00Z');
      await link(morning, late, '2026-03-01T09:30:00+05:30');
      await link(morning, retired, '2026-01-01T00:00:00Z');
      await scan(first, '2026-03-01T09:05:00+05:30');
      await scan(second, '2026-03-01T10:30:00+05:30');
      // Night: one round 23:00-01:00, crossing into 2 March.
      const night = await schedule('23:00', '01:00', 120, 0);
      const tower = await checkpoint('ABCDEK');
      await link(night, tower, '2026-01-01T00:00:00Z');
      await scan(tower, '2026-03-02T00:30:00+05:30');
      const paused = await schedule('12:00', '13:00', 60, 0, false);
      await link(paused, first, '2026-01-01T00:00:00Z');
    });
    const completion = pointValues(
      await metric(fixture, 'patrol.completion', '2026-03-01', '2026-03-01'),
    );
    // Round 1 (09:00): first scanned, second missed, late not yet included; round 2 (10:00): second scanned,
    // first and late missed; night round: tower scanned. The inactive checkpoint and paused schedule never count.
    expect(completion['2026-03']).toEqual({ scanned: 3, missed: 3 });
  });

  it('counts patrol incidents per month by severity', async () => {
    await seedBoth(fixture, async (client, society) => {
      for (const [severity, createdAt] of [
        ['low', '2026-03-02T05:00:00Z'],
        ['critical', '2026-03-03T05:00:00Z'],
        ['critical', '2026-03-31T19:00:00Z'],
        ['high', '2025-12-31T05:00:00Z'],
      ]) {
        await insertRow(client, 'patrol_incidents', {
          society_id: society.id,
          category: 'other',
          severity,
          description: 'Synthetic incident',
          created_at: createdAt,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      }
    });
    const incidents = pointValues(
      await metric(fixture, 'patrol.incidents', FROM, TO),
    );
    expect(incidents['2026-03']).toEqual({
      low: 1,
      medium: 0,
      high: 0,
      critical: 1,
    });
    expect(incidents['2026-04']).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      critical: 1,
    });
  });

  it('sums approved meter consumption by type and counts resident readings awaiting approval', async () => {
    await seedBoth(fixture, async (client, society) => {
      const meter = (type: string) =>
        insertRow(client, 'metering_meters', {
          society_id: society.id,
          meter_type: type,
          scope: 'common',
          label: `Common ${type}`,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      const water = await meter('water');
      const power = await meter('electricity');
      const reading = (
        meterId: string,
        date: string,
        status: string,
        source: string,
        previous: number,
        value: number,
      ) =>
        insertRow(client, 'metering_readings', {
          society_id: society.id,
          meter_id: meterId,
          reading_value: value,
          reading_date: date,
          source,
          status,
          photo_path:
            source === 'resident' ? `synthetic/${randomUUID()}.jpg` : null,
          photo_content_type: source === 'resident' ? 'image/jpeg' : null,
          photo_size_bytes: source === 'resident' ? 1000 : null,
          reviewed_at: status === 'pending' ? null : '2026-03-01T00:00:00Z',
          reviewed_by: status === 'pending' ? null : society.adminId,
          previous_reading_id: status === 'approved' ? randomUUID() : null,
          previous_value: status === 'approved' ? previous : null,
          consumption: status === 'approved' ? value - previous : null,
          rejection_reason: status === 'rejected' ? 'Blurred photo' : null,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      await reading(water, '2026-02-01', 'approved', 'admin', 100, 110.5);
      await reading(water, '2026-03-01', 'approved', 'guard', 110.5, 114.75);
      await reading(water, '2025-12-31', 'approved', 'admin', 93, 100);
      await reading(power, '2026-03-01', 'approved', 'admin', 1000, 1100);
      await reading(power, '2026-04-01', 'rejected', 'admin', 0, 2000);
      await reading(water, '2026-04-01', 'pending', 'resident', 0, 120);
      await reading(power, '2026-04-01', 'pending', 'resident', 0, 1200);
      await reading(
        await meter('gas'),
        '2026-04-02',
        'pending',
        'admin',
        0,
        1210,
      );
    });
    const consumption = await metric(fixture, 'metering.consumption', FROM, TO);
    expect(consumption.items).toEqual([
      { label: 'Electricity', values: { consumption: 100 } },
      { label: 'Water', values: { consumption: 14.75 } },
    ]);
    const pending = await metric(
      fixture,
      'metering.pending_readings',
      FROM,
      TO,
    );
    expect(pending.values).toEqual({ pending: 2 });
  });

  it('counts in-service assets by category and warranties ending soon', async () => {
    const today = await societyToday(fixture);
    await seedBoth(fixture, async (client, society) => {
      const category = (name: string) =>
        insertRow(client, 'asset_categories', {
          society_id: society.id,
          name,
          client_request_id: randomUUID(),
          created_by: society.adminId,
          updated_by: society.adminId,
        });
      const lifts = await category('Lifts');
      const pumps = await category('Pumps');
      const asset = (
        categoryId: string,
        status: string,
        warrantyDays: number | null,
      ) =>
        insertRow(client, 'assets', {
          society_id: society.id,
          category_id: categoryId,
          name: 'Synthetic asset',
          location: 'Basement',
          status,
          warranty_end_date:
            warrantyDays === null ? null : addDays(today, warrantyDays),
          client_request_id: randomUUID(),
          created_by: society.adminId,
          updated_by: society.adminId,
        });
      await asset(lifts, 'active', 10);
      await asset(lifts, 'active', 100);
      await asset(pumps, 'under_repair', 60);
      await asset(pumps, 'retired', 5);
      await asset(lifts, 'active', -1);
    });
    const byCategory = await metric(fixture, 'asset.by_category', FROM, TO);
    expect(byCategory.items).toEqual([
      { label: 'Lifts', values: { assets: 3 } },
      { label: 'Pumps', values: { assets: 1 } },
    ]);
    const warranty = await metric(fixture, 'asset.warranty_expiring', FROM, TO);
    expect(warranty.values).toEqual({ next_30_days: 1, next_90_days: 2 });
  });

  it('counts visible home-service providers and averages every rating of them', async () => {
    await seedBoth(fixture, async (client, society) => {
      const provider = (
        type: string,
        origin: string,
        status: string,
        archived = false,
      ) =>
        insertRow(client, 'home_services_providers', {
          society_id: society.id,
          name: `Synthetic ${type}`,
          service_type: type,
          phone: '+919000000000',
          origin,
          status,
          archived_at: archived ? '2026-02-01T00:00:00Z' : null,
          archived_by: archived ? society.adminId : null,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      const rate = (providerId: string, stars: number, hidden = false) =>
        insertRow(client, 'home_services_ratings', {
          society_id: society.id,
          provider_id: providerId,
          rated_by: randomUUID(),
          stars,
          comment: hidden ? 'Synthetic comment' : null,
          comment_hidden_at: hidden ? '2026-02-01T00:00:00Z' : null,
          comment_hidden_by: hidden ? society.adminId : null,
        });
      const plumber = await provider('plumber', 'admin', 'approved');
      await rate(plumber, 5);
      await rate(plumber, 4);
      await rate(await provider('plumber', 'admin', 'approved', true), 1);
      await rate(await provider('pest_control', 'admin', 'approved'), 3, true);
      await rate(await provider('electrician', 'suggestion', 'pending'), 1);
    });
    const providers = await metric(
      fixture,
      'home_services.providers',
      FROM,
      TO,
    );
    expect(providers.items).toEqual([
      { label: 'Pest control', values: { providers: 1 } },
      { label: 'Plumber', values: { providers: 1 } },
    ]);
    const ratings = await metric(fixture, 'home_services.ratings', FROM, TO);
    expect(ratings.items).toEqual([
      { label: 'Plumber', values: { average: 4.5, ratings: 2 } },
      { label: 'Pest control', values: { average: 3, ratings: 1 } },
    ]);
  });

  it('counts completed votes and averages their turnout per month', async () => {
    await seedBoth(fixture, async (client, society) => {
      const vote = (
        completedAt: string | null,
        eligible: number,
        submitted: number,
      ) =>
        insertRow(client, 'poll_votes', {
          society_id: society.id,
          voting_type: 'public',
          title: 'Synthetic vote',
          status: completedAt ? 'completed' : 'cancelled',
          tenant_voting: false,
          opens_at: '2026-01-01T00:00:00Z',
          closes_at: completedAt ?? '2026-12-01T00:00:00Z',
          activated_at: completedAt ? '2026-01-01T00:00:00Z' : null,
          completed_at: completedAt,
          completion_mode: completedAt ? 'deadline' : null,
          final_eligible_count: completedAt ? eligible : null,
          final_submitted_count: completedAt ? submitted : null,
          cancelled_at: completedAt ? null : '2026-03-15T00:00:00Z',
          cancellation_reason: completedAt ? null : 'Withdrawn',
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      await vote('2026-03-31T19:00:00Z', 10, 5);
      await vote('2026-04-20T05:00:00Z', 4, 3);
      await vote('2026-03-10T05:00:00Z', 0, 0);
      await vote(null, 0, 0);
    });
    const completed = pointValues(
      await metric(fixture, 'poll.completed', FROM, TO),
    );
    expect(completed['2026-03']).toEqual({ completed: 1 });
    expect(completed['2026-04']).toEqual({ completed: 2 });
    const turnout = pointValues(
      await metric(fixture, 'poll.turnout', FROM, TO),
    );
    expect(turnout['2026-03']).toEqual({ turnout: null });
    expect(turnout['2026-04']).toEqual({ turnout: 62.5 });
  });

  it('counts held meetings, averages attendance and summarises action items', async () => {
    const today = await societyToday(fixture);
    await seedBoth(fixture, async (client, society) => {
      const meeting = (type: string, status: string, startsAt: string) =>
        insertRow(client, 'meetings', {
          society_id: society.id,
          meeting_type: type,
          title: 'Synthetic meeting',
          status,
          starts_at: startsAt,
          ends_at: new Date(
            new Date(startsAt).getTime() + 3_600_000,
          ).toISOString(),
          scheduled_at: '2026-01-01T00:00:00Z',
          venue: 'Clubhouse',
          notice_required_days: 14,
          notice_given_days: 14,
          quorum_percent: 33,
          held_at: status === 'held' ? startsAt : null,
          held_by: status === 'held' ? society.adminId : null,
          cancelled_at: status === 'cancelled' ? startsAt : null,
          cancelled_by: status === 'cancelled' ? society.adminId : null,
          cancellation_reason: status === 'cancelled' ? 'Postponed' : null,
          client_request_id: randomUUID(),
          created_by: society.adminId,
        });
      const agm = await meeting('agm', 'held', '2026-03-10T05:00:00Z');
      for (const unitId of society.unitIds) {
        await insertLink(client, 'meeting_invited_units', {
          society_id: society.id,
          meeting_id: agm,
          unit_id: unitId,
          unit_label: 'A-101',
        });
      }
      for (const unitId of society.unitIds.slice(0, 2)) {
        await insertRow(client, 'meeting_attendance', {
          society_id: society.id,
          meeting_id: agm,
          unit_id: unitId,
          mode: 'in_person',
          recorded_by: society.adminId,
        });
      }
      await insertRow(client, 'meeting_attendance', {
        society_id: society.id,
        meeting_id: agm,
        membership_id: society.adminMembershipId,
        mode: 'in_person',
        recorded_by: society.adminId,
      });
      const committee = await meeting(
        'committee',
        'held',
        '2026-03-20T05:00:00Z',
      );
      for (const membershipId of [
        society.adminMembershipId,
        society.residentMembershipId,
      ]) {
        await insertLink(client, 'meeting_invited_members', {
          society_id: society.id,
          meeting_id: committee,
          membership_id: membershipId,
          member_name: 'Synthetic member',
        });
      }
      await insertRow(client, 'meeting_attendance', {
        society_id: society.id,
        meeting_id: committee,
        membership_id: society.adminMembershipId,
        mode: 'in_person',
        recorded_by: society.adminId,
      });
      await meeting('sgm', 'held', '2026-03-31T19:00:00Z');
      await meeting('agm', 'cancelled', '2026-03-15T05:00:00Z');
      await meeting('agm', 'scheduled', '2026-03-16T05:00:00Z');
      const item = (dueInDays: number, status: string) =>
        insertRow(client, 'meeting_action_items', {
          society_id: society.id,
          meeting_id: agm,
          title: 'Synthetic action',
          owner_membership_id: society.adminMembershipId,
          owner_name: 'Synthetic owner',
          due_on: addDays(today, dueInDays),
          status,
          completed_at: status === 'done' ? '2026-03-12T05:00:00Z' : null,
          completed_by: status === 'done' ? society.adminId : null,
          created_by: society.adminId,
          updated_by: society.adminId,
        });
      await item(-1, 'open');
      await item(5, 'open');
      await item(-3, 'done');
    });
    const held = pointValues(await metric(fixture, 'meeting.held', FROM, TO));
    expect(held['2026-03']).toEqual({ agm: 1, sgm: 0, committee: 1 });
    expect(held['2026-04']).toEqual({ agm: 0, sgm: 1, committee: 0 });
    const attendance = pointValues(
      await metric(fixture, 'meeting.attendance', FROM, TO),
    );
    // AGM 2 of 3 units (the member row does not count for a unit meeting), committee 1 of 2 members.
    expect(attendance['2026-03']).toEqual({ rate: 58.3 });
    expect(attendance['2026-04']).toEqual({ rate: null });
    const actions = await metric(fixture, 'meeting.actions', FROM, TO);
    expect(actions.values).toEqual({ open: 2, overdue: 1, done: 1 });
  });

  it('serves every enabled community metric through the dashboard to a society admin', async () => {
    await seed(fixture, async (client) => {
      await client.query(
        `insert into public.analytics_preferences(society_id,metric_keys,updated_by) values($1,$2,$3)`,
        [fixture.home.id, [...COMMUNITY_METRICS], fixture.home.adminId],
      );
      await client.query(
        `update public.module_configs set enabled = false where society_id = $1 and module_key = 'sos'`,
        [fixture.home.id],
      );
    });
    const response = await database.asRole(
      'authenticated',
      { sub: fixture.home.adminId },
      (client) =>
        client.query<{
          value: { metrics: (MetricValue & { key: string })[] };
        }>(`select public.analytics_dashboard($1,12,'months') as value`, [
          fixture.home.id,
        ]),
    );
    const keys = response.rows[0]!.value.metrics.map((item) => item.key);
    expect([...keys].sort()).toEqual(
      COMMUNITY_METRICS.filter((key) => !key.startsWith('sos.')).sort(),
    );
  });
});
