// Render numbered-certificate text without relabelling an immutable issued artifact.
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { AppError } from '../../errors';
import { certificateText } from './presentation';
import type {
  CertificatePreparation,
  ClearanceHandoverDetail,
} from './validation';

export async function tenancyCertificatePdf(
  preparation: Extract<CertificatePreparation, { status: 'prepared' }>,
  handover: ClearanceHandoverDetail | null,
  responsibleName: string | null,
  approvingAdminName: string | null,
) {
  const document = await PDFDocument.create();
  document.setTitle(
    preparation.kind === 'clearance'
      ? 'Clearance NOC'
      : preparation.kind === 'conditional'
        ? 'Conditional NOC'
        : 'Not-checked NOC',
  );
  document.setCreator('Homeish');
  document.setProducer('Homeish');
  document.setCreationDate(new Date(preparation.prepared_at));
  document.setModificationDate(new Date(preparation.prepared_at));
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const text = certificateText(preparation, {
    approval_reference: handover?.handover.approval_reference ?? null,
    approved_at: handover?.handover.approved_at ?? null,
    responsible_name:
      responsibleName ??
      (handover?.handover.responsible_transfer_party_id
        ? (preparation.parties.find(
            (party) =>
              party.membership_id ===
              handover.handover.responsible_membership_id,
          )?.name ?? handover.handover.responsible_role)
        : (handover?.handover.responsible_role ?? null)),
    approving_admin: approvingAdminName,
  });
  const page = document.addPage([595.28, 841.89]);
  const supported = new Set(font.getCharacterSet());
  for (const value of [text, preparation.signatory_name]) {
    for (const character of value.normalize('NFC')) {
      const codePoint = character.codePointAt(0);
      if (codePoint === undefined || !supported.has(codePoint)) {
        throw new AppError('VALIDATION_FAILED', {
          message:
            'The certificate contains text the current PDF font cannot render faithfully. No certificate was issued.',
        });
      }
    }
  }
  page.drawText('Society clearance certificate', {
    x: 48,
    y: 790,
    size: 16,
    font: bold,
  });
  let line = '';
  let y = 750;
  for (const word of text.normalize('NFC').split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, 11) > 499 && line) {
      page.drawText(line, { x: 48, y, size: 11, font });
      y -= 17;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) page.drawText(line, { x: 48, y, size: 11, font });
  return document.save();
}
