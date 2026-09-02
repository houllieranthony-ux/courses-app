import { guessCategory } from './categories'

// Open Food Facts and its sister databases are free, keyless, community-run product
// databases. We try food first (by far the biggest), then beauty/hygiene, then the
// catch-all "products" database for everything else (household goods, etc).
const DATABASES = [
  { host: 'world.openfoodfacts.org', kind: 'food' },
  { host: 'world.openbeautyfacts.org', kind: 'beauty' },
  { host: 'world.openproductsfacts.org', kind: 'product' },
]

function normalizeProduct(raw, kind) {
  if (!raw) return null
  const name = raw.product_name || raw.product_name_fr || raw.generic_name
  if (!name) return null
  return {
    barcode: raw.code,
    name,
    brand: raw.brands,
    image: raw.image_front_small_url || raw.image_small_url || raw.image_url || null,
    category: guessCategory({
      category: kind === 'beauty' ? 'hygiene' : kind === 'product' ? 'entretien' : null,
      categories_tags: raw.categories_tags,
      categories: raw.categories,
    }),
    source: kind,
  }
}

/**
 * Look up a product by barcode across the food / beauty / products databases.
 * Returns null if not found anywhere.
 */
export async function lookupBarcode(barcode) {
  for (const { host, kind } of DATABASES) {
    try {
      const res = await fetch(`https://${host}/api/v2/product/${encodeURIComponent(barcode)}.json`)
      if (!res.ok) continue
      const data = await res.json()
      if (data.status === 1 && data.product) {
        const product = normalizeProduct(data.product, kind)
        if (product) return product
      }
    } catch {
      // network hiccup on one DB shouldn't block trying the next
    }
  }
  return null
}

/**
 * Free-text search for autocomplete suggestions, food database only (by far the
 * most useful for a grocery list, and the fastest of the three).
 */
export async function searchProducts(query, { signal } = {}) {
  if (!query || query.trim().length < 2) return []
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', query.trim())
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '8')
  url.searchParams.set('fields', 'product_name,product_name_fr,brands,image_front_small_url,categories_tags,code')

  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = await res.json()
  return (data.products || [])
    .map((p) => normalizeProduct(p, 'food'))
    .filter(Boolean)
    .filter((p, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === p.name.toLowerCase()) === i)
}
