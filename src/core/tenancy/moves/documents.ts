// Render the approved move-out NOC from a database-authorised issue snapshot.
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { AppError } from '../../errors';
import type { TenancyNocSnapshot } from './validation';
import { formatTenancyDate, formatTenancyTimestamp } from './presentation';

export function tenancyNocText(snapshot: TenancyNocSnapshot): string {
  const dues =
    snapshot.dues.status === 'cleared'
      ? `cleared as of ${formatTenancyTimestamp(snapshot.dues.checked_at, snapshot.timezone, true)}`
      : 'not checked because Billing is disabled';
  return (
    `${snapshot.society_name} has no objection to the approved move-out of ${snapshot.tenant_name} ` +
    `from ${snapshot.unit_number} on ${formatTenancyDate(snapshot.move_date)}. ` +
    `Dues status at issue: ${dues}. ` +
    `Issued by ${snapshot.issuer_name} on ${formatTenancyTimestamp(snapshot.issued_at, snapshot.timezone, true)}. ` +
    "This records the society's move-out approval."
  );
}

export async function tenancyNocPdf(
  snapshot: TenancyNocSnapshot,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle('Move-out NOC');
  document.setCreator('Homeish');
  document.setProducer('Homeish');
  document.setCreationDate(new Date(snapshot.issued_at));
  document.setModificationDate(new Date(snapshot.issued_at));
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([595.28, 841.89]);
  let y = 790;
  for (const [paragraph, size, face] of [
    [snapshot.society_name, 16, bold],
    ['Move-out NOC', 14, bold],
    [tenancyNocText(snapshot), 11, font],
  ] as const) {
    const supportedCharacters = new Set(face.getCharacterSet());
    const words = paragraph.normalize('NFC').split(/\s+/);
    for (const word of words) {
      for (const character of word) {
        const codePoint = character.codePointAt(0);
        if (codePoint === undefined || !supportedCharacters.has(codePoint)) {
          throw new AppError('VALIDATION_FAILED', {
            message:
              'The NOC contains text the current PDF font cannot render faithfully. No NOC was issued. Ask the platform administrator to add font support.',
          });
        }
      }
    }
    let line = '';
    const draw = () => {
      if (y < 60) {
        page = document.addPage([595.28, 841.89]);
        y = 790;
      }
      page.drawText(line.trim(), { x: 48, y, size, font: face });
      y -= size * 1.5;
    };
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (face.widthOfTextAtSize(next, size) <= 499) {
        line = next;
        continue;
      }
      if (line) draw();
      line = '';
      for (const character of word) {
        if (face.widthOfTextAtSize(line + character, size) > 499) {
          draw();
          line = '';
        }
        line += character;
      }
    }
    if (line) draw();
    y -= 18;
  }
  return document.save();
}
