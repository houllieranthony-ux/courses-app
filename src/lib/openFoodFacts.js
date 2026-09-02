import { guessCategory } from './categories'

// Open Food Facts and its sister databases are free, keyless, community-run product
// databases. We try food first (by far the biggest), then beauty/hygiene, then the
// catch-all "products" database for everything else (household goods, etc). The
// "fr." subdomain is the same worldwide database, just defaulting to the French
// language/locale, which matters for search relevance and product names.
const DATABASES = [
  { host: 'world.openfoodfacts.org', kind: 'food' },
  { host: 'world.openbeautyfacts.org', kind: 'beauty' },
  { host: 'world.openproductsfacts.org', kind: 'product' },
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

// The newer search-a-licious engine (search.openfoodfacts.org) has no CORS
// headers, so browsers silently block it — it only works from a server. We
// stick to the legacy cgi/search.pl everywhere, which does send
// "Access-Control-Allow-Origin: *", but that free community server is prone
// to occasional 503s under its own load — worth one quick retry — so ranking
// (France-first, most-scanned) is done client-side over a modest page of raw
// results rather than relying on the endpoint's own (also flaky) sort_by.
async function searchLegacy(query, { signal, host, pageSize, fields, retried }) {
  const url = new URL(`https://${host}/cgi/search.pl`)
  url.searchParams.set('search_terms', query)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('fields', fields)

  const res = await fetch(url, { signal })
  if (!res.ok) {
    if (!retried && res.status >= 500) {
      return searchLegacy(query, { signal, host, pageSize, fields, retried: true })
    }
    return []
  }
  const data = await res.json()
  return data.products || []
}

async function searchFood(query, { signal, pageSize }) {
  const raw = await searchLegacy(query, {
    signal,
    host: 'world.openfoodfacts.org',
    pageSize,
    fields: 'product_name,product_name_fr,brands,image_front_small_url,categories_tags,code,countries_tags,unique_scans_n',
  })

  const ranked = raw.sort((a, b) => {
    const aFrance = a.countries_tags?.includes('en:france') ? 1 : 0
    const bFrance = b.countries_tags?.includes('en:france') ? 1 : 0
    if (aFrance !== bFrance) return bFrance - aFrance
    return (b.unique_scans_n || 0) - (a.unique_scans_n || 0)
  })

  return ranked.map((p) => normalizeProduct(p, 'food')).filter(Boolean)
}

function dedupe(products) {
  return products.filter(
    (p, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === p.name.toLowerCase()) === i,
  )
}

// Runs one promise, swallowing any failure into an empty list — one database
// having a hiccup shouldn't blank out the others.
async function settled(promise) {
  try {
    return await promise
  } catch {
    return []
  }
}

const NON_FOOD_FIELDS = 'product_name,brands,image_front_small_url,categories_tags,code'

/**
 * Free-text search for autocomplete suggestions across food, hygiene/beauty and
 * general household products (so "papier toilette" or "lessive" work just as
 * well as "yaourt"). Food results (by far the most common in a grocery list,
 * and also the noisiest — its DB has some non-food items miscategorized in it)
 * are prioritized and ranked to favor products actually sold in France, but
 * capped so a handful of household/hygiene slots always survive rather than
 * being crowded out by food matches.
 */
export async function searchProducts(query, { signal } = {}) {
  const trimmed = query?.trim()
  if (!trimmed || trimmed.length < 2) return []

  const [food, product, beauty] = await Promise.all([
    settled(searchFood(trimmed, { signal, pageSize: 12 })),
    settled(
      searchLegacy(trimmed, { signal, host: 'world.openproductsfacts.org', pageSize: 4, fields: NON_FOOD_FIELDS }).then(
        (raw) => raw.map((p) => normalizeProduct(p, 'product')).filter(Boolean),
      ),
    ),
    settled(
      searchLegacy(trimmed, { signal, host: 'world.openbeautyfacts.org', pageSize: 4, fields: NON_FOOD_FIELDS }).then(
        (raw) => raw.map((p) => normalizeProduct(p, 'beauty')).filter(Boolean),
      ),
    ),
  ])

  const nonFood = dedupe([...product, ...beauty])
  let combined = dedupe([...food.slice(0, 5), ...nonFood.slice(0, 3)])
  if (combined.length < 8) {
    combined = dedupe([...combined, ...nonFood.slice(3), ...food.slice(5)])
  }
  return combined.slice(0, 8)
}
