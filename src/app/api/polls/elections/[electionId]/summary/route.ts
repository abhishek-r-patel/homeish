// Download the P46 election summary without voter names or ballot choices.
import { z } from 'zod';
import { runDownloadRoute } from '@/core/files/download';
import { parseModuleInput } from '@/core/db/validated-rpc';
import { getPollElectionSummary } from '@/core/poll/election-operations';
import { pollElectionSummaryPdf } from '@/core/poll/election-documents';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ electionId: string }> },
) {
  return runDownloadRoute(request, '/api/polls/elections/summary', async () => {
    const query = new URL(request.url).searchParams;
    parseModuleInput(z.literal('pdf'), query.get('format'));
    const { electionId } = await params;
    const election = await getPollElectionSummary(electionId);
    if (!election.society_name)
      throw new Error('Could not load the election society name.');
    return {
      contentType: 'application/pdf',
      fileName: `homeish-election-summary-${electionId}.pdf`,
      body: await pollElectionSummaryPdf(election.society_name, election),
    };
  });
}
