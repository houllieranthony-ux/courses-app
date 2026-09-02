import { getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc } from 'firebase/firestore'
import { db, HOUSEHOLD_ID, VAPID_KEY, getMessagingIfSupported } from './firebase'

/**
 * Ask for notification permission and register this device's FCM token under
 * the signed-in user, so both the daily GitHub Actions job and the shopping
 * signal can push to it. Fully REPLACES any previous token for this person
 * (not appended, not keyed by device) — a per-device id in localStorage was
 * tried first, but a reinstalled PWA wipes localStorage too, so it just
 * grew a fresh "device" each time and duplicated every notification. Each
 * of you uses one phone for this app, so one token per person is correct
 * and, unlike the per-device approach, self-heals on every reinstall.
 */
export async function enablePushNotifications(user) {
  if (!user) return { ok: false, reason: 'not-signed-in' }
  if (!('Notification' in window)) return { ok: false, reason: 'unsupported' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  const messaging = await getMessagingIfSupported()
  if (!messaging) return { ok: false, reason: 'unsupported' }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  if (!token) return { ok: false, reason: 'no-token' }

  await setDoc(
    doc(db, `households/${HOUSEHOLD_ID}/members/${user.uid}`),
    { fcmToken: token, email: user.email },
    { merge: true },
  )

  return { ok: true, token }
}

/** Foreground push handler (app open) — shows a small in-app toast via callback. */
export async function listenForegroundMessages(onMessageReceived) {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return () => {}
  return onMessage(messaging, onMessageReceived)
}

/** Re-reads this device's current FCM token (cheap once already subscribed) — for debugging. */
export async function getCurrentDeviceToken() {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return null
  const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
  if (!registration) return null
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
}
