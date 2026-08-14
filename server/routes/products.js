import { Router } from 'express'
import multer from 'multer'
import { getDb, getPlatformConfig } from '../database.js'
import { authStore, getStoreById } from '../lib/auth.js'
import { productLimit } from '../lib/storePlan.js'
import {
  PRODUCT_CATEGORIES,
  normalizeCategory,
  mapProduct,
  parseCsv,
  parseCsvHeaders,
} from '../lib/products.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
})

async function countProducts(storeId) {
  const result = await getDb().execute({
    sql: `SELECT COUNT(*) AS c FROM products WHERE store_id = ?`,
    args: [storeId],
  })
  return Number(result.rows[0]?.c || 0)
}

function assertOwnStore(req, storeId) {
  return req.user.storeId === storeId
}

async function touchCatalog(storeId) {
  await getDb().execute({
    sql: `UPDATE stores SET catalog_touched_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    args: [storeId],
  })
}

async function getOwnedProduct(id, storeId) {
  const result = await getDb().execute({
    sql: 'SELECT * FROM products WHERE id = ? AND store_id = ? LIMIT 1',
    args: [id, storeId],
  })
  return result.rows[0] || null
}

// Manage list (all products for owner) — must be before /products/:storeId
router.get('/products/manage/:storeId', authStore, async (req, res) => {
  try {
    const storeId = req.params.storeId
    if (!assertOwnStore(req, storeId)) {
      return res.status(403).json({ success: false, error: 'Not your store' })
    }
    const result = await getDb().execute({
      sql: `SELECT * FROM products WHERE store_id = ? ORDER BY updated_at DESC, id DESC`,
      args: [storeId],
    })
    res.json({
      success: true,
      products: result.rows.map(mapProduct),
      categories: PRODUCT_CATEGORIES,
      wooConnected: !!(await getStoreById(storeId))?.woo_connected,
    })
  } catch (err) {
    console.error('[products manage]', err)
    res.status(500).json({ success: false, error: 'Could not load products' })
  }
})

// Bulk actions (must be before /products/:storeId so "bulk-*" isn't read as a storeId)

router.post('/products/bulk-delete', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const store = await getStoreById(storeId)
    if (store?.woo_connected) {
      return res.status(403).json({
        success: false,
        error: 'Products are managed by WooCommerce for this store',
      })
    }
    const ids = Array.isArray(req.body.ids)
      ? [...new Set(req.body.ids.map(Number).filter(Number.isFinite))]
      : []
    if (!ids.length) {
      return res.status(400).json({ success: false, error: 'No product ids provided' })
    }

    const placeholders = ids.map(() => '?').join(',')
    const result = await getDb().execute({
      sql: `DELETE FROM products WHERE store_id = ? AND id IN (${placeholders})`,
      args: [storeId, ...ids],
    })
    await touchCatalog(storeId)
    res.json({ success: true, deleted: Number(result.rowsAffected ?? ids.length) })
  } catch (err) {
    console.error('[products bulk-delete]', err)
    res.status(500).json({ success: false, error: 'Bulk delete failed' })
  }
})

router.post('/products/bulk-stock', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const store = await getStoreById(storeId)
    if (store?.woo_connected) {
      return res.status(403).json({
        success: false,
        error: 'Products are managed by WooCommerce for this store',
      })
    }
    const ids = Array.isArray(req.body.ids)
      ? [...new Set(req.body.ids.map(Number).filter(Number.isFinite))]
      : []
    if (!ids.length) {
      return res.status(400).json({ success: false, error: 'No product ids provided' })
    }
    const stock = req.body.stock ? 1 : 0

    const placeholders = ids.map(() => '?').join(',')
    const result = await getDb().execute({
      sql: `UPDATE products SET stock = ?, updated_at = datetime('now') WHERE store_id = ? AND id IN (${placeholders})`,
      args: [stock, storeId, ...ids],
    })
    await touchCatalog(storeId)
    res.json({ success: true, updated: Number(result.rowsAffected ?? ids.length) })
  } catch (err) {
    console.error('[products bulk-stock]', err)
    res.status(500).json({ success: false, error: 'Bulk stock update failed' })
  }
})

// Preview a CSV's column headers, for the import column-mapping UI
router.post('/products/csv-headers', authStore, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'CSV file is required' })
    }
    const headers = parseCsvHeaders(req.file.buffer.toString('utf8'))
    res.json({ success: true, headers })
  } catch (err) {
    console.error('[products csv-headers]', err)
    res.status(500).json({ success: false, error: 'Could not read CSV headers' })
  }
})

// Public catalog (in-stock only)
router.get('/products/:storeId', async (req, res) => {
  try {
    const storeId = req.params.storeId
    const store = await getStoreById(storeId)
    if (!store || !store.active || store.disabled) {
      return res.status(404).json({ success: false, error: 'Store not found' })
    }
    const result = await getDb().execute({
      sql: `SELECT * FROM products WHERE store_id = ? AND stock = 1 ORDER BY category, name`,
      args: [storeId],
    })
    res.json({
      success: true,
      products: result.rows.map(mapProduct),
      categories: PRODUCT_CATEGORIES,
    })
  } catch (err) {
    console.error('[products public]', err)
    res.status(500).json({ success: false, error: 'Could not load products' })
  }
})

router.post('/product', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const store = await getStoreById(storeId)
    if (store?.woo_connected) {
      return res.status(403).json({
        success: false,
        error: 'Products are managed by WooCommerce for this store',
      })
    }

    const name = String(req.body.name || '').trim()
    const category = normalizeCategory(req.body.category)
    const price = Number(req.body.price)
    const description = String(req.body.description || '').trim()
    const sku = String(req.body.sku || '').trim()
    const stock = req.body.stock === false || req.body.stock === 0 ? 0 : 1

    if (name.length < 2) {
      return res.status(400).json({ success: false, error: 'Product name is required' })
    }
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ success: false, error: 'Valid price is required' })
    }

    const config = await getPlatformConfig()
    const limit = productLimit(store, config)
    const count = await countProducts(storeId)
    if (count >= limit) {
      return res.status(403).json({
        success: false,
        error: `Product limit reached (${count}/${limit}) for the ${store?.plan || 'trial'} plan. Upgrade to add more.`,
      })
    }

    const result = await getDb().execute({
      sql: `INSERT INTO products (store_id, name, category, price, stock, description, sku)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
      args: [storeId, name, category, price, stock, description, sku],
    })
    await touchCatalog(storeId)

    const row = result.rows[0]
    // libsql RETURNING may work; fallback select if needed
    let product = mapProduct(row)
    if (!product) {
      const last = await getDb().execute({
        sql: `SELECT * FROM products WHERE store_id = ? ORDER BY id DESC LIMIT 1`,
        args: [storeId],
      })
      product = mapProduct(last.rows[0])
    }

    res.status(201).json({ success: true, product })
  } catch (err) {
    console.error('[product create]', err)
    res.status(500).json({ success: false, error: 'Could not create product' })
  }
})

