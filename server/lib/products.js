export const PRODUCT_CATEGORIES = [
  'CPU',
  'GPU',
  'RAM',
  'Motherboard',
  'Storage',
  'PSU',
  'Case',
  'Cooler',
  'Monitor',
  'Keyboard',
  'Mouse',
  'Headset',
  'Webcam',
  'Other',
]

export function normalizeCategory(raw) {
  const value = String(raw || '').trim()
  if (!value) return 'Other'
  const hit = PRODUCT_CATEGORIES.find(
    (c) => c.toLowerCase() === value.toLowerCase()
  )
  return hit || value
}

export function mapProduct(row) {
  if (!row) return null
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    stock: !!row.stock,
    description: row.description || '',
    sku: row.sku || '',
    wooProductId: row.woo_product_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Field aliases \u2014 covers plain BuildBot exports as well as common WooCommerce/
// Shopify CSV export headers, so a store's existing export usually just works.
const FIELD_ALIASES = {
  name: ['name', 'product', 'title', 'product name', 'item name'],
  category: ['category', 'type', 'cat', 'categories', 'product category'],
  price: ['price', 'cost', 'amount', 'regular price', 'unit price', 'sale price'],
  stock: ['stock', 'in_stock', 'instock', 'available', 'in stock?', 'stock status', 'stock quantity', 'quantity'],
  description: ['description', 'desc', 'details', 'short description', 'long description'],
  sku: ['sku', 'code', 'item code', 'product code'],
}

export function parseCsvHeaders(text) {
  const firstLine = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)[0] || ''
  return splitCsvLine(firstLine).map((h) => h.trim()).filter(Boolean)
}

/**
 * @param {string} text raw CSV file contents
 * @param {Record<string,string>} [columnMap] optional explicit field -> CSV header name overrides
 */
export function parseCsv(text, columnMap) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  const headersLower = headers.map((h) => h.toLowerCase())

  function resolveIdx(field) {
    const mapped = columnMap && columnMap[field]
    if (mapped) {
      const idx = headersLower.findIndex((h) => h === String(mapped).trim().toLowerCase())
      if (idx >= 0) return idx
    }
    return headersLower.findIndex((h) => FIELD_ALIASES[field].includes(h))
  }

  const nameIdx = resolveIdx('name')
  const catIdx = resolveIdx('category')
  const priceIdx = resolveIdx('price')
  const stockIdx = resolveIdx('stock')
  const descIdx = resolveIdx('description')
  const skuIdx = resolveIdx('sku')

  if (nameIdx < 0 || priceIdx < 0) {
    throw new Error('CSV must include a name column and a price column (use column mapping if your headers differ)')
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const name = (cols[nameIdx] || '').trim()
    if (!name) continue
    const price = Number(String(cols[priceIdx] || '').replace(/[^0-9.]/g, ''))
    if (!Number.isFinite(price) || price < 0) continue

    let stock = true
    if (stockIdx >= 0) {
      const raw = String(cols[stockIdx] || '').trim().toLowerCase()
      if (raw === '') stock = true
      else if (/^-?\d+(\.\d+)?$/.test(raw)) stock = Number(raw) > 0
      else stock = ['1', 'true', 'yes', 'y', 'in stock', 'instock'].includes(raw)
    }

    rows.push({
      name,
      category: normalizeCategory(catIdx >= 0 ? cols[catIdx] : 'Other'),
      price,
      stock,
      description: descIdx >= 0 ? String(cols[descIdx] || '').trim() : '',
      sku: skuIdx >= 0 ? String(cols[skuIdx] || '').trim() : '',
    })
  }
  return rows
}

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}
