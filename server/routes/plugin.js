import { Router } from 'express'
import { getDb } from '../database.js'
import {
  authStore,
  getStoreById,
  publicStore,
} from '../lib/auth.js'
import { authPlugin, generatePluginSecret } from '../lib/pluginAuth.js'
import { mapWooCategory } from '../lib/wooCategories.js'

const router = Router()

async function touchCatalog(storeId) {
  await getDb().execute({
    sql: `UPDATE stores SET catalog_touched_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    args: [storeId],
  })
}

async function markWooConnected(storeId) {
  await getDb().execute({
    sql: `UPDATE stores SET
            woo_connected = 1,
            woo_last_sync = datetime('now'),
            widget_installed_at = COALESCE(widget_installed_at, datetime('now')),
            catalog_touched_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [storeId],
  })
}

function normalizeProductInput(p) {
  const name = String(p.name || p.title || '').trim()
  const wooId = String(p.wooProductId || p.woo_product_id || p.id || '').trim()
  const price = Number(p.price ?? p.regular_price ?? 0)
  const stock =
    p.stock === false ||
    p.stock === 0 ||
    p.in_stock === false ||
    String(p.stock_status || '').toLowerCase() === 'outofstock'
      ? 0
      : 1
  const sku = String(p.sku || '').trim()
  const description = String(p.description || p.short_description || '').trim().slice(0, 2000)
  const cats = p.categories || p.category || []
  const category = mapWooCategory(
    Array.isArray(cats) ? cats.map((c) => (typeof c === 'string' ? c : c.name)) : [cats],
    name
  )
  return { name, wooId, price: Number.isFinite(price) ? price : 0, stock, sku, description, category }
}

// ——— Store JWT ———

router.post('/plugin/generate-key', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const secret = generatePluginSecret()
    await getDb().execute({
      sql: `UPDATE stores SET
              plugin_secret = ?,
              updated_at = datetime('now')
            WHERE id = ?`,
      args: [secret, storeId],
    })
    const store = await getStoreById(storeId)
    res.json({
      success: true,
      message: 'Plugin secret generated. Save it — it is only shown once.',
      storeId,
      pluginSecret: secret,
      store: publicStore(store),
      hasSecret: true,
    })
  } catch (err) {
    console.error('[plugin generate-key]', err)
    res.status(500).json({ success: false, error: 'Could not generate secret' })
  }
})

router.get('/plugin/status', authStore, async (req, res) => {
  try {
    const store = await getStoreById(req.user.storeId)
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' })
    res.json({
      success: true,
      storeId: store.id,
      wooConnected: !!store.woo_connected,
      hasSecret: !!store.plugin_secret,
      wooLastSync: store.woo_last_sync || null,
      widgetEnabled: !!store.widget_enabled,
      catalogTouchedAt: store.catalog_touched_at || null,
    })
  } catch (err) {
    console.error('[plugin status]', err)
    res.status(500).json({ success: false, error: 'Could not load plugin status' })
  }
})

router.post('/plugin/disconnect', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    await getDb().execute({
      sql: `UPDATE stores SET
              woo_connected = 0,
              plugin_secret = NULL,
              updated_at = datetime('now')
            WHERE id = ?`,
      args: [storeId],
    })
    const store = await getStoreById(storeId)
    res.json({
      success: true,
      message: 'WooCommerce disconnected. Generate a new secret to reconnect.',
      store: publicStore(store),
    })
  } catch (err) {
    console.error('[plugin disconnect]', err)
    res.status(500).json({ success: false, error: 'Could not disconnect' })
  }
})

// ——— Plugin header auth ———

router.post('/plugin/ping', authPlugin, async (req, res) => {
  try {
    const store = req.pluginStore
    await getDb().execute({
      sql: `UPDATE stores
            SET woo_connected = 1,
                widget_installed_at = COALESCE(widget_installed_at, datetime('now')),
                updated_at = datetime('now')
            WHERE id = ?`,
      args: [store.id],
    })
    res.json({
      success: true,
      message: 'Connected',
      storeId: store.id,
      storeName: store.name || '',
      plan: store.plan,
      widgetEnabled: !!store.widget_enabled,
    })
  } catch (err) {
    console.error('[plugin ping]', err)
    res.status(500).json({ success: false, error: 'Ping failed' })
  }
})

