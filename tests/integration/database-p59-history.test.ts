// Verify P59 change-history isolation, redaction, committee access and settings undo.
import { describe, expect, it } from 'vitest';
import type { QueryResult } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

type Role = 'admin' | 'committee' | 'resident' | 'developer';

describe.skipIf(!hasDatabase)('database P59 change history', () => {
  it('redacts tenant history, gates committee access and safely undoes settings', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = {} as Record<Role, string>;
        for (const role of [
          'admin',
          'committee',
          'resident',
          'developer',
        ] as const) {
          users[role] = await newAuthUser(client, `p59-${role}@example.test`);
          await client.query(
            `insert into public.profiles (id, email, full_name)
             values ($1, $2, $3)`,
            [users[role], `p59-${role}@example.test`, `P59 ${role}`],
          );
        }
        const [societyId, otherSocietyId] = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('P59 Society', $1), ('Other Society', $2)
             returning id`,
            [users.admin, users.developer],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active'),
                  ($1, $3, ARRAY['committee']::text[], 'active'),
                  ($1, $4, ARRAY['resident']::text[], 'active')`,
          [societyId, users.admin, users.committee, users.resident],
        );
        await client.query(
          `insert into public.developers (user_id) values ($1)`,
          [users.developer],
        );
        const sessionId = (
          await client.query<{ id: string }>(
            'insert into auth.sessions (user_id) values ($1) returning id',
            [users.developer],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into private.developer_mfa_sessions
             (session_id, user_id, session_expires_at, mfa_verified_at)
           values ($1, $2, now() + interval '1 hour', now())`,
          [sessionId, users.developer],
        );
        await client.query(
          `insert into public.module_configs
             (society_id, module_key, enabled, settings, updated_by)
           values ($1, 'core', true, '{}'::jsonb, $2),
                  ($1, 'billing', true,
                    '{"due_day_of_month":15,"rounding":"rupee","bill_email_on_publish":false}'::jsonb,
                    $2),
                  ($1, 'tenancy', true,
                    '{"police_verification_required":false,"clearance_handover_basis":"bills","clearance_agreement_evidence":"admin_note","verification_tracking_enabled":false}'::jsonb,
                    $2),
                  ($1, 'sos', true,
                    '{"notify_guards":true,"notify_admins":true,"notify_committee":false,"resident_scope":"floor"}'::jsonb,
                    $2)`,
          [societyId, users.admin],
        );
        await client.query(
          `insert into public.module_setting_access
             (society_id, module_key, setting_key, admin_can_edit, updated_by)
           values
             ($1, 'billing', 'due_day_of_month', true, $2),
             ($1, 'billing', 'rounding', true, $2),
             ($1, 'billing', 'bill_email_on_publish', true, $2)
           on conflict (society_id, module_key, setting_key)
           do update set admin_can_edit = excluded.admin_can_edit`,
          [societyId, users.admin],
        );
        const settingAuditId = (
          await client.query<{ id: string }>(
            `insert into public.audit_logs
               (society_id, actor_id, actor_role, action, entity_type, entity_id,
                "before", "after")
             values (
               $1, $2, 'admin', 'billing.settings.update', 'module_config', $3,
               '{"settings":{"due_day_of_month":10,"rounding":"rupee","bill_email_on_publish":true}}',
               '{"settings":{"due_day_of_month":15,"rounding":"rupee","bill_email_on_publish":false}}'
             ) returning id::text`,
            [societyId, users.admin, String(societyId)],
          )
        ).rows[0]!.id;
        const paymentDetailsAuditId = (
          await client.query<{ id: string }>(
            `insert into public.audit_logs
               (society_id, actor_id, actor_role, action, entity_type, entity_id,
                "before", "after")
             values (
               $1, $2, 'admin', 'billing.paymentDetails.update', 'payment_details', $3,
               '{"settings":{"upi_id":"old@bank"}}',
               '{"settings":{"upi_id":"new@bank"}}'
             ) returning id::text`,
            [societyId, users.admin, String(societyId)],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.audit_logs
             (society_id, actor_id, actor_role, action, entity_type, "after", reason)
           values ($1, $2, 'admin', 'visitor.override',
             'visitor_entry', '{"phone":"9999999999","notes":"private"}',
             'Private operational reason')`,
          [societyId, users.admin],
        );
        await client.query(
          `insert into public.audit_logs
             (society_id, actor_id, actor_role, action, entity_type,
              "before", "after")
           values ($1, $2, 'admin', 'community.settings.update',
             'module_config',
             '{"settings":{"contact_email":"old@example.test","alerts":true}}',
             '{"settings":{"contact_email":"new@example.test","alerts":false}}')`,
          [societyId, users.admin],
        );
        return {
          users,
          societyId: societyId!,
          otherSocietyId: otherSocietyId!,
          sessionId,
          settingAuditId,
          paymentDetailsAuditId,
        };
      });

      const asUser = (
        role: Role,
        operation: (
          query: (
            sql: string,
            params?: unknown[],
          ) => Promise<QueryResult<Record<string, unknown>>>,
        ) => Promise<unknown>,
      ) =>
        database.asRole(
          'authenticated',
          {
            sub: fixture.users[role],
            ...(role === 'developer'
              ? { aal: 'aal2', session_id: fixture.sessionId }
              : {}),
          },
          (client) =>
            operation((sql, params = []) => client.query(sql, params)),
          { commit: true },
        );

      const history = (role: Role, societyId = fixture.societyId) =>
        asUser(
          role,
          async (query) =>
            (
              await query(
                `select public.audit_history_get(
                   $1, null, null, null, 50, 0
                 ) as rows`,
                [societyId],
              )
            ).rows[0].rows,
        );

      const completeSnapshots = await database.asSuperuser(async (client) => {
        const cases = [
          ['amc', '{"due_soon_days":30,"urgent_days":7}'],
          [
            'billing',
            '{"due_day_of_month":10,"rounding":"rupee","bill_email_on_publish":true}',
          ],
          [
            'delivery',
            '{"response_timeout_minutes":3,"uncollected_days":3,"leave_at_gate_enabled":true}',
          ],
          [
            'expense',
            '{"approval_threshold_paise":1000,"billing_income_account_id":null}',
          ],
          [
            'sos',
            '{"notify_guards":true,"notify_admins":true,"notify_committee":false,"resident_scope":"floor"}',
          ],
          ['staff', '{"resident_approval_required":true}'],
          [
            'tenancy',
            '{"police_verification_required":false,"clearance_handover_basis":"bills","clearance_agreement_evidence":"admin_note","verification_tracking_enabled":false}',
          ],
          [
            'visitor',
            '{"approval_timeout_minutes":3,"overstay_hours":12,"photo_required":false,"guard_override_allowed":false,"phone_required":false}',
          ],
        ] as const;
        const results = [];
        for (const [module, settings] of cases) {
          results.push(
            (
              await client.query<{ complete: boolean }>(
                `select private.audit_history_complete_settings($1, $2::jsonb) as complete`,
                [module, settings],
              )
            ).rows[0]!.complete,
          );
        }
        results.push(
          (
            await client.query<{ complete: boolean }>(
              `select private.audit_history_complete_settings(
                 'visitor', '{"photo_required":false}'::jsonb
               ) as complete`,
            )
          ).rows[0]!.complete,
        );
        return results;
      });
      expect(completeSnapshots).toEqual([
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
      ]);

      await expect(history('resident')).rejects.toMatchObject({
        code: '42501',
      });
      await expect(history('committee')).rejects.toMatchObject({
        code: '42501',
      });
      const adminRows = (await history('admin')) as Array<{
        id: string;
        action: string;
        before: { settings: Record<string, unknown> } | null;
        after: { settings: Record<string, unknown> } | null;
        canUndo: boolean;
      }>;
      expect(adminRows.map((row) => row.action)).toEqual(
        expect.arrayContaining([
          'billing.settings.update',
          'billing.paymentDetails.update',
          'visitor.override',
        ]),
      );
      const settings = adminRows.find(
        (row) => row.action === 'community.settings.update',
      )!;
      expect(settings.before?.settings.contact_email).toBe('Hidden');
      expect(settings.after?.settings.contact_email).toBe('Hidden');
      expect(settings.canUndo).toBe(false);
      expect(
        adminRows.find((row) => row.action === 'billing.settings.update')
          ?.canUndo,
      ).toBe(true);
      const visitor = adminRows.find(
        (row) => row.action === 'visitor.override',
      )!;
      expect(visitor.before).toBeNull();
      expect(visitor.after).toBeNull();
      expect(visitor).not.toHaveProperty('reason');

      const rawAdmin = (await asUser(
        'admin',
        async (query) =>
          (
            await query(
              'select count(*)::integer as count from public.audit_logs',
            )
          ).rows[0],
      )) as { count: number };
      expect(rawAdmin.count).toBe(0);
      expect(
        (
          await dbError(
            asUser('resident', (query) =>
              query(`select public.audit_history_access_get($1)`, [
                fixture.otherSocietyId,
              ]),
            ),
          )
        ).code,
      ).toBe('42501');

      await asUser('developer', (query) =>
        query(
          `select public.developer_committee_history_set($1, true, 'p59-enable')`,
          [fixture.societyId],
        ),
      );
      const committeeRows = (await history('committee')) as Array<
        Record<string, unknown>
      >;
      expect(committeeRows.every((row) => row.canUndo === false)).toBe(true);

      const rawDeveloper = (await asUser(
        'developer',
        async (query) =>
          (
            await query(
              'select count(*)::integer as count from public.audit_logs where society_id = $1',
              [fixture.societyId],
            )
          ).rows[0],
      )) as { count: number };
      expect(rawDeveloper.count).toBeGreaterThanOrEqual(4);

      await asUser('admin', (query) =>
        query(
          `select public.tenancy_settings_update(
             $1, true, 'total', 'signed_upload', true, 'p59-tenancy-save'
           )`,
          [fixture.societyId],
        ),
      );
      await asUser('admin', (query) =>
        query(
          `select public.sos_settings_update(
             $1, true, true, true, 'block', 'p59-sos-save'
           )`,
          [fixture.societyId],
        ),
      );
      const settingSnapshots = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{
              action: string;
              before: Record<string, unknown> | null;
            }>(
              `select action, "before"
             from public.audit_logs
             where society_id = $1
               and action in ('tenancy.settings.update', 'sos.settings.update')
             order by action`,
              [fixture.societyId],
            )
          ).rows,
      );
      expect(settingSnapshots).toHaveLength(2);
      expect(settingSnapshots.every((row) => row.before !== null)).toBe(true);

      await asUser('developer', (query) =>
        query(
          `select public.developer_update_module_settings(
             $1, 'billing',
             '{"due_day_of_month":5,"rounding":"rupee","bill_email_on_publish":false}'::jsonb,
             'p59-dev-away'
           )`,
          [fixture.societyId],
        ),
      );
      await asUser('developer', (query) =>
        query(
          `select public.developer_update_module_settings(
             $1, 'billing',
             '{"due_day_of_month":15,"rounding":"rupee","bill_email_on_publish":false}'::jsonb,
             'p59-dev-back'
           )`,
          [fixture.societyId],
        ),
      );
      const staleSource = (
        (await history('admin')) as Array<{
          id: string;
          canUndo: boolean;
        }>
      ).find((row) => row.id === fixture.settingAuditId);
      expect(staleSource?.canUndo).toBe(false);
      expect(
        (
          await dbError(
            asUser('admin', (query) =>
              query(`select public.audit_setting_undo($1, $2, 'p59-stale')`, [
                fixture.societyId,
                fixture.settingAuditId,
              ]),
            ),
          )
        ).code,
      ).toBe('23505');
      const latestSettingAuditId = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ id: string }>(
              `insert into public.audit_logs
                 (society_id, actor_id, actor_role, action, entity_type, entity_id,
                  "before", "after")
               values (
                 $1, $2, 'admin', 'billing.settings.update', 'module_config', $3,
                 '{"settings":{"due_day_of_month":10,"rounding":"rupee","bill_email_on_publish":true}}',
                 '{"settings":{"due_day_of_month":15,"rounding":"rupee","bill_email_on_publish":false}}'
               ) returning id::text`,
              [
                fixture.societyId,
                fixture.users.admin,
                String(fixture.societyId),
              ],
            )
          ).rows[0]!.id,
      );

      expect(
        (
          await dbError(
            asUser('admin', (query) =>
              query(
                `select public.audit_setting_undo($1, $2, 'p59-payment-details')`,
                [fixture.societyId, fixture.paymentDetailsAuditId],
              ),
            ),
          )
        ).code,
      ).toBe('22023');
      expect(
        await asUser('admin', (query) =>
          query(
            `select public.audit_setting_undo($1, $2, 'p59-undo') as result`,
            [fixture.societyId, latestSettingAuditId],
          ),
        ),
      ).toBeTruthy();
      const restored = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ settings: Record<string, unknown> }>(
              `select settings from public.module_configs
             where society_id = $1 and module_key = 'billing'`,
              [fixture.societyId],
            )
          ).rows[0]!.settings,
      );
      expect(restored).toMatchObject({
        due_day_of_month: 10,
        rounding: 'rupee',
        bill_email_on_publish: true,
      });
    } finally {
      await database.drop();
    }
  });
});
