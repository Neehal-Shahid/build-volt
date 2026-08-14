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

// CSV upload — field name "file"
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

    const text = req.file.buffer.toString('utf8')
    let rows
    try {
      rows = parseCsv(text)
    } catch (parseErr) {
      return res.status(400).json({ success: false, error: parseErr.message })
    }
    if (!rows.length) {
      return res.status(400).json({ success: false, error: 'No valid product rows found in CSV' })
    }

    const config = await getPlatformConfig()
    const limit = productLimit(store, config)
    const existing = await countProducts(storeId)
    if (existing + rows.length > limit) {
      return res.status(403).json({
        success: false,
        error: `This CSV would exceed the product limit for the ${store?.plan || 'trial'} plan (${existing}/${limit} used, ${rows.length} rows in file). Upgrade to import more.`,
      })
    }

    const db = getDb()
    let imported = 0
    for (const row of rows) {
      await db.execute({
        sql: `INSERT INTO products (store_id, name, category, price, stock, description, sku)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          storeId,
          row.name,
          row.category,
          row.price,
          row.stock ? 1 : 0,
          row.description,
          row.sku,
        ],
      })
      imported++
    }
    await touchCatalog(storeId)

    res.json({
      success: true,
      imported,
      message: `Imported ${imported} product${imported === 1 ? '' : 's'}`,
    })
  } catch (err) {
    console.error('[upload]', err)
    res.status(500).json({ success: false, error: 'CSV upload failed' })
  }
})

export default router
