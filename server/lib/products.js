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

export function parseCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const nameIdx = headers.findIndex((h) => ['name', 'product', 'title'].includes(h))
  const catIdx = headers.findIndex((h) => ['category', 'type', 'cat'].includes(h))
  const priceIdx = headers.findIndex((h) => ['price', 'cost', 'amount'].includes(h))
  const stockIdx = headers.findIndex((h) => ['stock', 'in_stock', 'instock', 'available'].includes(h))
  const descIdx = headers.findIndex((h) => ['description', 'desc', 'details'].includes(h))
  const skuIdx = headers.findIndex((h) => ['sku', 'code'].includes(h))

  if (nameIdx < 0 || priceIdx < 0) {
    throw new Error('CSV must include name and price columns')
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const name = (cols[nameIdx] || '').trim()
    if (!name) continue
    const price = Number(String(cols[priceIdx] || '').replace(/[^0-9.]/g, ''))
    if (!Number.isFinite(price) || price < 0) continue
    const stockRaw = stockIdx >= 0 ? String(cols[stockIdx] || '').trim().toLowerCase() : '1'
    const stock =
      stockRaw === '' ||
      stockRaw === '1' ||
      stockRaw === 'true' ||
      stockRaw === 'yes' ||
      stockRaw === 'in stock' ||
      stockRaw === 'instock'
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
