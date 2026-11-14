// Validate module RPC responses and translate expected database failures.
import 'server-only';
import { z } from 'zod';
import { AppError, ConflictError, ValidationError } from '../errors';
import type { RequestContext } from '../tenancy/request-context';
import { invokeUntypedRpc } from './untyped-rpc';

export function parseModuleInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationError(
    Object.fromEntries(
      result.error.issues.map((issue) => [
        String(issue.path[0] ?? 'form'),
        issue.message,
      ]),
    ),
  );
}

export async function callModuleRpc<T>(
  context: RequestContext,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  failureMessage: string,
): Promise<T> {
  let result: unknown;
  try {
    result = await invokeUntypedRpc<unknown>(context.db, name, args);
  } catch (error) {
    const cause = z
      .object({ code: z.string().optional() })
      .safeParse(error instanceof Error ? error.cause : null);
    const code = cause.success ? cause.data.code : undefined;
    if (code === '42501') throw new AppError('FORBIDDEN');
    if (code === 'P0002') throw new AppError('NOT_FOUND');
    if (code === '23505') {
      throw new ConflictError(
        'invalid_state',
        'The record changed or already exists. Refresh and retry.',
      );
    }
    if (code === '22023' || code === '23514' || code === '23P01') {
      throw new ValidationError({ form: failureMessage });
    }
    throw new Error(failureMessage, { cause: error });
  }
  return schema.parse(result);
}
