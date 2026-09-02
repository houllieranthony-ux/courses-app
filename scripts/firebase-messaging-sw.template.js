// Background push notifications (app closed or in another tab).
//
// The Firebase config is inlined at build time (see
// scripts/generate-sw.mjs) instead of being fetched, and
// `onBackgroundMessage` is registered synchronously at the top of the
// script — a service worker can be woken up to handle a single incoming
// push, and if the listener isn't registered before that push event is
// dispatched (e.g. because it was waiting on an async fetch first), the
// notification is silently dropped.
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

firebase.initializeApp(__FIREBASE_CONFIG__)

const messaging = firebase.messaging()
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {}
  self.registration.showNotification(title || 'Garde-manger', {
    body: body || '',
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  })
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
