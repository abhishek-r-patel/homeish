import { describe, expect, it } from 'vitest';
import { databasePoolOptions } from '../../scripts/integrity-check.mjs';

describe('database integrity connection', () => {
  it('uses the supplied root CA without relaxing TLS verification', () => {
    const url = new URL(
      'postgresql://db.test.supabase.co/postgres?sslmode=disable&sslrootcert=untrusted&ssl=0&sslnegotiation=direct',
    );
    const rootCertificate =
      '-----BEGIN CERTIFICATE-----\nroot\n-----END CERTIFICATE-----';

    const options = databasePoolOptions(url, rootCertificate);

    expect(options.connectionString).not.toContain('sslrootcert');
    expect(options.connectionString).not.toContain('sslmode');
    expect(options.connectionString).not.toContain('sslnegotiation');
    expect(options.ssl).toEqual({
      rejectUnauthorized: true,
      ca: rootCertificate,
    });
  });

  it('keeps strict TLS mode when no additional root CA is supplied', () => {
    const url = new URL('postgresql://db.test.supabase.co/postgres');

    const options = databasePoolOptions(url);

    expect(options.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('disables TLS only for localhost', () => {
    const url = new URL('postgresql://localhost/postgres');

    const options = databasePoolOptions(
      url,
      '-----BEGIN CERTIFICATE-----\nroot\n-----END CERTIFICATE-----',
    );

    expect(options.ssl).toBe(false);
  });
});
