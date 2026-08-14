import { Router } from 'express'
import { getDb } from '../database.js'
import {
  authStore,
  getStoreById,
  signStoreToken,
  publicStore,
  comparePassword,
  hashPassword,
  validatePassword,
} from '../lib/auth.js'
import {
  canServeWidget,
  widgetPauseReason,
  pauseMessage,
  publicPlanStatus,
} from '../lib/storePlan.js'

const router = Router()

// E7: Strip HTML-dangerous characters from free-text fields before DB write.
// Defense-in-depth: React already escapes on render, but the widget injects
// some values via innerHTML so we must sanitize server-side too.
function sanitizeText(str, maxLen = 500) {
  return String(str || '').replace(/[<>"'&]/g, '').trim().slice(0, maxLen)
}

function slugifyName(name) {
  const base = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return base || 'store'
}

function randomSuffix() {
  return Math.random().toString(16).slice(2, 8)
}

async function uniqueStoreId(name) {
  const db = getDb()
  for (let i = 0; i < 8; i++) {
    const id = `${slugifyName(name)}-${randomSuffix()}`
    const existing = await db.execute({
      sql: 'SELECT id FROM stores WHERE id = ? LIMIT 1',
      args: [id],
    })
    if (!existing.rows.length) return id
  }
  return `${slugifyName(name)}-${Date.now().toString(16).slice(-6)}`
}

// PUT /api/store-setup { name }
router.put('/store-setup', authStore, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    if (name.length < 2) {
      return res
        .status(400)
        .json({
          success: false,
          error: 'Store name must be at least 2 characters',
        })
    }
    if (name.length > 80) {
      return res
        .status(400)
        .json({ success: false, error: 'Store name is too long' })
    }

    const store = await getStoreById(req.user.storeId)
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' })
    }

    const db = getDb()
    let nextId = store.id
    const isTemp = String(store.id).startsWith('temp-')

    if (isTemp) {
      nextId = await uniqueStoreId(name)
      // SQLite/libSQL: update PK by inserting new row then deleting old is safer with FKs,
      // but products/etc are empty at setup — rewrite id in place.
      await db.execute({
        sql: `UPDATE stores
              SET id = ?, name = ?, updated_at = datetime('now')
              WHERE id = ?`,
        args: [nextId, name, store.id],
      })
    } else {
      await db.execute({
        sql: `UPDATE stores SET name = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [name, store.id],
      })
    }

    const updated = await getStoreById(nextId)
    const token = signStoreToken(updated)
    res.json({
      success: true,
      message: isTemp ? 'Store created' : 'Store name updated',
      token,
      store: publicStore(updated),
    })
  } catch (err) {
    console.error('[store-setup]', err)
    res
      .status(500)
      .json({ success: false, error: 'Could not finish store setup' })
  }
})

function parsePresets(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return [50000, 80000, 120000, 200000]
    return parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0)
  } catch {
    return [50000, 80000, 120000, 200000]
  }
}

// GET /api/store-config/:storeId (public — for widget)
router.get('/store-config/:storeId', async (req, res) => {
  try {
    const store = await getStoreById(req.params.storeId)
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' })
    }

    const pauseReason = widgetPauseReason(store)
    const available = canServeWidget(store)
    const planStatus = publicPlanStatus(store)

    res.json({
      success: true,
      active: available,
      widgetEnabled: available,
      paused: !available,
      pauseReason: pauseReason || null,
      pauseMessage: pauseReason ? pauseMessage(pauseReason) : null,
      brandColor: store.brand_color || '#2A5EE8',
      currency: store.currency || 'PKR',
      widgetTitle: store.widget_title || 'BuildBot',
      welcomeMsg: store.welcome_msg || '',
      buttonText: store.button_text || 'Get Started',
      widgetBg: store.widget_bg || '#FFFFFF',
      budgetPresets: parsePresets(store.budget_presets),
      plan: store.plan,
      planStatus,
    })
  } catch (err) {
    console.error('[store-config]', err)
    res
      .status(500)
      .json({ success: false, error: 'Could not load store config' })
  }
})

// POST /api/widget-ping/:storeId (public — widget install beacon)
router.post('/widget-ping/:storeId', async (req, res) => {
  try {
    const storeId = String(req.params.storeId || '').trim()
    const store = await getStoreById(storeId)
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' })
    }

    await getDb().execute({
      sql: `UPDATE stores
            SET widget_last_seen = datetime('now'),
                widget_installed_at = COALESCE(widget_installed_at, datetime('now')),
                updated_at = datetime('now')
            WHERE id = ?`,
      args: [storeId],
    })

    res.json({ success: true })
  } catch (err) {
    console.error('[widget-ping]', err)
    res.status(500).json({ success: false, error: 'Ping failed' })
  }
})

// PUT /api/widget-settings
router.put('/widget-settings', authStore, async (req, res) => {
  try {
    const store = await getStoreById(req.user.storeId)
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' })
    }

    const brandColor = String(
      req.body.brandColor ?? store.brand_color ?? '#2A5EE8',
    ).trim()
    // Panel background is fixed white for consistent contrast
    const widgetBg = '#FFFFFF'
    const currency = sanitizeText(req.body.currency ?? store.currency ?? 'PKR', 8)
    const widgetTitle = sanitizeText(
      req.body.widgetTitle ?? store.widget_title ?? 'BuildBot',
      60,
    )
    const welcomeMsg = sanitizeText(
      req.body.welcomeMsg ?? store.welcome_msg ?? '',
      500,
    )
    const buttonText = sanitizeText(
      req.body.buttonText ?? store.button_text ?? 'Get Started',
      40,
    )
    const widgetEnabled =
      req.body.widgetEnabled === undefined
        ? store.widget_enabled
        : req.body.widgetEnabled
          ? 1
          : 0

    let presets = store.budget_presets
    if (req.body.budgetPresets !== undefined) {
      const list = parsePresets(req.body.budgetPresets)
      if (!list.length) {
        return res
          .status(400)
          .json({ success: false, error: 'Budget presets invalid' })
      }
      presets = JSON.stringify(list)
    }

    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(brandColor)) {
      return res
        .status(400)
        .json({ success: false, error: 'brandColor must be a hex color' })
    }
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(widgetBg)) {
      return res
        .status(400)
        .json({ success: false, error: 'widgetBg must be a hex color' })
    }

    await getDb().execute({
      sql: `UPDATE stores SET
              brand_color = ?,
              widget_bg = ?,
              currency = ?,
              widget_title = ?,
              welcome_msg = ?,
              button_text = ?,
              widget_enabled = ?,
              budget_presets = ?,
              updated_at = datetime('now')
            WHERE id = ?`,
      args: [
        brandColor,
        widgetBg,
        currency,
        widgetTitle,
        welcomeMsg,
        buttonText,
        widgetEnabled,
        typeof presets === 'string' ? presets : JSON.stringify(presets),
        store.id,
      ],
    })

    const updated = await getStoreById(store.id)
    res.json({ success: true, store: publicStore(updated) })
  } catch (err) {
    console.error('[widget-settings]', err)
    res
      .status(500)
      .json({ success: false, error: 'Could not save widget settings' })
  }
})

// PUT /api/change-password { currentPassword, newPassword }
router.put('/change-password', authStore, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '')
    const newPassword = String(req.body.newPassword || '')

    const store = await getStoreById(req.user.storeId)
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' })
    }

    const ok = await comparePassword(currentPassword, store.password_hash)
    if (!ok) {
      return res
        .status(400)
        .json({ success: false, error: 'Current password is wrong' })
    }

    const pwErr = validatePassword(newPassword)
    if (pwErr) return res.status(400).json({ success: false, error: pwErr })

    const password_hash = await hashPassword(newPassword)
    await getDb().execute({
      sql: `UPDATE stores SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [password_hash, store.id],
    })

    res.json({ success: true, message: 'Password updated' })
  } catch (err) {
    console.error('[change-password]', err)
    res.status(500).json({ success: false, error: 'Could not update password' })
  }
})

