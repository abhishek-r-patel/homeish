// Lay out one QR code per patrol checkpoint on a printable A4 sheet with the name and typed code underneath.
import Image from 'next/image';
import { formatPatrolCode } from '@/core/patrol/presentation';
import type { PatrolPrintSheet } from '@/core/patrol/validation';
import { PatrolPrintButton } from './shared';

const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  body * { visibility: hidden; }
  #patrol-print-sheet, #patrol-print-sheet * { visibility: visible; }
  #patrol-print-sheet { position: absolute; inset: 0 auto auto 0; width: 100%; }
  .patrol-print-tile { break-inside: avoid; page-break-inside: avoid; }
}
`;

export function PatrolPrintSheetView({
  sheet,
  qrCodes,
}: {
  sheet: PatrolPrintSheet;
  qrCodes: ReadonlyMap<string, string>;
}) {
  return (
    <section className="grid min-w-0 gap-space-5">
      <style>{PRINT_CSS}</style>
      <div className="grid gap-space-3 print:hidden">
        <h1 className="text-title font-semibold">Patrol QR sheet</h1>
        <p className="text-body">
          Print on A4, cut along the borders and fix each sticker at its
          checkpoint. Guards can also type the code under the QR.
        </p>
        <div className="flex flex-wrap items-center gap-space-3">
          {sheet.checkpoints.length > 0 ? <PatrolPrintButton /> : null}
          <a
            href="/admin/patrol"
            className="inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            Back to patrol
          </a>
        </div>
      </div>
      {sheet.checkpoints.length === 0 ? (
        <p className="text-body text-ink-muted">
          There are no active checkpoints to print.
        </p>
      ) : (
        <div id="patrol-print-sheet" className="grid gap-space-3">
          <p className="text-caption text-ink-muted">
            {sheet.society_name} · guard patrol checkpoints
          </p>
          <ul className="grid grid-cols-1 gap-space-3 medium:grid-cols-3 print:grid-cols-3">
            {sheet.checkpoints.map((checkpoint) => {
              const qr = qrCodes.get(checkpoint.id);
              return (
                <li
                  key={checkpoint.id}
                  className="patrol-print-tile grid justify-items-center gap-space-1 rounded-md border border-dashed border-rule-strong bg-surface p-space-3 text-center text-ink"
                >
                  {qr ? (
                    <Image
                      src={qr}
                      alt={`QR code for ${checkpoint.name}`}
                      width={160}
                      height={160}
                      unoptimized
                    />
                  ) : null}
                  <p className="text-body-strong break-words">
                    {checkpoint.name}
                  </p>
                  <p className="font-mono text-subheading tracking-widest">
                    {formatPatrolCode(checkpoint.code)}
                  </p>
                  {checkpoint.location_note ? (
                    <p className="text-caption break-words text-ink-muted">
                      {checkpoint.location_note}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
