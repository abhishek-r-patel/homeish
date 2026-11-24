// Verify P57 public settings and private enquiry access, updates and deletion.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('P57 website database contracts', () => {
  it('keeps enquiries developer-only and deletes details with a safe audit row', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const developerId = await newAuthUser(
          client,
          'p57-developer@example.test',
        );
        const adminId = await newAuthUser(client, 'p57-admin@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'p57-developer@example.test', 'P57 Developer'),
             ($2, 'p57-admin@example.test', 'P57 Admin')`,
          [developerId, adminId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('P57 Society', $1) returning id`,
            [adminId],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active')`,
          [societyId, adminId],
        );
        await client.query(
          'insert into public.developers (user_id) values ($1)',
          [developerId],
        );
        const sessionId = (
          await client.query<{ id: string }>(
            'insert into auth.sessions (user_id) values ($1) returning id',
            [developerId],
          )
        ).rows[0]!.id;
        return { developerId, adminId, sessionId };
      });

      const publicSettings = await database.asRole('anon', null, (client) =>
        client.query('select * from public.website_public_settings_get()'),
      );
      expect(publicSettings.rows[0]).toMatchObject({
        contact_email: null,
        enquiry_hourly_limit: 5,
      });

      const enquiryId = (
        await database.asRole(
          'anon',
          null,
          (client) =>
            client.query<{ id: string }>(
              `select public.website_enquiry_create(
                 'p57-public-request',
                 'Synthetic Sender',
                 'Synthetic Society',
                 'Pune',
                 120,
                 'sender@example.test',
                 '+919876543210',
                 'Please contact our committee.'
               ) as id`,
            ),
          { commit: true },
        )
      ).rows[0]!.id;

      expect(
        (
          await dbError(
            database.asRole('anon', null, (client) =>
              client.query('select * from public.website_enquiries'),
            ),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await dbError(
            database.asRole(
              'authenticated',
              { sub: fixture.adminId },
              (client) =>
                client.query(
                  'select * from public.developer_website_enquiries_get()',
                ),
            ),
          )
        ).code,
      ).toBe('42501');

      const developerClaims = {
        sub: fixture.developerId,
        session_id: fixture.sessionId,
        aal: 'aal2',
      };
      await database.asRole(
        'authenticated',
        developerClaims,
        (client) => client.query('select public.record_developer_mfa()'),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        developerClaims,
        (client) =>
          client.query(
            `select public.developer_website_settings_save(
               'hello@example.test', 8
             )`,
          ),
        { commit: true },
      );
      const configured = await database.asRole('anon', null, (client) =>
        client.query('select * from public.website_public_settings_get()'),
      );
      expect(configured.rows[0]).toEqual({
        contact_email: 'hello@example.test',
        enquiry_hourly_limit: 8,
      });

      const enquiries = await database.asRole(
        'authenticated',
        developerClaims,
        (client) =>
          client.query(
            'select * from public.developer_website_enquiries_get()',
          ),
      );
      expect(enquiries.rows).toHaveLength(1);
      await database.asRole(
        'authenticated',
        developerClaims,
        (client) =>
          client.query('select public.developer_website_enquiry_handle($1)', [
            enquiryId,
          ]),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        developerClaims,
        (client) =>
          client.query('select public.developer_website_enquiry_delete($1)', [
            enquiryId,
          ]),
        { commit: true },
      );

      const deleted = await database.asSuperuser(async (client) => {
        const enquiry = await client.query(
          'select id from public.website_enquiries where id=$1',
          [enquiryId],
        );
        const audit = await client.query(
          `select action, "before", "after"
           from public.audit_logs
           where action='website.enquiry.delete'
             and entity_id=$1`,
          [enquiryId],
        );
        return { enquiry: enquiry.rows, audit: audit.rows };
      });
      expect(deleted.enquiry).toEqual([]);
      expect(deleted.audit).toEqual([
        {
          action: 'website.enquiry.delete',
          before: { status: 'handled' },
          after: null,
        },
      ]);
    } finally {
      await database.drop();
    }
  });
});
