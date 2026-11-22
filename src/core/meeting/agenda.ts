// Calculate advisory agenda-item times and keep estimates unknown after missing information.
export function deriveAgendaTiming(
  startsAt: string | null,
  agenda: ReadonlyArray<{ durationMinutes: number | null }>,
) {
  let cursor = startsAt === null ? null : new Date(startsAt).getTime();
  let canContinue = cursor !== null && Number.isFinite(cursor);

  return agenda.map((item) => {
    const estimatedStart =
      canContinue && cursor !== null ? new Date(cursor).toISOString() : null;
    if (!canContinue || cursor === null || item.durationMinutes === null) {
      canContinue = false;
      return { estimatedStartsAt: estimatedStart, estimatedEndsAt: null };
    }
    cursor += item.durationMinutes * 60_000;
    return {
      estimatedStartsAt: estimatedStart,
      estimatedEndsAt: new Date(cursor).toISOString(),
    };
  });
}