router.post('/plugin/sync', authPlugin, async (req, res) => {
  try {
    const store = req.pluginStore
    const products = Array.isArray(req.body.products) ? req.body.products : []
    if (products.length > 5000) {
      return res.status(400).json({ success: false, error: 'Too many products (max 5000)' })
    }

    const db = getDb()
    // Full replace of Woo-managed catalog for this store
    await db.execute({
      sql: `DELETE FROM products WHERE store_id = ?`,
      args: [store.id],
    })

    let imported = 0
    for (const raw of products) {
      const p = normalizeProductInput(raw)
      if (!p.name || p.name.length < 1) continue
      await db.execute({
        sql: `INSERT INTO products
              (store_id, name, category, price, stock, description, sku, woo_product_id, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          store.id,
          p.name.slice(0, 200),
          p.category,
          p.price,
          p.stock,
          p.description,
          p.sku.slice(0, 80),
          p.wooId || null,
        ],
      })
      imported += 1
    }

    await markWooConnected(store.id)

    res.json({
      success: true,
      message: `Synced ${imported} products`,
      imported,
      storeId: store.id,
    })
  } catch (err) {
    console.error('[plugin sync]', err)
    res.status(500).json({ success: false, error: 'Sync failed' })
  }
})

router.post('/plugin/product/update', authPlugin, async (req, res) => {
  try {
    const store = req.pluginStore
    const p = normalizeProductInput(req.body)
    if (!p.name) {
      return res.status(400).json({ success: false, error: 'Product name required' })
    }
    if (!p.wooId) {
      return res.status(400).json({ success: false, error: 'wooProductId required' })
    }

    const db = getDb()
    const existing = await db.execute({
      sql: `SELECT id FROM products WHERE store_id = ? AND woo_product_id = ? LIMIT 1`,
      args: [store.id, p.wooId],
    })

    if (existing.rows.length) {
      await db.execute({
        sql: `UPDATE products SET
                name = ?, category = ?, price = ?, stock = ?, description = ?, sku = ?,
                updated_at = datetime('now')
              WHERE id = ?`,
        args: [
          p.name.slice(0, 200),
          p.category,
          p.price,
          p.stock,
          p.description,
          p.sku.slice(0, 80),
          existing.rows[0].id,
        ],
      })
    } else {
      await db.execute({
        sql: `INSERT INTO products
              (store_id, name, category, price, stock, description, sku, woo_product_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          store.id,
          p.name.slice(0, 200),
          p.category,
          p.price,
          p.stock,
          p.description,
          p.sku.slice(0, 80),
          p.wooId,
        ],
      })
    }

    await markWooConnected(store.id)
    res.json({ success: true, message: 'Product upserted', wooProductId: p.wooId })
  } catch (err) {
    console.error('[plugin product update]', err)
    res.status(500).json({ success: false, error: 'Update failed' })
  }
})

router.post('/plugin/product/delete', authPlugin, async (req, res) => {
  try {
    const store = req.pluginStore
    const wooId = String(req.body.wooProductId || req.body.id || '').trim()
    if (!wooId) {
      return res.status(400).json({ success: false, error: 'wooProductId required' })
    }
    await getDb().execute({
      sql: `DELETE FROM products WHERE store_id = ? AND woo_product_id = ?`,
      args: [store.id, wooId],
    })
    await touchCatalog(store.id)
    await markWooConnected(store.id)
    res.json({ success: true, message: 'Product deleted', wooProductId: wooId })
  } catch (err) {
    console.error('[plugin product delete]', err)
    res.status(500).json({ success: false, error: 'Delete failed' })
  }
})

router.post('/plugin/widget-toggle', authPlugin, async (req, res) => {
  try {
    const store = req.pluginStore
    const enabled = req.body.enabled === undefined ? !store.widget_enabled : !!req.body.enabled
    await getDb().execute({
      sql: `UPDATE stores SET widget_enabled = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [enabled ? 1 : 0, store.id],
    })
    res.json({ success: true, widgetEnabled: enabled })
  } catch (err) {
    console.error('[plugin widget-toggle]', err)
    res.status(500).json({ success: false, error: 'Toggle failed' })
  }
})

router.post('/plugin/connection-status', authPlugin, async (req, res) => {
  try {
    const store = req.pluginStore
    const count = await getDb().execute({
      sql: `SELECT COUNT(*) AS c FROM products WHERE store_id = ?`,
      args: [store.id],
    })
    res.json({
      success: true,
      storeId: store.id,
      wooConnected: !!store.woo_connected,
      wooLastSync: store.woo_last_sync || null,
      productCount: Number(count.rows[0]?.c || 0),
      widgetEnabled: !!store.widget_enabled,
      plan: store.plan,
    })
  } catch (err) {
    console.error('[plugin connection-status]', err)
    res.status(500).json({ success: false, error: 'Status failed' })
  }
})

router.post('/plugin/remote-disconnect', authPlugin, async (req, res) => {
  try {
    const store = req.pluginStore
    await getDb().execute({
      sql: `UPDATE stores SET woo_connected = 0, updated_at = datetime('now') WHERE id = ?`,
      args: [store.id],
    })
    res.json({ success: true, message: 'Marked disconnected on BuildBot' })
  } catch (err) {
    console.error('[plugin remote-disconnect]', err)
    res.status(500).json({ success: false, error: 'Disconnect failed' })
  }
})

router.get('/plugin/widget-config/:storeId', authPlugin, async (req, res) => {
  try {
    const store = req.pluginStore
    if (store.id !== req.params.storeId) {
      return res.status(403).json({ success: false, error: 'Store ID mismatch' })
    }
    res.json({
      success: true,
      storeId: store.id,
      widgetEnabled: !!store.widget_enabled,
      brandColor: store.brand_color,
      currency: store.currency,
      widgetTitle: store.widget_title,
      welcomeMsg: store.welcome_msg,
      buttonText: store.button_text,
      widgetBg: store.widget_bg,
    })
  } catch (err) {
    console.error('[plugin widget-config]', err)
    res.status(500).json({ success: false, error: 'Config failed' })
  }
})

export default router
