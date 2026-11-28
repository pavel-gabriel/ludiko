/* Ludiko — Web Push handlers (docs/NOTIFICATIONS.md).
 * Loaded into the generated service worker with workbox `importScripts`; plain JS, no imports.
 * Payload (JSON): { title, body, url, tag }. Every URL is resolved against the registration
 * scope, so the app works from any base path. */

/** '/learn' or 'learn' -> absolute URL inside this app's scope */
function resolveInScope(url) {
  var path = typeof url === 'string' && url ? url : 'learn';
  try {
    var href = new URL(path.replace(/^\/+/, ''), self.registration.scope).href;
    // never open another site, even if a payload carries an absolute URL (docs/SECURITY.md S-12)
    return href.indexOf(self.registration.scope) === 0 ? href : self.registration.scope;
  } catch (e) {
    return self.registration.scope;
  }
}

self.addEventListener('push', function (event) {
  var data = {};
  if (event.data) {
    try {
      data = event.data.json() || {};
    } catch (e) {
      try {
        data = { body: event.data.text() };
      } catch (e2) {
        data = {};
      }
    }
  }
  var icon = new URL('icons/icon-192.png', self.registration.scope).href;
  var options = {
    body: data.body || '',
    icon: icon,
    badge: icon,
    tag: data.tag || 'ludiko-daily',
    data: { url: resolveInScope(data.url) },
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Ludiko', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || resolveInScope('learn');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var client = windows[i];
        if (client.url.indexOf(self.registration.scope) === 0 && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
