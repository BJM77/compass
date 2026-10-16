/* BDM Compass – Firebase Cloud Messaging service worker.
 *
 * Pushes are sent by Cloud Functions as *data* messages so this worker controls
 * display and the action buttons (Snooze 1h / Tomorrow / Mark done).
 * Action buttons call the `notificationAction` HTTPS function with a
 * single-use, per-notification action token (no user credentials live here).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function parsePush(event) {
  try {
    const json = event.data ? event.data.json() : {};
    const data = Object.assign({}, json.data || {});
    if (json.notification) {
      data.title = data.title || json.notification.title;
      data.body = data.body || json.notification.body;
    }
    return data;
  } catch (e) {
    return { title: 'BDM Compass', body: event.data ? event.data.text() : '' };
  }
}

self.addEventListener('push', (event) => {
  const data = parsePush(event);
  const actions = [];
  if (data.actionToken && data.actionUrl) {
    actions.push({ action: 'snooze1h', title: 'Snooze 1h' });
    actions.push({ action: 'tomorrow', title: 'Tomorrow' });
    actions.push({ action: 'done', title: 'Mark done' });
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'BDM Compass', {
      body: data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data,
      actions: actions.slice(0, 3),
    })
  );
});

async function openOrFocus(link) {
  const url = new URL(link || '/dashboard?view=MANAGE_TIME', self.location.origin).href;
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of all) {
    if (c.url.startsWith(self.location.origin) && 'focus' in c) {
      try { await c.navigate(url); } catch (e) { /* cross-scope */ }
      return c.focus();
    }
  }
  return self.clients.openWindow(url);
}

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const data = n.data || {};
  n.close();
  const action = event.action;
  if (action && data.actionToken && data.actionUrl) {
    event.waitUntil(
      fetch(data.actionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.actionToken, action }),
      })
        .then((r) => r.ok
          ? self.registration.showNotification('BDM Compass', {
              body: action === 'done' ? 'Marked done ✓' : action === 'tomorrow' ? 'Moved to tomorrow 9am' : 'Snoozed for 1 hour',
              icon: '/favicon.ico', tag: 'action-ack',
            })
          : openOrFocus(data.link))
        .catch(() => openOrFocus(data.link))
    );
    return;
  }
  event.waitUntil(openOrFocus(data.link));
});
