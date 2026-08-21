const CACHE = 'dette-royale-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone()
        void caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))),
  )
})

self.addEventListener('push', (event) => {
  let payload = { title: 'Dette Royale', body: 'Nouveau message', href: '/' }
  try {
    payload = { ...payload, ...event.data.json() }
  } catch {
    undefined
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon',
      badge: '/icon',
      data: { href: payload.href },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows[0]
      if (existing) {
        void existing.focus()
        if ('navigate' in existing) {
          return existing.navigate(href)
        }
        return existing
      }
      return self.clients.openWindow(href)
    }),
  )
})
