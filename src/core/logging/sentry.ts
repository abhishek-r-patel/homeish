// Initialize Sentry with scrubbed events and report only safe error context.
import * as Sentry from '@sentry/nextjs';
import { serverEnvironment } from '../config/server-env';
import { scrubLogText } from './scrub';

let initialized = false;
let enabled = false;

export function initializeSentry(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  const { SENTRY_DSN } = serverEnvironment.server;
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: serverEnvironment.public.NEXT_PUBLIC_APP_ENV,
    release: serverEnvironment.server.APP_VERSION,
    includeServerName: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      queues: false,
    },
    beforeSend(event) {
      const tags: NonNullable<typeof event.tags> = {};
      for (const key of ['request_id', 'route', 'source', 'severity']) {
        const value = event.tags?.[key];
        if (typeof value === 'string') {
          tags[key] = scrubLogText(
            key === 'route' ? (value.split('?')[0] ?? '') : value,
          );
        }
      }

      const exceptions = event.exception?.values?.map((exception) => ({
        ...exception,
        value: exception.value
          ? scrubLogText(exception.value)
          : exception.value,
        stacktrace: exception.stacktrace
          ? {
              ...exception.stacktrace,
              frames: exception.stacktrace.frames?.map((frame) => ({
                ...frame,
                filename: frame.filename
                  ? scrubLogText(frame.filename)
                  : frame.filename,
                function: frame.function
                  ? scrubLogText(frame.function)
                  : frame.function,
                module: frame.module
                  ? scrubLogText(frame.module)
                  : frame.module,
                context_line: undefined,
                pre_context: undefined,
                post_context: undefined,
                vars: undefined,
                module_metadata: undefined,
              })),
            }
          : exception.stacktrace,
      }));

      return {
        ...event,
        message: event.message ? scrubLogText(event.message) : event.message,
        transaction: event.transaction
          ? scrubLogText(event.transaction.split('?')[0] ?? '')
          : event.transaction,
        logentry: event.logentry
          ? {
              ...event.logentry,
              message: event.logentry.message
                ? scrubLogText(event.logentry.message)
                : event.logentry.message,
              params: undefined,
            }
          : event.logentry,
        exception: event.exception
          ? { ...event.exception, values: exceptions }
          : event.exception,
        tags,
        request: undefined,
        user: undefined,
        contexts: undefined,
        breadcrumbs: undefined,
        extra: undefined,
      };
    },
  });
  enabled = true;
}

export function captureSentryException(
  error: unknown,
  context: {
    requestId: string;
    route: string;
    source: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
  },
): void {
  if (!enabled) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag('request_id', scrubLogText(context.requestId));
    scope.setTag('source', scrubLogText(context.source));
    scope.setTag('severity', context.severity);
    scope.setTag('route', scrubLogText(context.route.split('?')[0] ?? ''));
    Sentry.captureException(error);
  });
}
