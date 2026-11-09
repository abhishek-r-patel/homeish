// Validate the server environment before the Next.js server accepts requests.
export async function register(): Promise<void> {
  await import('./core/config/server-env');
}
