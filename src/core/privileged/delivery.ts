// Keep guard-sensitive delivery mutations behind the verified service client.
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';

type CreateDeliveryEntryArgs = {
  p_actor_id: string;
  p_society_id: string;
  p_unit_id: string;
  p_guard_id: string;
  p_company: string;
  p_delivery_person: string | null;
  p_delivery_type: string;
  p_photo_path: string | null;
  p_client_request_id: string;
  p_request_id: string;
};

type OverrideDeliveryArgs = {
  p_actor_id: string;
  p_entry_id: string;
  p_guard_id: string;
  p_decision: string;
  p_reason: string;
  p_request_id: string;
};

type CollectDeliveryAsGuardArgs = {
  p_actor_id: string;
  p_entry_id: string;
  p_guard_id: string;
  p_request_id: string;
};

export function createDeliveryEntryPrivileged<T>(
  args: CreateDeliveryEntryArgs,
): Promise<T> {
  return invokeUntypedRpc<T>(privilegedClient, 'delivery_create_entry', args);
}

export function overrideDeliveryPrivileged<T>(
  args: OverrideDeliveryArgs,
): Promise<T> {
  return invokeUntypedRpc<T>(privilegedClient, 'delivery_override', args);
}

export function collectDeliveryAsGuardPrivileged<T>(
  args: CollectDeliveryAsGuardArgs,
): Promise<T> {
  return invokeUntypedRpc<T>(
    privilegedClient,
    'delivery_mark_collected_guard',
    args,
  );
}
