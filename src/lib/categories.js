// Category -> color mapping used across the shopping list and pantry.
// Colors are Tailwind-ish hex values chosen for good contrast in light & dark mode.
export const CATEGORIES = {
  fruits_legumes: { label: 'Fruits & légumes', color: '#16a34a', bg: '#dcfce7' },
  produits_laitiers: { label: 'Produits laitiers', color: '#2563eb', bg: '#dbeafe' },
  viande_poisson: { label: 'Viande & poisson', color: '#dc2626', bg: '#fee2e2' },
  epicerie: { label: 'Épicerie', color: '#ea580c', bg: '#ffedd5' },
  surgeles: { label: 'Surgelés', color: '#0891b2', bg: '#cffafe' },
  boulangerie: { label: 'Boulangerie', color: '#b45309', bg: '#fef3c7' },
  boissons: { label: 'Boissons', color: '#7c3aed', bg: '#ede9fe' },
  hygiene: { label: 'Hygiène & beauté', color: '#c026d3', bg: '#fae8ff' },
  entretien: { label: 'Entretien maison', color: '#0d9488', bg: '#ccfbf1' },
  bebe: { label: 'Bébé', color: '#db2777', bg: '#fce7f3' },
  animaux: { label: 'Animaux', color: '#92400e', bg: '#fef3c7' },
  autre: { label: 'Autre', color: '#64748b', bg: '#e2e8f0' },
}

export const DEFAULT_CATEGORY = 'autre'

// Best-effort mapping from Open Food Facts / Open Beauty Facts / Open Products Facts
// category tags to our own simplified categories.
const OFF_KEYWORDS = [
  [/fruit|legume|vegetable|fruits-and-vegetables/i, 'fruits_legumes'],
  [/dairy|milk|cheese|yaourt|yogurt|lait|fromage/i, 'produits_laitiers'],
  [/meat|fish|poisson|viande|volaille|charcuterie|seafood/i, 'viande_poisson'],
  [/frozen|surgele/i, 'surgeles'],
  [/bread|bakery|boulangerie|patisserie|viennoiserie/i, 'boulangerie'],
  [/beverage|drink|boisson|water|eau|soda|jus|juice/i, 'boissons'],
  [/hygiene|beauty|cosmetic|shampoo|savon|soap|deodorant/i, 'hygiene'],
  [/clean|entretien|detergent|lessive/i, 'entretien'],
  [/baby|bebe|infant/i, 'bebe'],
  [/pet|animal|chien|chat|dog|cat/i, 'animaux'],
  [/grocery|epicerie|pasta|rice|cereal|conserve|snack/i, 'epicerie'],
]

export function guessCategory(offProduct) {
  const haystack = [
    offProduct?.category,
    ...(offProduct?.categories_tags || []),
    offProduct?.categories,
  ]
    .filter(Boolean)
    .join(' ')

  for (const [regex, category] of OFF_KEYWORDS) {
    if (regex.test(haystack)) return category
  }
  return DEFAULT_CATEGORY
}

export function categoryMeta(key) {
  return CATEGORIES[key] || CATEGORIES[DEFAULT_CATEGORY]
}

// Urgency color for a pantry item, by days remaining until expiration.
export function urgencyColor(daysLeft) {
  if (daysLeft == null) return { color: '#64748b', bg: '#e2e8f0', label: '—' }
  if (daysLeft < 0) return { color: '#ffffff', bg: '#7f1d1d', label: 'Périmé' }
  if (daysLeft <= 2) return { color: '#dc2626', bg: '#fee2e2', label: `${daysLeft} j` }
  if (daysLeft <= 7) return { color: '#ea580c', bg: '#ffedd5', label: `${daysLeft} j` }
  if (daysLeft <= 15) return { color: '#ca8a04', bg: '#fef9c3', label: `${daysLeft} j` }
  return { color: '#16a34a', bg: '#dcfce7', label: `${daysLeft} j` }
}
