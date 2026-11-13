// Issue owner-scoped upload tokens after verifying module, society and file limits.
import { z } from 'zod';
import {
  AppError,
  ConflictError,
  ValidationError,
} from '../../../../core/errors';
import {
  MAX_FILE_BYTES,
  SOCIETY_LOGO_CONTENT_TYPES,
  isBillingQrPath,
  isSocietyLogoPath,
} from '../../../../core/files/attachments';
import { readBillingPaymentDetails } from '../../../../core/billing/queries';
import { runFileRoute } from '../../../../core/files/http';
import { enforceRateLimit } from '../../../../core/rate-limit';
import { authorizeRequest } from '../../../../core/permissions/authorize';
import type { RequestContext } from '../../../../core/tenancy/request-context';

const issueSchema = z.discriminatedUnion('bucket', [
  z
    .object({
      bucket: z.literal('society-assets'),
      contentType: z.enum(SOCIETY_LOGO_CONTENT_TYPES),
      sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
      societyId: z.uuid(),
      purpose: z.enum(['logo', 'billing-qr']).default('logo'),
    })
    .strict(),
  z
    .object({
      bucket: z.literal('visitor-photos'),
      contentType: z.enum(['image/jpeg', 'image/png']),
      sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
      unitId: z.uuid(),
    })
    .strict(),
  z
    .object({
      bucket: z.literal('delivery-photos'),
      contentType: z.enum(['image/jpeg', 'image/png']),
      sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
      unitId: z.uuid(),
    })
    .strict(),
  z
    .object({
      bucket: z.literal('payment-proofs'),
      contentType: z.enum(['image/jpeg', 'image/png']),
      sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
      unitId: z.uuid(),
    })
    .strict(),
  z
    .object({
      bucket: z.literal('request-files'),
      contentType: z.enum(['image/jpeg', 'image/png']),
      sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
      requestId: z.uuid(),
    })
    .strict(),
  z
    .object({
      bucket: z.literal('notice-files'),
      contentType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
      sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
      requestId: z.uuid(),
    })
    .strict(),
]);

const pathSchema = z
  .object({ bucket: z.literal('society-assets'), path: z.string().max(500) })
  .strict();

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  throw new ValidationError({
    body: 'The file request is invalid.',
  });
}

async function getSociety(context: RequestContext, societyId: string) {
  const { data, error } = await context.db
    .from('societies')
    .select('id, logo_path')
    .eq('id', societyId)
    .maybeSingle();
  if (error) {
    throw new Error('Could not verify the file owner.', { cause: error });
  }
  if (!data) throw new AppError('NOT_FOUND');
  return data;
}

function canManageSociety(context: RequestContext, societyId: string): void {
  if (
    context.societyId === societyId &&
    context.roles.includes('admin') &&
    context.societyStatus !== 'archived' &&
    context.societyStatus !== 'suspended'
  ) {
    return;
  }
  if (context.isDeveloperAccount) {
    if (!context.mfaVerified) throw new AppError('MFA_REQUIRED');
    return;
  }
  throw new AppError('FORBIDDEN');
}

