// Verify retention boundaries, storage ordering, append-only log purges and retries.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type RetentionRunResult = {
  visitorEntriesAnonymized: number;
  deliveryEntriesAnonymized: number;
  preApprovalReferencesCleared: number;
  preApprovalsDeleted: number;
  requestAttachmentsDeleted: number;
  requestCommentsDeleted: number;
  requestEventsDeleted: number;
  requestsDeleted: number;
  notificationsDeleted: number;
  errorLogsDeleted: number;
  auditLogsDeleted: number;
  jobsDeleted: number;
  jobRunKeysDeleted: number;
  rateLimitsDeleted: number;
  orphanFilesReported: Record<
    | 'visitor-photos'
    | 'delivery-photos'
    | 'request-files'
    | 'payment-proofs'
    | 'society-assets',
    number
  >;
};

describe.skipIf(!hasDatabase)('database retention', () => {
  let database: TestDatabase;
  let societyId: string;
  let adminId: string;
  let residentId: string;
  let unitId: string;
  let guardId: string;
  let approvalId: string;
  let requestId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      adminId = await newAuthUser(client, 'retention-admin@example.test');
      residentId = await newAuthUser(client, 'retention-resident@example.test');
      await client.query(
        `insert into public.profiles (id, email, full_name)
         values ($1, 'retention-admin@example.test', 'Retention Admin'),
                ($2, 'retention-resident@example.test', 'Retention Resident')`,
        [adminId, residentId],
      );
      societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Retention Society', $1) returning id`,
          [adminId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, ARRAY['admin']::text[], 'active'),
                ($1, $3, ARRAY['resident']::text[], 'active')`,
        [societyId, adminId, residentId],
      );
      unitId = (
        await client.query<{ id: string }>(
          `insert into public.units (society_id, number, created_by)
           values ($1, 'RET-1', $2) returning id`,
          [societyId, adminId],
        )
      ).rows[0]!.id;
      guardId = (
        await client.query<{ id: string }>(
          `insert into public.guard_roster (society_id, name, created_by)
           values ($1, 'Retention Guard', $2) returning id`,
          [societyId, adminId],
        )
      ).rows[0]!.id;

      approvalId = (
        await client.query<{ id: string }>(
          `insert into public.visitor_pre_approvals (
             society_id, created_by, unit_id, visitor_name, valid_from, valid_to,
             code, status, used_at
           )
           values ($1, $2, $3, 'Old Visitor', '2023-12-01', '2024-01-01',
                   '123456', 'used', '2024-01-01') returning id`,
          [societyId, residentId, unitId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.visitor_entries (
           society_id, created_at, created_by, unit_id, visitor_name,
           visitor_phone, purpose, vehicle_no, photo_path, source,
           pre_approval_id, status, decision_source, handled_by_guard_id,
           checked_in_at, checked_out_at
         )
         values ($1, '2024-01-01', $2, $3, 'Old Visitor', '9876543210',
                 'guest', 'OLD-123', 'visitor/old.jpg', 'pre_approved',
                 $4, 'checked_out', 'pre_approved', $5,
                 '2024-01-01', '2024-01-01 01:00:00')`,
        [societyId, residentId, unitId, approvalId, guardId],
      );
      await client.query(
        `insert into public.delivery_entries (
           society_id, created_at, created_by, unit_id, company,
           delivery_person, delivery_type, photo_path, status,
           client_request_id, decision_source, decided_at, override_reason,
           handled_by_guard_id
         )
         values ($1, '2024-01-01', $2, $3, 'Parcel Co', 'Old Courier',
                 'parcel', 'delivery/old.jpg', 'closed', gen_random_uuid(),
                 'guard_override', '2024-01-01', 'Old delivery',
                 $4)`,
        [societyId, adminId, unitId, guardId],
      );

      const categoryId = (
        await client.query<{ id: string }>(
          `insert into public.service_request_categories
             (society_id, created_by, name)
           values ($1, $2, 'Retention') returning id`,
          [societyId, adminId],
        )
      ).rows[0]!.id;
      requestId = (
        await client.query<{ id: string }>(
          `insert into public.service_requests (
             society_id, created_by, category_id, location_type, description,
             status, resolved_at, closed_at, client_request_id
           )
           values ($1, $2, $3, 'common_area', 'Old closed request',
                   'closed', '2024-01-01', '2024-01-01', gen_random_uuid())
           returning id`,
          [societyId, residentId, categoryId],
        )
      ).rows[0]!.id;
      const commentId = (
        await client.query<{ id: string }>(
          `insert into public.service_request_comments (
             society_id, created_by, request_id, body, client_request_id
           )
           values ($1, $2, $3, 'Old comment', gen_random_uuid())
           returning id`,
          [societyId, residentId, requestId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.service_request_attachments (
           society_id, created_by, request_id, comment_id, storage_path,
           content_type, size_bytes
         )
         values ($1, $2, $3, $4, 'requests/old.jpg', 'image/jpeg', 1)`,
        [societyId, residentId, requestId, commentId],
      );
      await client.query(
        `insert into public.service_request_events (
           society_id, created_by, request_id, event_type, to_status
         )
         values ($1, $2, $3, 'created', 'open')`,
        [societyId, residentId, requestId],
      );

      await client.query(
        `insert into public.notifications
           (society_id, user_id, type, title, body, created_at)
         values ($1, $2, 'test_retention', 'Old notice', 'Old body', '2024-01-01')`,
        [societyId, residentId],
      );
      await client.query(
        `insert into public.error_logs
           (reference_id, source, severity, message, created_at)
         values ('RET-OLD-1', 'job', 'info', 'Old error', '2024-01-01')`,
      );
      await client.query(
        `insert into public.audit_logs
           (action, entity_type, created_at)
         values ('retention.test', 'test', '2024-01-01')`,
      );
      await client.query(
        `insert into public.jobs (society_id, type, status, created_at)
         values ($1, 'export', 'succeeded', '2024-01-01')`,
        [societyId],
      );
      await client.query(
        `insert into public.job_run_keys
           (society_id, job_name, period_key, ran_at)
         values ($1, 'test.retention', '2024-01-01', '2024-01-01')`,
        [societyId],
      );
      await client.query(
        `insert into public.rate_limits (key, window_start, count)
         values ('retention-test', '2024-01-01', 1)`,
      );
      await client.query(
        `insert into storage.objects (bucket_id, name)
         values ('visitor-photos', 'visitor/old.jpg'),
                ('delivery-photos', 'delivery/old.jpg'),
                ('request-files', 'requests/old.jpg'),
                ('visitor-photos', 'visitor/orphan.jpg')`,
      );
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('lists files first, purges exactly expired data, and is safe to repeat', async () => {
    const firstRun = await database.asRole(
      'service_role',
      null,
      async (client) => {
        const files = await client.query<{ bucket: string; path: string }>(
          `select * from public.housekeeping_retention_files_list($1::date)`,
          ['2026-11-10'],
        );
        await client.query(
          `delete from storage.objects
           where (bucket_id, name) in (
             ('visitor-photos', 'visitor/old.jpg'),
             ('delivery-photos', 'delivery/old.jpg'),
             ('request-files', 'requests/old.jpg')
           )`,
        );
        const run = await client.query<{ result: RetentionRunResult }>(
          `select public.housekeeping_retention_run($1::date, $2::text) as result`,
          ['2026-11-10', 'retention-first-run'],
        );
        return { files: files.rows, result: run.rows[0]!.result };
      },
      { commit: true },
    );

    expect(firstRun.files).toEqual(
      expect.arrayContaining([
        { bucket: 'visitor-photos', path: 'visitor/old.jpg' },
        { bucket: 'delivery-photos', path: 'delivery/old.jpg' },
        { bucket: 'request-files', path: 'requests/old.jpg' },
      ]),
    );
    expect(firstRun.result).toMatchObject({
      visitorEntriesAnonymized: 1,
      deliveryEntriesAnonymized: 1,
      preApprovalReferencesCleared: 1,
      preApprovalsDeleted: 1,
      requestAttachmentsDeleted: 1,
      requestCommentsDeleted: 1,
      requestEventsDeleted: 1,
      requestsDeleted: 1,
      notificationsDeleted: 1,
      errorLogsDeleted: 1,
      auditLogsDeleted: 1,
      jobsDeleted: 1,
      jobRunKeysDeleted: 1,
      rateLimitsDeleted: 1,
      orphanFilesReported: {
        'visitor-photos': 1,
        'delivery-photos': 0,
        'request-files': 0,
        'payment-proofs': 0,
        'society-assets': 0,
      },
    });

    const secondRun = await database.asRole(
      'service_role',
      null,
      async (client) => {
        const result = await client.query<{ result: RetentionRunResult }>(
          `select public.housekeeping_retention_run($1::date, $2::text) as result`,
          ['2026-11-10', 'retention-second-run'],
        );
        return result.rows[0]!.result;
      },
      { commit: true },
    );
    const { orphanFilesReported, ...purgeCounts } = secondRun;
    expect(Object.values(purgeCounts).every((count) => count === 0)).toBe(true);
    expect(orphanFilesReported).toEqual({
      'visitor-photos': 1,
      'delivery-photos': 0,
      'request-files': 0,
      'payment-proofs': 0,
      'society-assets': 0,
    });

    await database.asSuperuser(async (client) => {
      const visitor = await client.query<{
        visitor_name: string;
        visitor_phone: string | null;
        vehicle_no: string | null;
        photo_path: string | null;
        pre_approval_id: string | null;
      }>(
        `select visitor_name, visitor_phone, vehicle_no, photo_path, pre_approval_id
         from public.visitor_entries`,
      );
      expect(visitor.rows).toEqual([
        {
          visitor_name: '[Anonymized]',
          visitor_phone: null,
          vehicle_no: null,
          photo_path: null,
          pre_approval_id: null,
        },
      ]);
      const delivery = await client.query<{
        company: string;
        delivery_person: string | null;
        photo_path: string | null;
      }>(
        `select company, delivery_person, photo_path
         from public.delivery_entries`,
      );
      expect(delivery.rows).toEqual([
        { company: 'Parcel Co', delivery_person: null, photo_path: null },
      ]);
      const remainingRequest = await client.query(
        `select id from public.service_requests where id = $1`,
        [requestId],
      );
      expect(remainingRequest.rowCount).toBe(0);
      const retentionAudits = await client.query(
        `select id from public.audit_logs
         where action = 'housekeeping.retention'`,
      );
      expect(retentionAudits.rowCount).toBe(1);
      const orphan = await client.query(
        `select name from storage.objects
         where bucket_id = 'visitor-photos' and name = 'visitor/orphan.jpg'`,
      );
      expect(orphan.rowCount).toBe(1);
    });
  });

  it('keeps retention functions and direct append-only deletion service-only', async () => {
    const denied = await dbError(
      database.asRole('authenticated', { sub: residentId }, (client) =>
        client.query(
          `select public.housekeeping_retention_run('2026-11-10', 'not-allowed')`,
        ),
      ),
    );
    expect(denied.code).toBe('42501');

    const directDelete = await dbError(
      database.asRole('service_role', null, (client) =>
        client.query(
          `delete from public.audit_logs
           where action = 'housekeeping.retention'`,
        ),
      ),
    );
    expect(directDelete.code).toBe('42501');
  });
});
