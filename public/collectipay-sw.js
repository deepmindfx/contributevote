const OFFLINE_CACHE = "collectipay-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add("/offline.html")).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("collectipay-offline-") && key !== OFFLINE_CACHE).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match("/offline.html")) ||
    new Response("CollectiPay is offline. Reconnect to continue.", { status: 503 })));
});
self.addEventListener("push", (event) => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; } catch { /* Use the generic alert. */ }
  event.waitUntil((async () => {
    const payment = message.incoming || message.kind === "wallet" || message.kind === "group";
    const quiet = payment && message.vibration === false;
    const windows = message.incoming && !quiet ? await self.clients.matchAll({ type: "window", includeUncontrolled: true }) : [];
    const appVisible = windows.some((client) => client.visibilityState === "visible");
    await self.registration.showNotification(message.title || "CollectiPay", {
      body: message.body || "You have a new update.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      image: message.incoming ? "/images/collectipay-money-alert.png" : undefined,
      tag: message.id ? "collectipay-" + message.id : undefined,
      ...(quiet ? { silent: true } : message.incoming && !appVisible ? { vibrate: [110, 70, 150] } : {}),
      data: { href: message.href || "/dashboard" },
    });
  })());
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = new URL(event.notification.data?.href || "/dashboard", self.location.origin);
  const destination = requested.origin === self.location.origin ? requested.href : self.location.origin + "/dashboard";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    for (const window of windows) {
      if (new URL(window.url).origin !== self.location.origin) continue;
      const focused = await window.navigate(destination);
      if (focused) return focused.focus();
    }
    return self.clients.openWindow(destination);
  }));
});
