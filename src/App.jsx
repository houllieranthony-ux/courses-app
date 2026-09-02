import { useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db, HOUSEHOLD_ID } from './firebase'
import { useAuth } from './context/AuthContext'
import { useCollection } from './hooks/useCollection'
import { useDoc } from './hooks/useDoc'
import { guessCategory } from './lib/categories'
import Login from './components/Login'
import AddItemBar from './components/AddItemBar'
import ShoppingList from './components/ShoppingList'
import Pantry from './components/Pantry'
import PantryItemModal from './components/PantryItemModal'
import Settings from './components/Settings'

const TABS = [
  { key: 'list', label: 'Liste', icon: '🛒' },
  { key: 'pantry', label: 'Garde-manger', icon: '🥫' },
  { key: 'settings', label: 'Réglages', icon: '⚙️' },
]

export default function App() {
  const { user } = useAuth()

  if (user === undefined) return <SplashScreen />
  if (!user) return <Login />
  return <Home />
}

function SplashScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center text-4xl">🛒</div>
  )
}

function Home() {
  const [tab, setTab] = useState('list')
  const [pendingPantryItem, setPendingPantryItem] = useState(null)

  const { docs: shoppingList } = useCollection(`households/${HOUSEHOLD_ID}/shoppingList`)
  const { docs: pantry } = useCollection(`households/${HOUSEHOLD_ID}/pantry`)
  const { docs: history } = useCollection(`households/${HOUSEHOLD_ID}/history`)
  const { data: settings } = useDoc(`households/${HOUSEHOLD_ID}/meta/settings`)
  const defaultOffsets = settings?.defaultAlertOffsets || [3]

  async function handleAdd(item) {
    const category = item.category || guessCategory(item)
    await addDoc(collection(db, `households/${HOUSEHOLD_ID}/shoppingList`), {
      name: item.name,
      category,
      image: item.image || null,
      checked: false,
      createdAt: serverTimestamp(),
    })
    const key = slug(item.name)
    await setDoc(
      doc(db, `households/${HOUSEHOLD_ID}/history/${key}`),
      { name: item.name, category, addCount: increment(1) },
      { merge: true },
    )
  }

  function handleToggle(item) {
    updateDoc(doc(db, `households/${HOUSEHOLD_ID}/shoppingList/${item.id}`), { checked: !item.checked })
  }

  function handleDelete(item) {
    deleteDoc(doc(db, `households/${HOUSEHOLD_ID}/shoppingList/${item.id}`))
  }

  function handleConfirmPantry({ expirationDate, quantity, alertOffsets }) {
    const item = pendingPantryItem
    setPendingPantryItem(null)
    addDoc(collection(db, `households/${HOUSEHOLD_ID}/pantry`), {
      name: item.name,
      category: item.category,
      quantity,
      expirationDate,
      alertOffsets,
      notifiedOffsets: [],
      snoozedUntil: null,
      purchaseDate: new Date().toISOString().slice(0, 10),
    })
    deleteDoc(doc(db, `households/${HOUSEHOLD_ID}/shoppingList/${item.id}`))
  }

  function handleConsumed(item) {
    deleteDoc(doc(db, `households/${HOUSEHOLD_ID}/pantry/${item.id}`))
  }

  function handleSnooze(item, days) {
    const until = new Date()
    until.setDate(until.getDate() + days)
    updateDoc(doc(db, `households/${HOUSEHOLD_ID}/pantry/${item.id}`), {
      snoozedUntil: until.toISOString().slice(0, 10),
    })
  }

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto bg-slate-50 dark:bg-slate-900">
      <header className="px-4 pt-4 pb-1">
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {TABS.find((t) => t.key === tab).icon} {TABS.find((t) => t.key === tab).label}
        </h1>
      </header>

      {tab === 'list' && <AddItemBar history={history} onAdd={handleAdd} />}

      {tab === 'list' && (
        <ShoppingList
          items={shoppingList}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onMoveToPantry={(item) => setPendingPantryItem(item)}
        />
      )}
      {tab === 'pantry' && <Pantry items={pantry} onConsumed={handleConsumed} onSnooze={handleSnooze} />}
      {tab === 'settings' && <Settings defaultOffsets={defaultOffsets} />}

      <nav className="flex border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
              tab === t.key ? 'text-emerald-500' : 'text-slate-400'
            }`}
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {pendingPantryItem && (
        <PantryItemModal
          item={pendingPantryItem}
          defaultOffsets={defaultOffsets}
          onConfirm={handleConfirmPantry}
          onClose={() => setPendingPantryItem(null)}
        />
      )}
    </div>
  )
}

const DIACRITICS_REGEX = /[̀-ͯ]/g

function slug(name) {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(DIACRITICS_REGEX, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  )
}
