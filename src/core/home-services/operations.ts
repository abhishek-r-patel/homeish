// Authorise Home-Services operations and validate their transactional database contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  homeServicesAdminWorkspaceSchema,
  homeServicesArchiveInputSchema,
  homeServicesCommentVisibilityInputSchema,
  homeServicesDirectorySchema,
  homeServicesProviderDetailSchema,
  homeServicesProviderInputSchema,
  homeServicesRatingInputSchema,
  homeServicesReviewInputSchema,
  homeServicesSuggestionInputSchema,
} from './validation';

async function getContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'home_services',
    permission,
    write,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

export async function getHomeServicesDirectory() {
  const { context, societyId } = await getContext('home_services:list');
  return callModuleRpc(
    context,
    'home_services_directory',
    { p_society_id: societyId },
    homeServicesDirectorySchema,
    'Could not load home services. Refresh and retry.',
  );
}

export async function getHomeServicesProvider(providerId: unknown) {
  const { context, societyId } = await getContext('home_services:list');
  const id = parseModuleInput(z.uuid(), providerId);
  return callModuleRpc(
    context,
    'home_services_provider_detail',
    { p_society_id: societyId, p_provider_id: id },
    homeServicesProviderDetailSchema,
    'Could not load this provider. Refresh and retry.',
  );
}

export async function getHomeServicesAdminWorkspace() {
  const { context, societyId } = await getContext('home_services:list');
  if (!context.roles.some((role) => role === 'admin' || role === 'committee'))
    throw new AppError('FORBIDDEN');
  return callModuleRpc(
    context,
    'home_services_admin_workspace',
    { p_society_id: societyId },
    homeServicesAdminWorkspaceSchema,
    'Could not load home services. Refresh and retry.',
  );
}

export async function saveHomeServicesProvider(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'home_services:manage',
    true,
    requestId,
  );
  const provider = parseModuleInput(homeServicesProviderInputSchema, input);
  return callModuleRpc(
    context,
    'home_services_provider_save',
    {
      p_society_id: societyId,
      p_provider_id: provider.providerId,
      p_name: provider.name,
      p_service_type: provider.serviceType,
      p_phone: provider.phone,
      p_area: provider.area,
      p_notes: provider.notes,
      p_expected_version: provider.expectedVersion,
      p_client_request_id: provider.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The provider was not saved. Check the name, service type and phone number. Archived or rejected providers cannot be edited.',
  );
}

export async function suggestHomeServicesProvider(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'home_services:suggest',
    true,
    requestId,
  );
  const provider = parseModuleInput(homeServicesSuggestionInputSchema, input);
  return callModuleRpc(
    context,
    'home_services_provider_suggest',
    {
      p_society_id: societyId,
      p_name: provider.name,
      p_service_type: provider.serviceType,
      p_phone: provider.phone,
      p_area: provider.area,
      p_notes: provider.notes,
      p_client_request_id: provider.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The suggestion was not sent. Check the name, service type and phone number.',
  );
}

export async function reviewHomeServicesSuggestion(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'home_services:manage',
    true,
    requestId,
  );
  const review = parseModuleInput(homeServicesReviewInputSchema, input);
  await callModuleRpc(
    context,
    'home_services_suggestion_review',
    {
      p_society_id: societyId,
      p_provider_id: review.providerId,
      p_approve: review.approve,
      p_reason: review.reason,
      p_expected_version: review.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The suggestion was not reviewed. Keep the reason within 300 characters.',
  );
}

export async function archiveHomeServicesProvider(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'home_services:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(homeServicesArchiveInputSchema, input);
  await callModuleRpc(
    context,
    'home_services_provider_archive',
    {
      p_society_id: societyId,
      p_provider_id: values.providerId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The provider was not archived. Refresh and retry.',
  );
}

export async function saveHomeServicesRating(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'home_services:rate',
    true,
    requestId,
  );
  const rating = parseModuleInput(homeServicesRatingInputSchema, input);
  return callModuleRpc(
    context,
    'home_services_rating_save',
    {
      p_society_id: societyId,
      p_provider_id: rating.providerId,
      p_stars: rating.stars,
      p_comment: rating.comment,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Your rating was not saved. Choose 1 to 5 stars and keep the comment within 500 characters.',
  );
}

export async function setHomeServicesCommentVisibility(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'home_services:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(
    homeServicesCommentVisibilityInputSchema,
    input,
  );
  await callModuleRpc(
    context,
    'home_services_comment_visibility_set',
    {
      p_society_id: societyId,
      p_rating_id: values.ratingId,
      p_hidden: values.hidden,
      p_request_id: context.requestId,
    },
    z.null(),
    'The comment was not updated. Refresh and retry.',
  );
}