export async function POST(request: Request) {
  return runFileRoute(
    request,
    '/api/files/upload-url',
    async (context, body) => {
      const input = parse(issueSchema, body);
      if (input.bucket === 'payment-proofs') {
        authorizeRequest(context, {
          moduleKey: 'billing',
          permission: 'billing:payments:submit',
          write: true,
        });
        const societyId = context.societyId;
        if (!societyId) throw new AppError('FORBIDDEN');
        const [unitResult, occupancyResult] = await Promise.all([
          context.db
            .from('units')
            .select('id')
            .eq('id', input.unitId)
            .eq('society_id', societyId)
            .eq('active', true)
            .maybeSingle(),
          context.db
            .from('unit_occupants')
            .select('id, memberships!inner(user_id, status)')
            .eq('unit_id', input.unitId)
            .eq('society_id', societyId)
            .eq('status', 'active')
            .eq('memberships.user_id', context.userId)
            .eq('memberships.status', 'active')
            .limit(1),
        ]);
        if (unitResult.error || occupancyResult.error) {
          throw new Error('Could not verify the payment proof unit.', {
            cause: unitResult.error ?? occupancyResult.error,
          });
        }
        if (!unitResult.data || occupancyResult.data.length === 0) {
          throw new AppError('NOT_FOUND');
        }
        await enforceRateLimit(
          'billingSubmitUserHourly',
          context.userId,
          context.requestId,
        );
        const extension = input.contentType === 'image/jpeg' ? 'jpg' : 'png';
        const path = `${societyId}/${input.unitId}/payments/${crypto.randomUUID()}.${extension}`;
        const { data, error } = await context.db.storage
          .from(input.bucket)
          .createSignedUploadUrl(path);
        if (error || !data) {
          throw new Error('Could not issue the payment proof upload token.', {
            cause: error,
          });
        }
        return { path, signedUrl: data.signedUrl };
      }
      if (input.bucket === 'request-files') {
        authorizeRequest(context, {
          moduleKey: 'service_request',
          permission: 'request:create',
          write: true,
        });
        const societyId = context.societyId;
        if (!societyId) throw new AppError('FORBIDDEN');
        await enforceRateLimit(
          'fileUploadUserHourly',
          context.userId,
          context.requestId,
        );
        const extension = input.contentType === 'image/jpeg' ? 'jpg' : 'png';
        const directory = `${societyId}/${context.userId}/requests/${input.requestId}`;
        const path = `${directory}/${crypto.randomUUID()}.${extension}`;
        const { data, error } = await context.db.storage
          .from(input.bucket)
          .createSignedUploadUrl(path);
        if (error || !data) {
          throw new Error('Could not issue the request photo upload token.', {
            cause: error,
          });
        }
        return { path, signedUrl: data.signedUrl };
      }
      if (input.bucket === 'notice-files') {
        authorizeRequest(context, {
          moduleKey: 'notice',
          permission: 'notice:create',
          write: true,
        });
        const societyId = context.societyId;
        if (!societyId) throw new AppError('FORBIDDEN');
        await enforceRateLimit(
          'fileUploadUserHourly',
          context.userId,
          context.requestId,
        );
        const extension =
          input.contentType === 'image/jpeg'
            ? 'jpg'
            : input.contentType === 'image/png'
              ? 'png'
              : 'pdf';
        const path = `${societyId}/notices/${input.requestId}/${crypto.randomUUID()}.${extension}`;
        const { data, error } = await context.db.storage
          .from(input.bucket)
          .createSignedUploadUrl(path);
        if (error || !data) {
          throw new Error('Could not issue the notice file upload token.', {
            cause: error,
          });
        }
        return { path, signedUrl: data.signedUrl };
      }
      if (
        input.bucket === 'visitor-photos' ||
        input.bucket === 'delivery-photos'
      ) {
        const moduleKey =
          input.bucket === 'visitor-photos' ? 'visitor' : 'delivery';
        const permission =
          input.bucket === 'visitor-photos'
            ? 'visitor:create'
            : 'delivery:create';
        authorizeRequest(context, {
          moduleKey,
          permission,
          write: true,
        });
        const societyId = context.societyId;
        if (!societyId) throw new AppError('FORBIDDEN');
        const { data: unit, error: unitError } = await context.db
          .from('units')
          .select('id')
          .eq('id', input.unitId)
          .eq('society_id', societyId)
          .eq('active', true)
          .maybeSingle();
        if (unitError) {
          throw new Error('Could not verify the visitor photo unit.', {
            cause: unitError,
          });
        }
        if (!unit) throw new AppError('NOT_FOUND');
        await enforceRateLimit(
          'fileUploadUserHourly',
          context.userId,
          context.requestId,
        );
        const extension = input.contentType === 'image/jpeg' ? 'jpg' : 'png';
        const directory =
          input.bucket === 'visitor-photos' ? 'visitors' : 'deliveries';
        const path = `${societyId}/${input.unitId}/${directory}/${crypto.randomUUID()}.${extension}`;
        const { data, error } = await context.db.storage
          .from(input.bucket)
          .createSignedUploadUrl(path);
        if (error || !data) {
          throw new Error(
            `Could not issue the ${directory} photo upload token.`,
            { cause: error },
          );
        }
        return { path, signedUrl: data.signedUrl };
      }
      if (input.purpose === 'billing-qr') {
        authorizeRequest(context, {
          moduleKey: 'billing',
          permission: 'billing:payment_details:manage',
          write: true,
        });
        if (context.societyId !== input.societyId) {
          throw new AppError('FORBIDDEN');
        }
        await enforceRateLimit(
          'fileUploadUserHourly',
          context.userId,
          context.requestId,
        );
        const details = await readBillingPaymentDetails(
          context,
          input.societyId,
        );
        const directory = `${input.societyId}/billing-qr`;
        const { data: files, error: listError } = await context.db.storage
          .from(input.bucket)
          .list(directory, { limit: 3 });
        if (listError) {
          throw new Error('Could not check the QR image file count.');
        }
        if (files.length >= (details?.qr_path ? 2 : 1)) {
          throw new ConflictError('limit_reached');
        }
        const extension = input.contentType === 'image/jpeg' ? 'jpg' : 'png';
        const path = `${directory}/${crypto.randomUUID()}.${extension}`;
        const { data, error } = await context.db.storage
          .from(input.bucket)
          .createSignedUploadUrl(path);
        if (error || !data) {
          throw new Error('Could not issue the QR image upload token.');
        }
        return { path, signedUrl: data.signedUrl };
      }
      canManageSociety(context, input.societyId);
      await enforceRateLimit(
        'fileUploadUserHourly',
        context.userId,
        context.requestId,
      );
      const society = await getSociety(context, input.societyId);
      if (
        society.logo_path !== null &&
        !isSocietyLogoPath(society.logo_path, input.societyId)
      ) {
        throw new AppError('CONFLICT', { reason: 'invalid_state' });
      }

      const directory = `${input.societyId}/logos`;
      const { data: files, error: listError } = await context.db.storage
        .from(input.bucket)
        .list(directory, { limit: 3 });
      if (listError) {
        throw new Error('Could not check the society logo file count.', {
          cause: listError,
        });
      }
      const maxStoredFiles = society.logo_path === null ? 1 : 2;
      if (files.length >= maxStoredFiles) {
        throw new ConflictError('limit_reached');
      }

      const extension = input.contentType === 'image/jpeg' ? 'jpg' : 'png';
      const path = `${directory}/${crypto.randomUUID()}.${extension}`;
      const { data, error } = await context.db.storage
        .from(input.bucket)
        .createSignedUploadUrl(path);
      if (error || !data) {
        throw new Error('Could not issue the society logo upload token.', {
          cause: error,
        });
      }
      return { path, signedUrl: data.signedUrl };
    },
  );
}

