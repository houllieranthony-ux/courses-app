import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db, HOUSEHOLD_ID } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { enablePushNotifications } from '../push'
import { ALERT_OFFSETS } from './PantryItemModal'

export default function Settings({ defaultOffsets }) {
  const { user, signOut } = useAuth()
  const [offsets, setOffsets] = useState(defaultOffsets)
  const [pushStatus, setPushStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  )
  const [busy, setBusy] = useState(false)

  function toggleOffset(days) {
    const next = offsets.includes(days) ? offsets.filter((d) => d !== days) : [...offsets, days].sort((a, b) => b - a)
    setOffsets(next)
    setDoc(doc(db, `households/${HOUSEHOLD_ID}/meta/settings`), { defaultAlertOffsets: next }, { merge: true })
  }

  async function handleEnablePush() {
    setBusy(true)
    const result = await enablePushNotifications(user)
    setBusy(false)
    setPushStatus(result.ok ? 'granted' : result.reason)
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Notifications
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {pushStatus === 'granted' && '✅ Notifications activées sur cet appareil.'}
            {pushStatus === 'denied' && '🚫 Notifications refusées — active-les dans les réglages du navigateur.'}
            {pushStatus === 'unsupported' && "Ton navigateur ne supporte pas les notifications push."}
            {(pushStatus === 'default' || pushStatus === 'no-token') &&
              'Active les notifications pour être prévenu des dates de péremption, même app fermée.'}
          </p>
          {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
            <button
              onClick={handleEnablePush}
              disabled={busy}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5"
            >
              {busy ? 'Activation…' : 'Activer les notifications'}
            </button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Alertes de péremption par défaut
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-slate-400">
            Utilisées quand tu ajoutes un produit au garde-manger (modifiable au cas par cas).
          </p>
          <div className="flex flex-wrap gap-2">
            {ALERT_OFFSETS.map((days) => (
              <button
                key={days}
                onClick={() => toggleOffset(days)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  offsets.includes(days)
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                }`}
              >
                {days} j
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Compte</h2>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-300">{user?.email}</span>
          <button onClick={signOut} className="text-sm text-red-500 font-medium">
            Se déconnecter
          </button>
        </div>
      </section>
    </div>
  )
}
