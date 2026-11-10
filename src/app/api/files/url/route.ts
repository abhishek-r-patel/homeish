// Issue a five-minute view URL only to society members or verified developers.
import { z } from 'zod';
import { AppError, ValidationError } from '../../../../core/errors';
import { isSocietyLogoPath } from '../../../../core/files/attachments';
import { runFileRoute } from '../../../../core/files/http';
import type { RequestContext } from '../../../../core/tenancy/request-context';

const viewSchema = z
  .object({
    bucket: z.literal('society-assets'),
    path: z.string().max(500),
  })
  .strict();

function parseBody(body: unknown) {
  const parsed = viewSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError({ body: 'The file request is invalid.' });
  }
  const societyId = parsed.data.path.split('/')[0] ?? '';
  if (!isSocietyLogoPath(parsed.data.path, societyId)) {
    throw new ValidationError({ path: 'Choose a valid society file.' });
  }
  return { ...parsed.data, societyId };
}

async function authorizeView(context: RequestContext, societyId: string) {
  const isMember = context.memberships.some(
    (membership) => membership.societyId === societyId,
  );
  if (!isMember && context.isDeveloperAccount && !context.mfaVerified) {
    throw new AppError('MFA_REQUIRED');
  }
  if (!isMember && !context.isDeveloperAccount) {
    throw new AppError('FORBIDDEN');
  }
  const { data, error } = await context.db
    .from('societies')
    .select('id')
    .eq('id', societyId)
    .maybeSingle();
  if (error) {
    throw new Error('Could not verify the file owner.', { cause: error });
  }
  if (!data) throw new AppError('NOT_FOUND');
}

export async function POST(request: Request) {
  return runFileRoute(request, '/api/files/url', async (context, body) => {
    const input = parseBody(body);
    await authorizeView(context, input.societyId);
    const expiresIn = 300;
    const { data, error } = await context.db.storage
      .from(input.bucket)
      .createSignedUrl(input.path, expiresIn);
    if (error || !data) {
      throw new Error('Could not issue the society file view URL.', {
        cause: error,
      });
    }
    return { expiresIn, signedUrl: data.signedUrl };
  });
}
