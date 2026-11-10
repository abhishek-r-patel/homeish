// Verify committed request notifications load by correlation ID and reach Web Push.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('web-push', () => ({
  sendNotification: mocks.sendNotification,
  setVapidDetails: mocks.setVapidDetails,
}));
vi.mock('../../src/core/config/public-env', () => ({
  publicEnvironment: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'public-vapid-key' },
}));
vi.mock('../../src/core/config/server-env', () => ({
  serverEnvironment: {
    server: {
      VAPID_SUBJECT: 'mailto:push@example.test',
      VAPID_PRIVATE_KEY: 'private-vapid-key',
    },
  },
}));
vi.mock('../../src/core/privileged/server-client', () => ({
  privilegedClient: { from: mocks.from },
}));

import { sendNotificationPushesForRequest } from '../../src/core/privileged/notification-delivery';

const requestId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const notificationId = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const userId = 'e0d55fc3-0751-4b79-86c1-5b3e25942392';
const subscriptionId = 'f0d55fc3-0751-4b79-86c1-5b3e25942392';
const filters: { table: string; column: string; value: unknown }[] = [];

function createQuery(table: string) {
  let selectedColumns = '';
  let filter: [string, unknown] | undefined;
  let isUpdate = false;

  const result = () => {
    if (isUpdate) return { data: null, error: null };
    if (table === 'notifications' && filter?.[0] === 'request_id') {
      return { data: [{ id: notificationId }], error: null };
    }
    if (table === 'notifications' && filter?.[0] === 'id') {
      return {
        data: {
          id: notificationId,
          user_id: userId,
          title: 'A new Homeish update',
          body: 'There is a new update in your inbox.',
          entity_type: null,
          entity_id: null,
        },
        error: null,
      };
    }
    if (table === 'push_subscriptions' && selectedColumns) {
      return {
        data: [
          {
            id: subscriptionId,
            endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-token',
            p256dh: 'public-device-key',
            auth_secret: 'private-device-auth-key',
          },
        ],
        error: null,
      };
    }
    return { data: null, error: null };
  };

  const query = {
    select(columns: string) {
      selectedColumns = columns;
      return query;
    },
    eq(column: string, value: unknown) {
      filter = [column, value];
      filters.push({ table, column, value });
      return query;
    },
    update() {
      isUpdate = true;
      return query;
    },
    maybeSingle() {
      return Promise.resolve(result());
    },
    then(resolve: (value: ReturnType<typeof result>) => unknown) {
      return Promise.resolve(result()).then(resolve);
    },
  };
  return query;
}

describe('post-commit notification push dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filters.length = 0;
    mocks.from.mockImplementation((table: string) => createQuery(table));
    mocks.sendNotification.mockResolvedValue(undefined);
  });

  it('loads only notifications created by the request and sends to subscriptions', async () => {
    await expect(sendNotificationPushesForRequest(requestId)).resolves.toEqual({
      failed: 0,
      pruned: 0,
      sent: 1,
    });

    expect(mocks.from).toHaveBeenNthCalledWith(1, 'notifications');
    expect(filters).toContainEqual({
      table: 'notifications',
      column: 'request_id',
      value: requestId,
    });
    expect(mocks.setVapidDetails).toHaveBeenCalledWith(
      'mailto:push@example.test',
      'public-vapid-key',
      'private-vapid-key',
    );
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification.mock.calls[0]?.[0]).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-token',
      keys: {
        auth: 'private-device-auth-key',
        p256dh: 'public-device-key',
      },
    });
    expect(mocks.sendNotification.mock.calls[0]?.[1]).toContain(
      'A new Homeish update',
    );
  });
});
