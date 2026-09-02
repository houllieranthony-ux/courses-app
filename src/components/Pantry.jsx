import { useState } from 'react'
import { categoryMeta, urgencyColor } from '../lib/categories'

const SNOOZE_OPTIONS = [1, 3, 7]

export default function Pantry({ items, onConsumed, onSnooze }) {
  const sorted = [...items].sort((a, b) => daysLeft(a.expirationDate) - daysLeft(b.expirationDate))

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 px-8 text-center">
        <span className="text-4xl">🥫</span>
        <p>Garde-manger vide, coche des articles dans la liste puis "🏠 Rentrer au garde-manger".</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      {sorted.map((item) => (
        <PantryItem key={item.id} item={item} onConsumed={onConsumed} onSnooze={onSnooze} />
      ))}
    </div>
  )
}

function PantryItem({ item, onConsumed, onSnooze }) {
  const [showSnooze, setShowSnooze] = useState(false)
  const meta = categoryMeta(item.category)
  const remaining = daysLeft(item.expirationDate)
  const urgency = urgencyColor(remaining)
  const snoozedActive = item.snoozedUntil && item.snoozedUntil >= todayISO()

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 shadow-sm space-y-2"
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="truncate text-slate-800 dark:text-slate-100">{item.name}</p>
          <p className="text-xs text-slate-400">
            {meta.label} · qté {item.quantity} · alertes {item.alertOffsets?.join('/') || '—'}j
          </p>
        </div>
        <span
          className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ color: urgency.color, background: urgency.bg }}
        >
          {urgency.label}
        </span>
      </div>

      {snoozedActive && (
        <p className="text-xs text-amber-500">
          Alerte reportée jusqu'au {formatDate(item.snoozedUntil)}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onConsumed(item)}
          className="flex-1 text-sm rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 py-2 font-medium"
        >
          ✅ Consommé
        </button>
        <div className="relative flex-1">
          <button
            onClick={() => setShowSnooze((s) => !s)}
            className="w-full text-sm rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 py-2 font-medium"
          >
            ⏰ Reporter
          </button>
          {showSnooze && (
            <div className="absolute z-10 bottom-full mb-1 left-0 right-0 bg-white dark:bg-slate-700 rounded-xl shadow-lg border border-slate-100 dark:border-slate-600 flex overflow-hidden">
              {SNOOZE_OPTIONS.map((days) => (
                <button
                  key={days}
                  onClick={() => {
                    onSnooze(item, days)
                    setShowSnooze(false)
                  }}
                  className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                  +{days}j
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function daysLeft(expirationDate) {
  if (!expirationDate) return Infinity
  const diff = new Date(expirationDate + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')
  return Math.round(diff / 86400000)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
