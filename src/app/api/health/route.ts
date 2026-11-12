// Health endpoint reports database availability and daily-job freshness only.
import { checkDailyJobHealth, checkDatabaseHealth } from '@/core/privileged';

export async function GET() {
  try {
    await checkDatabaseHealth();
    await checkDailyJobHealth();
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
