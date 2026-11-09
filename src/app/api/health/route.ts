// Liveness endpoint for uptime monitoring; it reveals no internal service details.
import { checkDatabaseHealth } from '@/core/privileged';

export async function GET() {
  try {
    await checkDatabaseHealth();
    return Response.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    console.error('Homeish health check failed.');
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
