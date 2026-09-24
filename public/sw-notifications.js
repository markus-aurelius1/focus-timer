/* Imported by the generated Workbox service worker: routes notification taps back into the app. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const route = (event.notification.data && event.notification.data.route) || ''
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client = all.find((c) => 'focus' in c)
      if (client) {
        await client.focus()
        if (route) client.postMessage({ type: 'lodestar:navigate', route })
        return
      }
      await self.clients.openWindow(self.registration.scope + (route || ''))
    })(),
  )
})
