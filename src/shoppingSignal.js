import { collection, deleteField, getDocs, updateDoc } from 'firebase/firestore'
import { db, HOUSEHOLD_ID } from './firebase'

const WORKER_URL = import.meta.env.VITE_NOTIFY_WORKER_URL

/**
 * Pings the other household member's phone with a push notification —
 * "heading to the store" or "done, checking out". Relayed through a small
 * Cloudflare Worker (see worker/) since the browser can neither call FCM
 * directly (no CORS) nor hold the credentials to do so itself.
 */
export async function sendShoppingSignal(user, type) {
  if (!WORKER_URL) return { ok: false, reason: 'not-configured' }

  const membersSnap = await getDocs(collection(db, `households/${HOUSEHOLD_ID}/members`))
  const recipients = membersSnap.docs.filter((d) => d.id !== user.uid)
  const tokens = recipients.map((d) => d.data().fcmToken).filter(Boolean)

  if (tokens.length === 0) return { ok: false, reason: 'no-recipient' }

  const idToken = await user.getIdToken()

  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, tokens, type }),
  })
  if (!res.ok) return { ok: false, reason: 'request-failed' }
  const data = await res.json()

  if (data.deadTokens?.length > 0) {
    await pruneDeadTokens(recipients, data.deadTokens)
  }

  return { ok: data.sent > 0, sent: data.sent, total: data.total }
}

// A token stops working when its service worker registration is replaced
// (browser update, PWA reinstall...) but nothing ever removes it from
// Firestore on its own — left unchecked it just keeps failing forever.
async function pruneDeadTokens(recipients, deadTokens) {
  await Promise.all(
    recipients
      .filter((docSnap) => deadTokens.includes(docSnap.data().fcmToken))
      .map((docSnap) => updateDoc(docSnap.ref, { fcmToken: deleteField() })),
  )
}
