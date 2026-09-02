import { categoryMeta } from '../lib/categories'

export default function ShoppingList({ items, onToggle, onDelete, onMoveToPantry }) {
  const pending = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 px-8 text-center">
        <span className="text-4xl">🧺</span>
        <p>Liste vide, ajoute votre premier produit !</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">
      <ItemGroup title={null} items={pending} onToggle={onToggle} onDelete={onDelete} />
      {checked.length > 0 && (
        <ItemGroup
          title={`Dans le chariot (${checked.length})`}
          items={checked}
          onToggle={onToggle}
          onDelete={onDelete}
          onMoveToPantry={onMoveToPantry}
        />
      )}
    </div>
  )
}

function ItemGroup({ title, items, onToggle, onDelete, onMoveToPantry }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1.5">
      {title && (
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide px-1">{title}</h2>
      )}
      <ul className="space-y-1.5">
        {items.map((item) => {
          const meta = categoryMeta(item.category)
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl px-3 py-3 shadow-sm"
              style={{ borderLeft: `4px solid ${meta.color}` }}
            >
              <button
                onClick={() => onToggle(item)}
                className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  item.checked
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-500'
                }`}
              >
                {item.checked && '✓'}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`truncate ${
                    item.checked ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {item.name}
                </p>
                <span className="text-xs" style={{ color: meta.color }}>
                  {meta.label}
                </span>
              </div>

              {item.checked && onMoveToPantry && (
                <button
                  onClick={() => onMoveToPantry(item)}
                  title="Rentrer au garde-manger"
                  className="shrink-0 text-lg px-1.5 active:scale-90 transition-transform"
                >
                  🏠
                </button>
              )}

              <button
                onClick={() => onDelete(item)}
                title="Supprimer"
                className="shrink-0 text-slate-300 hover:text-red-400 px-1 text-lg"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
