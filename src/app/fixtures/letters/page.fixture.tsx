// Exercise the letter maker with synthetic records and a client-side PDF; never call hosted Auth or data.
'use client';
import { useState } from 'react';
import {
  LettersWorkspace,
  type LettersWorkspaceData,
} from '@/components/letters/letters-workspace';
import { AppError } from '@/core/errors';
import type { LetterSource } from '@/core/letters/content';
import { renderLetterPdf } from '@/core/letters/pdf';
import {
  LETTER_TYPES,
  letterFileName,
  type LetterDraft,
} from '@/core/letters/validation';

const society: LettersWorkspaceData['society'] = {
  name: 'Fixture Heights CHS',
  address: '12 Example Road',
  city: 'Pune',
  contactEmail: 'office@example.test',
  contactPhone: '+91 90000 00000',
  timezone: 'Asia/Kolkata',
};

const bookingsByDate: Record<string, LetterSource[]> = {
  '2026-11-21': [
    {
      type: 'amenity_booking',
      id: '6c1b1f8e-2f55-4f39-9a5f-0d9f3c1a7b21',
      date: '2026-11-21',
      unitNumber: 'A-101',
      amenityName: 'Community Hall',
      startsAt: '2026-11-21T12:30:00Z',
      endsAt: '2026-11-21T16:30:00Z',
      guestCount: 40,
      feePaise: 250000,
      rulesSnapshot: 'Music must stop by 10 pm.',
    },
  ],
};

function workspaceFor(date: string): LettersWorkspaceData {
  return {
    today: '2026-11-20',
    amenityDate: date,
    society,
    letterTypes: LETTER_TYPES,
    sources: {
      billing_bill: [
        {
          type: 'billing_bill',
          id: '0b7a3c52-4d1e-4f8a-9b6c-2e5d7f9a1c30',
          unitNumber: 'A-101',
          title: 'Maintenance',
          periodStart: '2026-11-01',
          dueDate: '2026-11-15',
          totalPaise: 350000,
          paidPaise: 100000,
          waivedPaise: 0,
          outstandingPaise: 250000,
        },
      ],
      membership: [
        {
          type: 'membership',
          id: '3f8e2d1c-5b4a-4c9d-8e7f-6a5b4c3d2e10',
          fullName: 'Asha Example',
          unitNumber: 'B-202',
        },
      ],
      service_request: [
        {
          type: 'service_request',
          id: '9d2c4b6a-8e1f-4a3b-9c5d-7e6f5a4b3c21',
          unitNumber: 'C-303',
          categoryName: 'Plumbing',
          description: 'Kitchen tap is leaking.',
          createdAt: '2026-11-18T05:30:00Z',
          requesterName: 'Ravi Example',
        },
      ],
      amenity_booking: bookingsByDate[date] ?? [],
      vendor_work_order: null,
    },
    recentLogs: [
      {
        id: 'e1d2c3b4-a5f6-4e7d-8c9b-0a1b2c3d4e5f',
        letter_type: 'circular',
        source_type: null,
        source_id: null,
        generated_by_name: 'Fixture Admin',
        generated_at: '2026-11-19T06:00:00Z',
      },
    ],
  };
}

async function downloadInBrowser(draft: LetterDraft) {
  try {
    const bytes = await renderLetterPdf(draft, society);
    return {
      ok: true as const,
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], {
        type: 'application/pdf',
      }),
      fileName: letterFileName(draft.letterType, draft.letterDate),
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false as const,
        message: error.message,
        fieldErrors: error.fieldErrors ? { ...error.fieldErrors } : undefined,
      };
    }
    throw error;
  }
}

export default function LettersFixturePage() {
  const [date, setDate] = useState('2026-11-21');
  const [reloaded, setReloaded] = useState(false);
  return (
    <main className="mx-auto grid min-h-dvh max-w-content-default min-w-0 content-start gap-space-5 px-space-4 py-space-6">
      <h1 className="text-title font-semibold">Letters</h1>
      <LettersWorkspace
        key={date}
        workspace={workspaceFor(date)}
        onDownload={downloadInBrowser}
        initialType={reloaded ? 'hall_booking_confirmation' : undefined}
        onAmenityDateChange={(value) => {
          setDate(value);
          setReloaded(true);
        }}
      />
    </main>
  );
}