router.put('/product/:id', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const id = Number(req.params.id)
    const store = await getStoreById(storeId)
    if (store?.woo_connected) {
      return res.status(403).json({
        success: false,
        error: 'Products are managed by WooCommerce for this store',
      })
    }

    const existing = await getOwnedProduct(id, storeId)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    const name = String(req.body.name ?? existing.name).trim()
    const category = normalizeCategory(req.body.category ?? existing.category)
    const price = Number(req.body.price ?? existing.price)
    const description = String(req.body.description ?? existing.description ?? '').trim()
    const sku = String(req.body.sku ?? existing.sku ?? '').trim()
    const stock =
      req.body.stock === undefined
        ? existing.stock
        : req.body.stock === false || req.body.stock === 0
          ? 0
          : 1

    if (name.length < 2) {
      return res.status(400).json({ success: false, error: 'Product name is required' })
    }
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ success: false, error: 'Valid price is required' })
    }

    await getDb().execute({
      sql: `UPDATE products
            SET name = ?, category = ?, price = ?, stock = ?, description = ?, sku = ?,
                updated_at = datetime('now')
            WHERE id = ? AND store_id = ?`,
      args: [name, category, price, stock, description, sku, id, storeId],
    })
    await touchCatalog(storeId)
    const updated = await getOwnedProduct(id, storeId)
    res.json({ success: true, product: mapProduct(updated) })
  } catch (err) {
    console.error('[product update]', err)
    res.status(500).json({ success: false, error: 'Could not update product' })
  }
})

router.put('/product/:id/stock', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const id = Number(req.params.id)
    const store = await getStoreById(storeId)
    // Allow stock toggle even in woo mode? Handoff says mostly read-only — block mutations except maybe stock. Block all for woo.
    if (store?.woo_connected) {
      return res.status(403).json({
        success: false,
        error: 'Products are managed by WooCommerce for this store',
      })
    }

    const existing = await getOwnedProduct(id, storeId)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    const stock =
      req.body.stock === undefined
        ? existing.stock
          ? 0
          : 1
        : req.body.stock === false || req.body.stock === 0
          ? 0
          : 1

    await getDb().execute({
      sql: `UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ? AND store_id = ?`,
      args: [stock, id, storeId],
    })
    await touchCatalog(storeId)
    const updated = await getOwnedProduct(id, storeId)
    res.json({ success: true, product: mapProduct(updated) })
  } catch (err) {
    console.error('[product stock]', err)
    res.status(500).json({ success: false, error: 'Could not update stock' })
  }
})

router.delete('/product/:id', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const id = Number(req.params.id)
    const store = await getStoreById(storeId)
    if (store?.woo_connected) {
      return res.status(403).json({
        success: false,
        error: 'Products are managed by WooCommerce for this store',
      })
    }

    const existing = await getOwnedProduct(id, storeId)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    await getDb().execute({
      sql: 'DELETE FROM products WHERE id = ? AND store_id = ?',
      args: [id, storeId],
    })
    await touchCatalog(storeId)
    res.json({ success: true, message: 'Product deleted' })
  } catch (err) {
    console.error('[product delete]', err)
    res.status(500).json({ success: false, error: 'Could not delete product' })
  }
})

