// Generate short, collision-resistant reference IDs safe to share with users.
export function createReferenceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `ERR-${value}`;
}
