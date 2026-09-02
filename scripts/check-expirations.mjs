// Runs once a day via GitHub Actions (see .github/workflows/check-expirations.yml).
// Checks every pantry item's expiration date against its configured alert
// offsets, and sends a push notification (FCM) for each threshold crossed
// since the last run. Free to run forever: no Firebase Blaze plan needed,
// since this lives outside Cloud Functions entirely.
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
const HOUSEHOLD_ID = process.env.HOUSEHOLD_ID || 'foyer'

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
const messaging = getMessaging()

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(dateISO) {
  const diff = new Date(dateISO + 'T00:00:00Z') - new Date(todayISO() + 'T00:00:00Z')
  return Math.round(diff / 86400000)
}

async function main() {
  const today = todayISO()
  const membersSnap = await db.collection(`households/${HOUSEHOLD_ID}/members`).get()
  const tokens = membersSnap.docs.map((d) => d.data().fcmToken).filter(Boolean)

  if (tokens.length === 0) {
    console.log('Aucun appareil enregistré pour les notifications, rien à faire.')
    return
  }

  const pantrySnap = await db.collection(`households/${HOUSEHOLD_ID}/pantry`).get()
  let sent = 0

  for (const docSnap of pantrySnap.docs) {
    const item = docSnap.data()
    if (!item.expirationDate) continue

    // Postponed by the "Reporter" button in the app: skip this item entirely
    // until the snooze period is over.
    if (item.snoozedUntil && item.snoozedUntil >= today) continue

    const remaining = daysUntil(item.expirationDate)
    const alertOffsets = item.alertOffsets || []
    const notifiedOffsets = item.notifiedOffsets || []
    const newlyNotified = []

    for (const offset of alertOffsets) {
      if (notifiedOffsets.includes(offset)) continue
      if (remaining <= offset) newlyNotified.push(offset)
    }

    if (newlyNotified.length === 0) continue

    for (const offset of newlyNotified) {
      const body =
        remaining < 0
          ? `${item.name} est périmé depuis ${Math.abs(remaining)} j`
          : remaining === 0
            ? `${item.name} périme aujourd'hui`
            : `${item.name} périme dans ${remaining} j (alerte ${offset} j)`

      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: 'Garde-manger',
          body,
        },
        webpush: {
          notification: { icon: '/icons/icon-192.png' },
          fcmOptions: { link: '/' },
        },
      })
      sent += response.successCount
      await pruneInvalidTokens(membersSnap, tokens, response)
    }

    await docSnap.ref.update({
      notifiedOffsets: FieldValue.arrayUnion(...newlyNotified),
    })
  }

  console.log(`Terminé : ${sent} notification(s) envoyée(s).`)
}

async function pruneInvalidTokens(membersSnap, tokens, response) {
  const deadTokens = response.responses
    .map((r, i) => (!r.success && isUnregistered(r.error) ? tokens[i] : null))
    .filter(Boolean)
  if (deadTokens.length === 0) return

  for (const memberDoc of membersSnap.docs) {
    if (deadTokens.includes(memberDoc.data().fcmToken)) {
      await memberDoc.ref.update({ fcmToken: FieldValue.delete() })
    }
  }
}

function isUnregistered(error) {
  return error?.code === 'messaging/registration-token-not-registered'
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
