// Provide the resident import columns without exposing society data.
export function GET() {
  return new Response('block,unit,email,relationship,primary,approver\r\n', {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition':
        'attachment; filename="homeish-residents-template.csv"',
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}
