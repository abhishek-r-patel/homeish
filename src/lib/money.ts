// Format integer paise without losing precision for database bigint strings.
export function rupeesFromPaise(paise: number | string): string {
  if (
    (typeof paise === 'number' &&
      (!Number.isSafeInteger(paise) || paise < 0)) ||
    (typeof paise === 'string' && !/^\d+$/.test(paise))
  ) {
    throw new RangeError('Money must be a non-negative safe integer in paise.');
  }
  const amount = BigInt(paise);
  return `${amount / BigInt(100)}.${String(amount % BigInt(100)).padStart(2, '0')}`;
}