export async function DELETE(request: Request) {
  return runFileRoute(
    request,
    '/api/files/upload-url',
    async (context, body) => {
      const input = parse(pathSchema, body);
      const billingSocietyId = input.path.split('/')[0] ?? '';
      if (isBillingQrPath(input.path, billingSocietyId)) {
        authorizeRequest(context, {
          moduleKey: 'billing',
          permission: 'billing:payment_details:manage',
          write: true,
        });
        if (context.societyId !== billingSocietyId) {
          throw new AppError('FORBIDDEN');
        }
        const details = await readBillingPaymentDetails(
          context,
          billingSocietyId,
        );
        if (details?.qr_path === input.path) {
          throw new ConflictError('invalid_state');
        }
        const { error } = await context.db.storage
          .from(input.bucket)
          .remove([input.path]);
        if (error) throw new Error('Could not remove the unused QR image.');
        return {};
      }
      const match = input.path.match(
        /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/logos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i,
      );
      const societyId = match?.[1];
      if (!societyId || !isSocietyLogoPath(input.path, societyId)) {
        throw new ValidationError({ path: 'Choose a valid logo file.' });
      }
      canManageSociety(context, societyId);
      const society = await getSociety(context, societyId);
      if (society.logo_path === input.path) {
        throw new ConflictError('invalid_state');
      }

      const { error } = await context.db.storage
        .from(input.bucket)
        .remove([input.path]);
      if (error) {
        throw new Error('Could not remove the unattached society logo.', {
          cause: error,
        });
      }
      return {};
    },
  );
}
