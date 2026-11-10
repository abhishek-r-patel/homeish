// Keep guard-sensitive visitor mutations behind server-verified guard sessions.
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';

type CreateVisitorEntryArgs = {
  p_actor_id: string;
  p_society_id: string;
  p_unit_id: string;
  p_guard_id: string;
  p_visitor_name: string;
  p_visitor_phone: string | null;
  p_purpose: string;
  p_people_count: number;
  p_vehicle_no: string | null;
  p_photo_path: string | null;
  p_client_request_id: string;
  p_request_id: string;
};

export function createVisitorEntryPrivileged<T>(
  args: CreateVisitorEntryArgs,
): Promise<T> {
  return invokeUntypedRpc<T>(privilegedClient, 'visitor_create_entry', args);
}

export function overrideVisitorPrivileged<T>(args: {
  p_actor_id: string;
  p_entry_id: string;
  p_guard_id: string;
  p_reason: string;
  p_request_id: string;
}): Promise<T> {
  return invokeUntypedRpc<T>(privilegedClient, 'visitor_override', args);
}

export function checkInVisitorPrivileged<T>(args: {
  p_actor_id: string;
  p_entry_id: string;
  p_guard_id: string;
  p_request_id: string;
}): Promise<T> {
  return invokeUntypedRpc<T>(privilegedClient, 'visitor_check_in', args);
}

export function checkOutVisitorPrivileged<T>(args: {
  p_actor_id: string;
  p_entry_id: string;
  p_guard_id: string;
  p_request_id: string;
}): Promise<T> {
  return invokeUntypedRpc<T>(privilegedClient, 'visitor_check_out', args);
}

export function validateVisitorCodePrivileged<T>(args: {
  p_actor_id: string;
  p_society_id: string;
  p_code: string;
  p_request_id: string;
}): Promise<T> {
  return invokeUntypedRpc<T>(
    privilegedClient,
    'visitor_pre_approval_validate',
    args,
  );
}

export function checkInPreApprovedVisitorPrivileged<T>(args: {
  p_actor_id: string;
  p_society_id: string;
  p_code: string;
  p_guard_id: string;
  p_request_id: string;
}): Promise<T> {
  return invokeUntypedRpc<T>(
    privilegedClient,
    'visitor_pre_approval_check_in',
    args,
  );
}
