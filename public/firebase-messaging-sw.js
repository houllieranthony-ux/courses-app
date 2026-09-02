/* Background push notifications (app closed or in another tab). */
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

// These values are public client identifiers (safe to ship), filled in at build
// time by copying vite's define, but a service worker can't read import.meta.env,
// so we fetch them from a small static JSON generated at build time instead.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

async function initFirebase() {
  const res = await fetch('/firebase-config.json')
  const config = await res.json()
  firebase.initializeApp(config)
  const messaging = firebase.messaging()
  messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification || {}
    self.registration.showNotification(title || 'Garde-manger', {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  })
}

initFirebase()
