// Download authorized, formula-safe AMC contracts or service visits.
import { z } from 'zod';
import { runDownloadRoute } from '@/core/files/download';
import {
  getAmcWorkspace,
  filterAmcContracts,
  amcCsv,
} from '@/core/amc/operations';
import { parseModuleInput } from '@/core/db/validated-rpc';
export async function GET(request: Request) {
  return runDownloadRoute(request, '/api/amc/export', async () => {
    const query = new URL(request.url).searchParams;
    const type = parseModuleInput(
      z.enum(['contracts', 'visits']),
      query.get('type'),
    );
    const w = await getAmcWorkspace();
    const contracts = filterAmcContracts(w.contracts, {
      status: query.get('status') ?? undefined,
      vendor: query.get('vendor') ?? undefined,
      asset: query.get('asset') ?? undefined,
    });
    return {
      contentType: 'text/csv; charset=utf-8',
      fileName: `homeish-amc-${type}.csv`,
      body: amcCsv(contracts, w.visits, type),
    };
  });
}
