// Verify the developer-account script creates, marks and deletes developer logins safely.
import { describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createDeveloper,
  deleteDeveloper,
  markDeveloper,
} from '../../scripts/developer-account.mjs';
import {
  createTestDatabase,
  hasDatabase,
  newAuthUser,
} from './support/database';

async function confirmedLogin(client: Client, email: string) {
  const id = await newAuthUser(client, email);
  await client.query(
    'update auth.users set email_confirmed_at = now() where id = $1',
    [id],
  );
  return id;
}

async function count(client: Client, table: string) {
  return (
    await client.query<{ n: number }>(`select count(*)::int as n from ${table}`)
  ).rows[0]?.n;
}

describe.skipIf(!hasDatabase)('developer-account script', () => {
  it('marks only a confirmed login with an active profile', async () => {
    const database = await createTestDatabase();
    try {
      await database.asSuperuser(async (client) => {
        const readyId = await confirmedLogin(client, 'dev@example.test');
        await newAuthUser(client, 'unconfirmed@example.test');
        const noProfileId = await confirmedLogin(
          client,
          'noprofile@example.test',
        );
        // Confirming the email creates the profile; remove one to cover a half-installed database.
        await client.query('delete from public.profiles where id = $1', [
          noProfileId,
        ]);

        expect(
          await markDeveloper(client, 'DEV@example.test', { apply: false }),
        ).toBe('would-add');
        expect(await count(client, 'public.developers')).toBe(0);
        expect(
          await markDeveloper(client, 'dev@example.test', { apply: true }),
        ).toBe('added');
        expect(
          await markDeveloper(client, 'dev@example.test', { apply: true }),
        ).toBe('already-developer');
        expect(
          await markDeveloper(client, 'unconfirmed@example.test', {
            apply: true,
          }),
        ).toBe('unconfirmed');
        expect(
          await markDeveloper(client, 'noprofile@example.test', {
            apply: true,
          }),
        ).toBe('no-profile');

        await client.query('delete from public.developers');
        await client.query(
          `update public.profiles set status = 'disabled' where id = $1`,
          [readyId],
        );
        expect(
          await markDeveloper(client, 'dev@example.test', { apply: true }),
        ).toBe('inactive-profile');
        expect(await count(client, 'public.developers')).toBe(0);
      });
    } finally {
      await database.drop();
    }
  });

  it('creates a missing login, deletes it fully, and creates it again', async () => {
    const database = await createTestDatabase();
    try {
      await database.asSuperuser(async (client) => {
        let logins = 0;
        const createLogin = async (email: string) => {
          logins += 1;
          await confirmedLogin(client, email);
        };
        const options = { createLogin };

        expect(
          await createDeveloper(client, 'dev@example.test', {
            ...options,
            apply: false,
          }),
        ).toBe('would-create');
        expect(logins).toBe(0);
        expect(
          await createDeveloper(client, 'dev@example.test', {
            ...options,
            apply: true,
          }),
        ).toBe('created');
        expect(
          await createDeveloper(client, 'dev@example.test', {
            ...options,
            apply: true,
          }),
        ).toBe('already-developer');
        expect(logins).toBe(1);

        const id = (
          await client.query<{ id: string }>(
            'select id from auth.users where email = $1',
            ['dev@example.test'],
          )
        ).rows[0]?.id;
        const sessionId = (
          await client.query<{ id: string }>(
            'insert into auth.sessions (user_id) values ($1) returning id',
            [id],
          )
        ).rows[0]?.id;
        await client.query(
          `insert into private.developer_mfa_sessions
             (session_id, user_id, session_expires_at, mfa_verified_at)
           values ($1, $2, now() + interval '1 hour', now())`,
          [sessionId, id],
        );

        expect(
          await deleteDeveloper(client, 'DEV@example.test', { apply: false }),
        ).toBe('would-remove');
        expect(await count(client, 'auth.users')).toBe(1);
        expect(
          await deleteDeveloper(client, 'dev@example.test', { apply: true }),
        ).toBe('removed');
        for (const table of [
          'auth.users',
          'auth.sessions',
          'public.profiles',
          'public.developers',
          'private.developer_mfa_sessions',
        ]) {
          expect(await count(client, table)).toBe(0);
        }
        expect(
          await deleteDeveloper(client, 'dev@example.test', { apply: true }),
        ).toBe('not-found');

        expect(
          await createDeveloper(client, 'dev@example.test', {
            ...options,
            apply: true,
          }),
        ).toBe('created');
        expect(await count(client, 'public.developers')).toBe(1);
      });
    } finally {
      await database.drop();
    }
  });

  it('keeps a login with linked records and cleans up leftover profiles', async () => {
    const database = await createTestDatabase();
    try {
      await database.asSuperuser(async (client) => {
        const busyId = await confirmedLogin(client, 'busy@example.test');
        await markDeveloper(client, 'busy@example.test', { apply: true });
        await client.query(
          `insert into public.audit_logs (actor_id, action, entity_type)
           values ($1, 'test.action', 'test')`,
          [busyId],
        );
        expect(
          await deleteDeveloper(client, 'busy@example.test', { apply: true }),
        ).toBe('access-removed');
        expect(await count(client, 'public.developers')).toBe(0);
        expect(await count(client, 'auth.users')).toBe(1);

        // A login deleted outside the script leaves its profile and mark behind.
        const leftoverId = await confirmedLogin(client, 'gone@example.test');
        await markDeveloper(client, 'gone@example.test', { apply: true });
        await client.query('delete from auth.users where id = $1', [
          leftoverId,
        ]);
        expect(
          await deleteDeveloper(client, 'gone@example.test', { apply: false }),
        ).toBe('would-remove-leftover');
        expect(
          await deleteDeveloper(client, 'gone@example.test', { apply: true }),
        ).toBe('leftover-removed');
        expect(
          await client.query('select 1 from public.profiles where id = $1', [
            leftoverId,
          ]),
        ).toHaveProperty('rowCount', 0);
        expect(await count(client, 'public.developers')).toBe(0);
      });
    } finally {
      await database.drop();
    }
  });
});
