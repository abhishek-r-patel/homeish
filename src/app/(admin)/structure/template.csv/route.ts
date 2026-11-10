// Provide the import header row without exposing society data.
export function GET() {
  return new Response('block,number,floor,unit_type,area_sqft\r\n', {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition':
        'attachment; filename="homeish-units-template.csv"',
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}
