import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { sendShoppingSignal } from '../shoppingSignal'

const FEEDBACK = {
  idle: null,
  sending: null,
  sent: '✅ Notification envoyée',
  'no-recipient': "Personne d'autre n'a activé les notifications",
  'not-configured': null, // silently hide the feature if the worker isn't set up yet
  error: "Échec de l'envoi",
}

export default function ShoppingSignalBar() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(null) // 'going_shopping' | 'checkout' | null
  const [feedback, setFeedback] = useState(null)

  // Hidden until the Cloudflare Worker relay is deployed and configured
  // (see worker/README.md) — nothing to click on otherwise.
  if (!import.meta.env.VITE_NOTIFY_WORKER_URL) return null

  async function handleClick(type) {
    setBusy(type)
    setFeedback(null)
    const result = await sendShoppingSignal(user, type)
    setBusy(null)
    if (result.ok) setFeedback('sent')
    else if (result.reason === 'no-recipient') setFeedback('no-recipient')
    else if (result.reason !== 'not-configured') setFeedback('error')
    if (result.reason !== 'not-configured') {
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  return (
    <div className="px-4 pt-2 pb-1 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
      <div className="flex gap-2">
        <button
          onClick={() => handleClick('going_shopping')}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 text-sm font-medium py-2.5 disabled:opacity-60"
        >
          🚗 {busy === 'going_shopping' ? 'Envoi…' : 'Je pars faire les courses'}
        </button>
        <button
          onClick={() => handleClick('checkout')}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 text-sm font-medium py-2.5 disabled:opacity-60"
        >
          ✅ {busy === 'checkout' ? 'Envoi…' : 'Courses terminées'}
        </button>
      </div>
      {feedback && FEEDBACK[feedback] && (
        <p className="text-xs text-slate-400 text-center mt-1.5">{FEEDBACK[feedback]}</p>
      )}
    </div>
  )
}
