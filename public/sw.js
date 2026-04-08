self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "FigBack";
  const options = {
    body: data.body || "You have new design feedback",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
