import crypto from 'crypto'
import { getStoreById } from './auth.js'

export function generatePluginSecret() {
  return crypto.randomBytes(24).toString('hex')
}

/** Auth plugin requests via X-BuildBot-Store-ID + X-BuildBot-Secret */
export async function authPlugin(req, res, next) {
  try {
    const storeId = String(
      req.headers['x-buildbot-store-id'] || req.body?.storeId || ''
    ).trim()
    const secret = String(
      req.headers['x-buildbot-secret'] || req.body?.secret || ''
    ).trim()

    if (!storeId || !secret) {
      return res.status(401).json({
        success: false,
        error: 'Missing X-BuildBot-Store-ID or X-BuildBot-Secret',
      })
    }

    const store = await getStoreById(storeId)
    if (!store) {
      return res.status(401).json({ success: false, error: 'Invalid store credentials' })
    }
    if (!store.plugin_secret || store.plugin_secret !== secret) {
      return res.status(401).json({ success: false, error: 'Invalid store credentials' })
    }
    if (store.disabled) {
      return res.status(403).json({ success: false, error: 'Store is disabled' })
    }

    req.pluginStore = store
    next()
  } catch (err) {
    console.error('[authPlugin]', err)
    res.status(500).json({ success: false, error: 'Auth failed' })
  }
}