async function insertProductRow(db, storeId, row) {
  await db.execute({
    sql: `INSERT INTO products (store_id, name, category, price, stock, description, sku)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [storeId, row.name, row.category, row.price, row.stock ? 1 : 0, row.description, row.sku],
  })
}

// CSV upload — field name "file". Also accepts:
//   mode: 'add' (default, always inserts) | 'merge' (update matches by SKU/name+category,
//         insert the rest) | 'replace' (wipe the store's catalog, then insert)
//   columnMap: JSON string of { name, category, price, stock, description, sku } -> CSV header name,
//              for stores whose CSV headers don't match BuildBot's built-in aliases
router.post('/upload', authStore, upload.single('file'), async (req, res) => {
  try {
    const storeId = req.user.storeId
    const store = await getStoreById(storeId)
    if (store?.woo_connected) {
      return res.status(403).json({
        success: false,
        error: 'Products are managed by WooCommerce for this store',
      })
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'CSV file is required' })
    }

    const mode = ['add', 'merge', 'replace'].includes(req.body.mode) ? req.body.mode : 'add'
    let columnMap = null
    if (req.body.columnMap) {
      try {
        columnMap = JSON.parse(req.body.columnMap)
      } catch {
        columnMap = null
      }
    }

    const text = req.file.buffer.toString('utf8')
    let rows
    try {
      rows = parseCsv(text, columnMap)
    } catch (parseErr) {
      return res.status(400).json({ success: false, error: parseErr.message })
    }
    if (!rows.length) {
      return res.status(400).json({ success: false, error: 'No valid product rows found in CSV' })
    }

    const db = getDb()
    const config = await getPlatformConfig()
    const limit = productLimit(store, config)

    if (mode === 'replace') {
      if (rows.length > limit) {
        return res.status(403).json({
          success: false,
          error: `This CSV has ${rows.length} rows, over the ${store?.plan || 'trial'} plan limit of ${limit}. Upgrade to import more.`,
        })
      }
      await db.execute({ sql: 'DELETE FROM products WHERE store_id = ?', args: [storeId] })
      for (const row of rows) await insertProductRow(db, storeId, row)
      await touchCatalog(storeId)
      return res.json({
        success: true,
        imported: rows.length,
        replaced: true,
        message: `Replaced catalog with ${rows.length} product${rows.length === 1 ? '' : 's'}`,
      })
    }

    if (mode === 'merge') {
      const existingRows = (
        await db.execute({
          sql: 'SELECT id, sku, name, category FROM products WHERE store_id = ?',
          args: [storeId],
        })
      ).rows
      const bySku = new Map()
      const byNameCat = new Map()
      for (const p of existingRows) {
        if (p.sku) bySku.set(String(p.sku).toLowerCase(), p.id)
        byNameCat.set(`${String(p.name).toLowerCase()}::${String(p.category).toLowerCase()}`, p.id)
      }

      const newRows = []
      let updated = 0
      for (const row of rows) {
        const matchId = row.sku && bySku.has(row.sku.toLowerCase())
          ? bySku.get(row.sku.toLowerCase())
          : byNameCat.get(`${row.name.toLowerCase()}::${row.category.toLowerCase()}`)

        if (matchId) {
          await db.execute({
            sql: `UPDATE products SET name = ?, category = ?, price = ?, stock = ?, description = ?, sku = ?,
                  updated_at = datetime('now') WHERE id = ? AND store_id = ?`,
            args: [row.name, row.category, row.price, row.stock ? 1 : 0, row.description, row.sku, matchId, storeId],
          })
          updated++
        } else {
          newRows.push(row)
        }
      }

      if (existingRows.length + newRows.length > limit) {
        return res.status(403).json({
          success: false,
          error: `Importing would exceed the product limit for the ${store?.plan || 'trial'} plan (${existingRows.length}/${limit} used, ${newRows.length} new rows). Upgrade to import more.`,
        })
      }

      for (const row of newRows) await insertProductRow(db, storeId, row)
      await touchCatalog(storeId)
      return res.json({
        success: true,
        imported: newRows.length,
        updated,
        message: `Updated ${updated} existing product${updated === 1 ? '' : 's'}, added ${newRows.length} new`,
      })
    }

    // mode === 'add' (legacy default — always inserts as new rows)
    const existing = await countProducts(storeId)
    if (existing + rows.length > limit) {
      return res.status(403).json({
        success: false,
        error: `This CSV would exceed the product limit for the ${store?.plan || 'trial'} plan (${existing}/${limit} used, ${rows.length} rows in file). Upgrade to import more.`,
      })
    }
    for (const row of rows) await insertProductRow(db, storeId, row)
    await touchCatalog(storeId)

    res.json({
      success: true,
      imported: rows.length,
      message: `Imported ${rows.length} product${rows.length === 1 ? '' : 's'}`,
    })
  } catch (err) {
    console.error('[upload]', err)
    res.status(500).json({ success: false, error: 'CSV upload failed' })
  }
})

export default router
