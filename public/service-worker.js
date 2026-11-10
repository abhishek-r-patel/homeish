// Display only the minimized payload produced by the server-side sender.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }

  const title =
    typeof payload.title === 'string' && payload.title.length <= 120
      ? payload.title
      : 'Homeish';
  const body =
    typeof payload.body === 'string' && payload.body.length <= 300
      ? payload.body
      : 'You have a new update.';
  const requestedUrl =
    typeof payload.url === 'string' && payload.url.startsWith('/')
      ? payload.url
      : '/notifications';
  let url = '/notifications';
  try {
    const parsedUrl = new URL(requestedUrl, self.location.origin);
    if (parsedUrl.origin === self.location.origin) {
      url = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }
  } catch {
    url = '/notifications';
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      badge: '/icons/homeish-192.png',
      data: { url },
      icon: '/icons/homeish-192.png',
      tag: 'homeish-update',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination =
    typeof event.notification.data?.url === 'string' &&
    event.notification.data.url.startsWith('/')
      ? event.notification.data.url
      : '/notifications';
  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then(async (windows) => {
        const appWindow = windows.find(
          (windowClient) =>
            new URL(windowClient.url).origin === self.location.origin,
        );
        if (appWindow) {
          await appWindow.navigate(destination);
          return appWindow.focus();
        }
        return self.clients.openWindow(destination);
      }),
  );
});
