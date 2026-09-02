import { useState } from 'react'
import { categoryMeta } from '../lib/categories'

export const ALERT_OFFSETS = [30, 15, 10, 5, 3, 2, 1]

export default function PantryItemModal({ item, defaultOffsets, onConfirm, onClose }) {
  const [expirationDate, setExpirationDate] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [offsets, setOffsets] = useState(defaultOffsets || [3])
  const meta = categoryMeta(item.category)

  function toggleOffset(days) {
    setOffsets((prev) => (prev.includes(days) ? prev.filter((d) => d !== days) : [...prev, days].sort((a, b) => b - a)))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!expirationDate) return
    onConfirm({ expirationDate, quantity: Number(quantity) || 1, alertOffsets: offsets })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-5"
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{item.name}</h2>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-slate-500 dark:text-slate-400">Date de péremption</label>
          <input
            type="date"
            required
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-slate-500 dark:text-slate-400">Quantité</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-slate-500 dark:text-slate-400">
            Me prévenir avant péremption (plusieurs choix possibles)
          </label>
          <div className="flex flex-wrap gap-2">
            {ALERT_OFFSETS.map((days) => (
              <button
                type="button"
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

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 py-3 font-medium"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white py-3 font-medium"
          >
            Ajouter
          </button>
        </div>
      </form>
    </div>
  )
}
