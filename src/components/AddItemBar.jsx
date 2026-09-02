import { useEffect, useRef, useState } from 'react'
import { searchProducts, lookupBarcode } from '../lib/openFoodFacts'
import { searchStaples } from '../lib/staples'
import { categoryMeta, guessCategory } from '../lib/categories'
import BarcodeScanner from './BarcodeScanner'

/**
 * Search bar with live suggestions — household history first, then the
 * built-in list of common staples (instant, works offline), then Open Food
 * Facts for branded/packaged products — plus free-text entry and a barcode
 * scan shortcut.
 */
export default function AddItemBar({ history, onAdd }) {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const abortRef = useRef(null)

  useEffect(() => {
    const query = text.trim().toLowerCase()
    setNotFound(false)
    const localResults = localMatches(history, query)
    setSuggestions(localResults)
    if (query.length < 2) return

    const timeout = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const remote = await searchProducts(query, { signal: controller.signal })
        setSuggestions(mergeSuggestions(localResults, remote))
      } catch {
        // ignore aborted/failed lookups, local results still shown
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [text, history])

  function addAndReset(item) {
    onAdd(item)
    setText('')
    setSuggestions([])
    setOpen(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const name = text.trim()
    if (!name) return
    addAndReset({ name, category: 'autre' })
  }

  async function handleBarcode(code) {
    setScanning(false)
    setLookupBusy(true)
    const product = await lookupBarcode(code)
    setLookupBusy(false)
    if (product) {
      addAndReset({ name: product.name, category: product.category, image: product.image, barcode: code })
    } else {
      setNotFound(true)
      setText('')
    }
  }

  return (
    <div className="relative px-4 pt-3 pb-2 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Ajouter un produit…"
            className="w-full rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {open && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 max-h-72 overflow-auto">
              {suggestions.map((s) => {
                const meta = categoryMeta(s.category)
                return (
                  <li key={s.name}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addAndReset(s)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: meta.color }}
                      />
                      {s.image ? (
                        <img src={s.image} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                      ) : null}
                      <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{s.name}</span>
                      {s.fromHistory && (
                        <span className="text-xs text-slate-400 shrink-0">déjà ajouté</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => setScanning(true)}
          title="Scanner un code-barres"
          className="shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700 px-3.5 text-xl active:scale-95 transition-transform"
        >
          📷
        </button>
      </form>

      {lookupBusy && (
        <p className="text-xs text-slate-400 mt-1.5 px-1">Recherche du produit…</p>
      )}
      {notFound && (
        <p className="text-xs text-orange-500 mt-1.5 px-1">
          Produit non trouvé dans la base, ajoute-le à la main.
        </p>
      )}

      {scanning && (
        <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />
      )}
    </div>
  )
}

function historyMatches(history, query) {
  return (history || [])
    .filter((h) => !query || h.name.toLowerCase().includes(query))
    .sort((a, b) => (b.addCount || 0) - (a.addCount || 0))
    .slice(0, 6)
    .map((h) => ({ ...h, fromHistory: true }))
}

// Instant, offline suggestions: what you've already bought before, then the
// built-in staples list (fruit, veg, pantry basics — the things Open Food
// Facts' barcode-only database mostly doesn't have).
function localMatches(history, query) {
  const historyResults = historyMatches(history, query)
  if (!query) return historyResults

  const seen = new Set(historyResults.map((h) => h.name.toLowerCase()))
  const staples = searchStaples(query)
    .filter((s) => !seen.has(s.name.toLowerCase()))
    .slice(0, 6)

  return [...historyResults, ...staples].slice(0, 8)
}

function mergeSuggestions(localResults, remote) {
  const seen = new Set(localResults.map((h) => h.name.toLowerCase()))
  const remoteFiltered = remote
    .filter((r) => !seen.has(r.name.toLowerCase()))
    .map((r) => ({ ...r, category: r.category || guessCategory(r) }))
  return [...localResults, ...remoteFiltered].slice(0, 8)
}
