import { getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc } from 'firebase/firestore'
import { db, HOUSEHOLD_ID, VAPID_KEY, getMessagingIfSupported } from './firebase'

// The push worker MUST live in its own scope. The PWA plugin's Workbox worker
// (/sw.js) registers on every page load with scope "/", and a scope can only
// have one worker: registering firebase-messaging-sw.js on "/" as well meant
// the two took turns replacing each other — push worked right after tapping
// "Activer", then silently stopped at the next app launch when Workbox took
// the scope back (a worker without any push handler, so FCM said "sent" but
// nothing was ever displayed). This is Firebase's own default scope name.
const PUSH_SW_URL = '/firebase-messaging-sw.js'
const PUSH_SCOPE = '/firebase-cloud-messaging-push-scope'

function registerPushWorker() {
  return navigator.serviceWorker.register(PUSH_SW_URL, { scope: PUSH_SCOPE })
}

async function fetchDeviceToken() {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return null
  const registration = await registerPushWorker()
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
}

async function saveToken(user, token) {
  // One token per person, replaced each time: appending (or keying by device)
  // left stale tokens behind after every PWA reinstall and duplicated pushes.
  await setDoc(
    doc(db, `households/${HOUSEHOLD_ID}/members/${user.uid}`),
    { fcmToken: token, email: user.email },
    { merge: true },
  )
  try {
    localStorage.setItem('fcm-token-synced', `${user.uid}:${token}`)
  } catch {
    // storage unavailable — worst case we rewrite the same token next launch
  }
}

/**
 * Ask for notification permission and register this device's FCM token under
 * the signed-in user, so both the daily GitHub Actions job and the shopping
 * signal can push to it.
 */
export async function enablePushNotifications(user) {
  if (!user) return { ok: false, reason: 'not-signed-in' }
  if (!('Notification' in window)) return { ok: false, reason: 'unsupported' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  const token = await fetchDeviceToken()
  if (!token) return { ok: false, reason: 'unsupported' }

  await saveToken(user, token)
  return { ok: true, token }
}

/**
 * Silent re-sync on every app launch once permission is already granted: makes
 * sure the push worker is registered in its own scope and that Firestore holds
 * this device's current token (FCM rotates tokens, and a PWA reinstall creates
 * a new one) — so nobody has to remember to tap "resynchroniser".
 */
export async function syncPushTokenIfGranted(user) {
  if (!user || !('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const token = await fetchDeviceToken()
    if (!token) return
    if (localStorage.getItem('fcm-token-synced') === `${user.uid}:${token}`) return
    await saveToken(user, token)
  } catch {
    // e.g. iOS refusing to subscribe outside a tap — the Settings button still works
  }
}

/** Foreground push handler (app open) — shows a small in-app toast via callback. */
export async function listenForegroundMessages(onMessageReceived) {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return () => {}
  return onMessage(messaging, onMessageReceived)
}

/** Re-reads this device's current FCM token (cheap once already subscribed) — for debugging. */
export async function getCurrentDeviceToken() {
  return fetchDeviceToken()
}
