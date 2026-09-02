import { guessCategory } from './categories'

// Open Food Facts and its sister databases are free, keyless, community-run product
// databases. We try food first (by far the biggest), then beauty/hygiene, then the
// catch-all "products" database for everything else (household goods, etc). The
// "fr." subdomain is the same worldwide database, just defaulting to the French
// language/locale, which matters for search relevance and product names.
const DATABASES = [
  { host: 'fr.openfoodfacts.org', kind: 'food' },
  { host: 'fr.openbeautyfacts.org', kind: 'beauty' },
  { host: 'fr.openproductsfacts.org', kind: 'product' },
]

function normalizeProduct(raw, kind) {
  if (!raw) return null
  const name = raw.product_name_fr || raw.product_name || raw.generic_name_fr || raw.generic_name
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

const SEARCH_FIELDS = 'code,product_name,product_name_fr,brands,image_front_small_url,categories_tags'

// Open Food Facts' newer search engine (search-a-licious). Unlike the legacy
// cgi/search.pl, it supports proper structured filters, which is what lets us
// restrict results to products actually sold in France. Only the food database
// has this newer engine; beauty/products still use the legacy one below.
async function searchFood(query, { signal, franceOnly, pageSize }) {
  const url = new URL('https://search.openfoodfacts.org/search')
  const q = franceOnly ? `${query} countries_tags:"en:france"` : query
  url.searchParams.set('q', q)
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('fields', SEARCH_FIELDS)
  // Most-scanned first, so well-known brands outrank obscure one-off entries
  // with the same word in their name.
  url.searchParams.set('sort_by', '-unique_scans_n')

  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = await res.json()
  return (data.hits || []).map((p) => normalizeProduct(p, 'food')).filter(Boolean)
}

// Legacy search endpoint, used for the beauty/hygiene and general "products"
// (household, non-food) databases, which don't have the newer search engine.
async function searchLegacy(query, { signal, host, kind, pageSize }) {
  const url = new URL(`https://${host}/cgi/search.pl`)
  url.searchParams.set('search_terms', query)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('fields', 'product_name,brands,image_front_small_url,categories_tags,code')

  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = await res.json()
  return (data.products || []).map((p) => normalizeProduct(p, kind)).filter(Boolean)
}

function dedupe(products) {
  return products.filter(
    (p, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === p.name.toLowerCase()) === i,
  )
}

/**
 * Free-text search for autocomplete suggestions across food, hygiene/beauty and
 * general household products (so "papier toilette" or "lessive" work just as
 * well as "yaourt"). Food results (by far the most common in a grocery list)
 * are prioritized and restricted to France when possible; the other databases
 * don't support that filter, but are much smaller and less US-skewed.
 */
export async function searchProducts(query, { signal } = {}) {
  const trimmed = query?.trim()
  if (!trimmed || trimmed.length < 2) return []

  const [foodFrance, householdProducts, beautyProducts] = await Promise.all([
    searchFood(trimmed, { signal, franceOnly: true, pageSize: 6 }),
    searchLegacy(trimmed, { signal, host: 'fr.openproductsfacts.org', kind: 'product', pageSize: 4 }),
    searchLegacy(trimmed, { signal, host: 'fr.openbeautyfacts.org', kind: 'beauty', pageSize: 4 }),
  ])

  let combined = dedupe([...foodFrance, ...householdProducts, ...beautyProducts])

  if (combined.length < 4) {
    const wider = await searchFood(trimmed, { signal, franceOnly: false, pageSize: 8 })
    combined = dedupe([...combined, ...wider])
  }

  return combined.slice(0, 8)
}
