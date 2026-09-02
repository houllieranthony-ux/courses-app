import { getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc, arrayUnion } from 'firebase/firestore'
import { db, HOUSEHOLD_ID, VAPID_KEY, getMessagingIfSupported } from './firebase'

/**
 * Ask for notification permission and register this device's FCM token under
 * the signed-in user, so the daily GitHub Actions job can push to it.
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
    { fcmTokens: arrayUnion(token), email: user.email },
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
