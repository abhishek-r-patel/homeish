// Developer-account script input validation and live refusal.
import { describe, expect, it } from 'vitest';
import { parseDeveloperArgs } from '../../scripts/developer-account.mjs';

describe('developer-account arguments', () => {
  it('normalises the email and defaults to a dry run', () => {
    const { input, errors } = parseDeveloperArgs([
      'delete',
      '--db',
      'testdb',
      '--email',
      ' Dev@Example.TEST ',
    ]);
    expect(errors).toEqual([]);
    expect(input).toMatchObject({
      action: 'delete',
      db: 'testdb',
      email: 'dev@example.test',
      apply: false,
    });
  });

  it('refuses live and requires a valid profile and email', () => {
    expect(
      parseDeveloperArgs([
        'create',
        '--db',
        'live',
        '--email',
        'dev@example.test',
      ]).errors,
    ).toEqual(['--db live is refused: live is never used from a laptop.']);
    expect(
      parseDeveloperArgs(['create', '--db', '../x', '--email', 'nope']).errors,
    ).toEqual([
      '--db must be a profile name such as testdb or demo.',
      '--email must be a valid email address.',
    ]);
  });

  it('requires create or delete first', () => {
    expect(
      parseDeveloperArgs(['remove', '--db', 'testdb', '--email', 'a@b.test'])
        .errors,
    ).toEqual(['The first argument must be create or delete.']);
  });

  it('rejects --apply with --dry-run', () => {
    expect(
      parseDeveloperArgs([
        'create',
        '--db',
        'testdb',
        '--email',
        'dev@example.test',
        '--apply',
        '--dry-run',
      ]).errors,
    ).toEqual(['Choose either --dry-run or --apply, not both.']);
  });
});
