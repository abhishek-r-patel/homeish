// Write scrubbed operational logs through the isolated service-role client.
import { scrubLogData, scrubLogText } from '../logging/scrub';
import type { Database, Json } from '../db/database.types';
import { privilegedClient } from './server-client';

type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];
type ErrorLogInsert = Database['public']['Tables']['error_logs']['Insert'];

export type AuditLogWrite = Pick<AuditLogInsert, 'action' | 'entity_type'> &
  Partial<
    Pick<
      AuditLogInsert,
      | 'society_id'
      | 'actor_id'
      | 'actor_role'
      | 'entity_id'
      | 'before'
      | 'after'
      | 'reason'
      | 'request_id'
    >
  >;

export type ErrorLogWrite = Pick<
  ErrorLogInsert,
  'reference_id' | 'source' | 'severity' | 'message'
> &
  Partial<
    Pick<
      ErrorLogInsert,
      | 'society_id'
      | 'user_id'
      | 'role'
      | 'module_key'
      | 'route'
      | 'stack'
      | 'app_version'
      | 'device'
      | 'request_id'
    >
  >;

function scrubSnapshot(
  value: Json | null | undefined,
): Json | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }
  const scrubbed = scrubLogData(value);
  if (
    typeof scrubbed !== 'object' ||
    scrubbed === null ||
    Array.isArray(scrubbed)
  ) {
    throw new Error('Audit snapshots must be JSON objects.');
  }
  return scrubbed;
}

export async function writeAuditLog(entry: AuditLogWrite): Promise<void> {
  const { error } = await privilegedClient.from('audit_logs').insert({
    action: scrubLogText(entry.action),
    entity_type: scrubLogText(entry.entity_type),
    society_id: entry.society_id ?? null,
    actor_id: entry.actor_id ?? null,
    actor_role: entry.actor_role ? scrubLogText(entry.actor_role) : null,
    entity_id: entry.entity_id ? scrubLogText(entry.entity_id) : null,
    before: scrubSnapshot(entry.before),
    after: scrubSnapshot(entry.after),
    reason: entry.reason ? scrubLogText(entry.reason) : null,
    request_id: entry.request_id ? scrubLogText(entry.request_id) : null,
  });
  if (error) {
    throw new Error('Failed to write an audit log entry.');
  }
}

function scrubDevice(device: Json | null | undefined): Json | null | undefined {
  if (device === null || device === undefined) {
    return device;
  }
  const scrubbed = scrubLogData(device);
  if (
    typeof scrubbed !== 'object' ||
    scrubbed === null ||
    Array.isArray(scrubbed)
  ) {
    return null;
  }
  return scrubbed;
}

export async function writeErrorLog(entry: ErrorLogWrite): Promise<void> {
  const route = entry.route?.split('?')[0];
  const { error } = await privilegedClient.from('error_logs').insert({
    reference_id: scrubLogText(entry.reference_id),
    source: entry.source,
    severity: entry.severity,
    message: scrubLogText(entry.message),
    society_id: entry.society_id ?? null,
    user_id: entry.user_id ?? null,
    role: entry.role ? scrubLogText(entry.role) : null,
    module_key: entry.module_key ?? null,
    route: route ? scrubLogText(route) : null,
    stack: entry.stack ? scrubLogText(entry.stack) : null,
    app_version: entry.app_version ? scrubLogText(entry.app_version) : null,
    device: scrubDevice(entry.device),
    request_id: entry.request_id ? scrubLogText(entry.request_id) : null,
  });
  if (error) {
    throw new Error('Failed to write an error log entry.');
  }
}
