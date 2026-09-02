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
// restrict results to products actually sold in France.
async function runSearch(query, { signal, franceOnly, pageSize }) {
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

/**
 * Free-text search for autocomplete suggestions, food database only (by far the
 * most useful for a grocery list, and the fastest of the three). Prioritizes
 * products sold in France; falls back to the wider database only if that's not
 * enough results, so a couple in France doesn't drown in US-only products.
 */
export async function searchProducts(query, { signal } = {}) {
  const trimmed = query?.trim()
  if (!trimmed || trimmed.length < 2) return []

  const franceResults = await runSearch(trimmed, { signal, franceOnly: true, pageSize: 8 })
  let combined = franceResults
  if (franceResults.length < 4) {
    const wider = await runSearch(trimmed, { signal, franceOnly: false, pageSize: 8 })
    combined = [...franceResults, ...wider]
  }

  return combined.filter(
    (p, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === p.name.toLowerCase()) === i,
  ).slice(0, 8)
}
