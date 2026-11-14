// Serialize authorized report rows while neutralizing spreadsheet formulas.
function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function toCsv(
  columns: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): string {
  return `${[columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
