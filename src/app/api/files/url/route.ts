// Issue a five-minute view URL only to society members or verified developers.
import { z } from 'zod';
import { AppError, ValidationError } from '../../../../core/errors';
import { isSocietyLogoPath } from '../../../../core/files/attachments';
import { runFileRoute } from '../../../../core/files/http';
import { authorizeRequest } from '../../../../core/permissions/authorize';
import type { RequestContext } from '../../../../core/tenancy/request-context';

const viewSchema = z.discriminatedUnion('bucket', [
  z
    .object({
      bucket: z.literal('society-assets'),
      path: z.string().max(500),
    })
    .strict(),
  z
    .object({
      bucket: z.literal('delivery-photos'),
      path: z.string().max(500),
    })
    .strict(),
]);

function parseBody(body: unknown) {
  const parsed = viewSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError({ body: 'The file request is invalid.' });
  }
  if (parsed.data.bucket === 'delivery-photos') {
    const match = parsed.data.path.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/deliveries\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i,
    );
    if (!match?.[1]) {
      throw new ValidationError({ path: 'Choose a valid delivery photo.' });
    }
    return { ...parsed.data, societyId: match[1] };
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
    if (input.bucket === 'delivery-photos') {
      authorizeRequest(context, {
        moduleKey: 'delivery',
        permission: 'delivery:list',
      });
      if (
        context.societyId !== input.societyId ||
        !context.roles.some((role) =>
          ['admin', 'committee', 'guard'].includes(role),
        )
      ) {
        throw new AppError('FORBIDDEN');
      }
    } else {
      await authorizeView(context, input.societyId);
    }
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
