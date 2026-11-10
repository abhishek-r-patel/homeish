// Parse a small RFC-4180-style CSV document while rejecting malformed quoting.
export function parseCsvRecords(source: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (
      closedQuote &&
      character !== ',' &&
      character !== '\r' &&
      character !== '\n'
    ) {
      throw new Error('Unexpected text after a quoted CSV field.');
    }
    if (character === '"') {
      if (field.length > 0 || closedQuote) {
        throw new Error('A quote can only begin an empty CSV field.');
      }
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
      closedQuote = false;
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      record.push(field);
      if (record.some((value) => value.trim() !== '')) records.push(record);
      record = [];
      field = '';
      closedQuote = false;
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('A quoted CSV field is not closed.');
  record.push(field);
  if (record.some((value) => value.trim() !== '')) records.push(record);
  return records;
}
