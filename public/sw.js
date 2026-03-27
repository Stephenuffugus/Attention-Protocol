/**
 * SWS Attention Protocol — Service Worker
 * Handles push notifications and offline hash queue persistence.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */

var CACHE_NAME = 'sws-attention-v1';

// Install — cache essential assets
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Push notification received
self.addEventListener('push', function(event) {
  var data = { title: 'SWS Attention Protocol', body: 'Your attention has value.' };

  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }

  var options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag: data.tag || 'sws_push_' + Date.now(),
    data: {
      url: data.url || '/',
      sws_notif_id: data.tag || 'sws_push_' + Date.now()
    },
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification clicked — open app and flag for reward
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var url = event.notification.data ? event.notification.data.url : '/';
  var notifId = event.notification.data ? event.notification.data.sws_notif_id : '';

  if (event.action === 'dismiss') return;

  // Add notification ID to URL for tap reward tracking
  var separator = url.indexOf('?') === -1 ? '?' : '&';
  var targetUrl = url + separator + 'sws_notif=' + encodeURIComponent(notifId);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // If app is already open, focus it and navigate
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if ('focus' in client) {
          return client.focus().then(function(c) {
            if ('navigate' in c) return c.navigate(targetUrl);
          });
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// Background sync — flush hash queue when connection returns
self.addEventListener('sync', function(event) {
  if (event.tag === 'sws-hash-sync') {
    event.waitUntil(
      // Send message to all clients to trigger sync
      clients.matchAll().then(function(allClients) {
        allClients.forEach(function(client) {
          client.postMessage({ type: 'sws_sync_requested' });
        });
      })
    );
  }
});
