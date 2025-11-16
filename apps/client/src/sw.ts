/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<import('workbox-precaching').PrecacheEntry>;
};

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Cache static resources (JS/CSS/web workers)
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  })
);

// Cache API responses for offline viewing
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 15,
      }),
    ],
  })
);

// Cache Mapbox tiles and styles for offline panning
registerRoute(
  ({ url }) => url.hostname.includes('mapbox') || url.hostname.includes('tiles.mapbox.com'),
  new StaleWhileRevalidate({
    cacheName: 'mapbox-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  })
);

setCatchHandler(async ({ event }) => {
  const fetchEvent = event as FetchEvent;
  const request = 'request' in fetchEvent ? fetchEvent.request : undefined;

  if (request?.destination === 'document') {
    const cached = await caches.match('/index.html');
    if (cached) {
      return cached;
    }
    return Response.redirect('/');
  }

  return Response.error();
});

type PushPayload = {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: Record<string, unknown>;
};

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload: PushPayload;

  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { title: event.data.text() };
  }

  const title = payload.title ?? 'Geospatial update';
  const options: NotificationOptions & { vibrate?: number[] } = {
    body: payload.body ?? 'New activity detected in the geospatial dashboard.',
    icon: payload.icon ?? '/icons/pwa-192x192.png',
    badge: payload.badge ?? '/icons/pwa-maskable-192x192.png',
    data: {
      url: payload.url ?? '/',
      ...payload.data,
    },
    vibrate: [200, 50, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          const url = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (url.pathname === target.pathname) {
            return client.focus();
          }
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  console.warn('Push subscription expired or changed', event);
});
