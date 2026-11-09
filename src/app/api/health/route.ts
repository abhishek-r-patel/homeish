// Liveness endpoint for uptime monitoring; it reveals no internal service details.
export function GET() {
  return Response.json({ status: 'ok' });
}
