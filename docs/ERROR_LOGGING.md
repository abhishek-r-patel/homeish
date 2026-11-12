# Homeish — Error Logging and Observability

This document defines the error, audit and monitoring boundaries for P1 and later
features. It follows [PRD LOG-1–LOG-8](./PRD.md) and [API 3.2, 3.5 and 14](./API.md).

## Capture and response

- Every unexpected server failure gets a UUID request ID and a short user-facing
  reference ID. Return `INTERNAL_ERROR`; never return exception text, SQL, stack
  traces or another user's record identifiers.
- Expected failures use the closed codes and conflict reasons in
  `src/core/errors/`. They are not reported as unexpected exceptions.
- Error-log writes are best effort. If the database is unavailable, scrubbed
  context goes to the platform logger and Sentry; logging failure never replaces
  the original response.
- Error logs are retained for 90 days. Audit logs are retained for two years.
  Retention cleanup is handled by the scheduled-job foundation.
- Browser reports are optional-auth, same-origin requests capped at 8 KB with a
  strict message/stack/path/device schema. The server does not trust client-
  supplied user or society identifiers.

## Required context

Store only fields supported by `error_logs`: reference ID, society and user IDs
when verified, role, module, route (without query parameters), source, severity,
scrubbed message and stack, app version, a scrubbed device summary, request ID
and creation time.

Never attach request or response bodies, headers, cookies, authorization data,
uploaded files, document/photo contents, or raw database results. Do not copy
unverified client-supplied society or user IDs into trusted log context.

## Scrubbing

All structured context and text pass through `scrubLogData` or `scrubLogText`
before reaching PostgreSQL, platform logs or Sentry. The shared scrubber:

- redacts credentials, bearer tokens, passwords, codes, PINs, push keys, UPI IDs,
  payment references, email addresses and phone numbers;
- redacts fields that hold request/response bodies, photos, documents, files or
  binary payloads rather than trying to inspect their contents;
- sanitizes messages and stack traces, limits string length and depth, and marks
  circular values instead of recursing indefinitely.

Do not add a parallel logger or send unsanitized exceptions/context directly to
an external service. Sentry uses the same scrubber before sending events and
does not receive request headers, request bodies or user identity.

## Audit records

Audit records are separate from error records and immutable. They contain only
the changed fields and the minimum actor/action/entity/request context; secrets,
OTPs, full documents and unnecessary personal data are prohibited. Sensitive
business changes must write the audit record in the same database transaction
as the change. A standalone privileged writer is only for platform/system
events; it must not replace the transactional database-function path.

## Severity

| Severity   | Use                                                                  |
| ---------- | -------------------------------------------------------------------- |
| `critical` | Gate, payment or tenant-isolation failure, or daily-job failure leaving scheduled work incomplete; requires immediate action |
| `error`    | An operation failed and no safe fallback completed it                |
| `warning`  | A recoverable failure or degraded path needing review                |
| `info`     | Operational event useful for diagnosis without user impact           |

Critical events are sent through Sentry's configured alert rules. Do not build a
separate alerting engine.
