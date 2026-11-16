// Show an invited meeting with agenda, self check-in, outcomes and published minutes.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { MeetingRouteState } from '@/components/meeting/shared';
import { ResidentMeetingDetailView } from '@/components/meeting/resident';
import { selfCheckInToMeetingAction } from '@/app/(resident)/meetings/server-actions';
import { getMeetingMemberDetail } from '@/core/meeting/operations';
import { loadMeetingPage } from '@/core/meeting/page-access';

export const metadata = {
  title: 'Meeting | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentMeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  if (!z.uuid().safeParse(meetingId).success) notFound();
  const result = await loadMeetingPage(['resident'], () =>
    getMeetingMemberDetail(meetingId),
  );
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref="/meetings"
        retryHref={`/meetings/${meetingId}`}
      />
    );
  }
  return (
    <ResidentMeetingDetailView
      detail={result.data}
      checkInAction={selfCheckInToMeetingAction}
    />
  );
}