// PUT /api/email-preferences { marketingOptIn }
router.put('/email-preferences', authStore, async (req, res) => {
  try {
    const marketingOptIn = req.body.marketingOptIn ? 1 : 0

    await getDb().execute({
      sql: `UPDATE stores SET marketing_opt_in = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [marketingOptIn, req.user.storeId],
    })

    const updated = await getStoreById(req.user.storeId)
    res.json({ success: true, store: publicStore(updated) })
  } catch (err) {
    console.error('[email-preferences]', err)
    res
      .status(500)
      .json({ success: false, error: 'Could not update email preferences' })
  }
})

// PUT /api/settings { name }
router.put('/settings', authStore, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Store name must be at least 2 characters',
      })
    }
    if (name.length > 80) {
      return res
        .status(400)
        .json({ success: false, error: 'Store name is too long' })
    }

    const store = await getStoreById(req.user.storeId)
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' })
    }

    await getDb().execute({
      sql: `UPDATE stores SET name = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [name, store.id],
    })

    const updated = await getStoreById(store.id)
    res.json({ success: true, store: publicStore(updated) })
  } catch (err) {
    console.error('[settings]', err)
    res.status(500).json({ success: false, error: 'Could not save settings' })
  }
})

// DELETE /api/account { password }
router.delete('/account', authStore, async (req, res) => {
  try {
    const password = String(req.body.password || '')

    const store = await getStoreById(req.user.storeId)
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' })
    }

    const ok = await comparePassword(password, store.password_hash)
    if (!ok) {
      return res
        .status(400)
        .json({ success: false, error: 'Password is wrong' })
    }

    await getDb().execute({
      sql: `DELETE FROM stores WHERE id = ?`,
      args: [store.id],
    })

    res.json({ success: true, message: 'Account deleted' })
  } catch (err) {
    console.error('[delete-account]', err)
    res.status(500).json({ success: false, error: 'Could not delete account' })
  }
})

export default router
