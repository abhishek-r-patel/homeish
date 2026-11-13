// Retry an idempotent create RPC once when a duplicate submission won the insert race.
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  const cause =
    error instanceof Error && error.cause && typeof error.cause === 'object'
      ? (error.cause as { code?: unknown })
      : null;
  return cause?.code === UNIQUE_VIOLATION;
}

/**
 * Create RPCs look up their client request ID before inserting. When two
 * submissions with the same ID race, the loser hits a unique violation; one
 * retry then finds the committed row and returns the original record.
 */
export async function retryOnceOnDuplicate<T>(
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return run();
  }
}
